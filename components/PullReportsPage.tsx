import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileSearch, Trash2 } from 'lucide-react';
import { PullReport, PullReportEntry, Transaction } from '../types';
import PageHeader from './PageHeader';
import TransactionItem from './TransactionItem';

interface PullReportsPageProps {
  reports: PullReport[];
  onClose: () => void;
  onDeleteReport: (reportId: string) => Promise<void>;
  focusReportId?: string;
}

const STATUS_UI: Record<PullReport['status'], { label: string; className: string }> = {
  success: {
    label: '成功',
    className: 'border-emerald-400/25 bg-emerald-500/15 text-emerald-200',
  },
  partial: {
    label: '部分失敗',
    className: 'border-amber-400/25 bg-amber-500/15 text-amber-200',
  },
  failed: {
    label: '失敗',
    className: 'border-rose-400/25 bg-rose-500/15 text-rose-200',
  },
};

type ReportCategory = 'fetched' | PullReportEntry['action'];

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  fetched: '雲端讀取',
  insertedFromCloud: '雲端新增本機',
  updatedFromCloud: '雲端覆蓋本機',
  pushedLocalUpdateToCloud: '本機覆蓋雲端',
  insertedLocalOnlyToCloud: '本機新增雲端',
  pushedBackToCloud: '本機回推雲端',
  unchanged: '未變更',
  failed: '失敗',
};

const REASON_LABELS: Record<PullReportEntry['reason'], string> = {
  cloud_only: '只有雲端有資料',
  cloud_newer_version: '雲端 version 較新',
  cloud_newer_updatedAt: '雲端 updatedAt 較新',
  local_only: '只有本機有資料',
  local_newer_version: '本機 version 較新',
  local_newer_updatedAt: '本機 updatedAt 較新',
  identical: '版本與時間完全相同',
  content_mismatch: '同版內容不同，雲端為準',
  invalid_cloud_item: '雲端資料格式不合法',
  local_write_failed: '本地寫入失敗',
  push_back_failed: '回推雲端失敗',
};

const toDisplayTransaction = (tx: Transaction | undefined): Transaction | null => {
  if (!tx) return null;
  return {
    ...tx,
    syncStatus: tx.syncStatus || 'synced',
  };
};

const getSummaryCount = (report: PullReport, category: ReportCategory): number => {
  if (category === 'fetched') return report.summary.fetched;
  if (category === 'pushedLocalUpdateToCloud') {
    return report.summary.pushedLocalUpdateToCloud ?? 0;
  }
  if (category === 'insertedLocalOnlyToCloud') {
    return report.summary.insertedLocalOnlyToCloud ?? 0;
  }
  if (category === 'pushedBackToCloud') {
    return report.summary.pushedBackToCloud ?? 0;
  }
  return report.summary[category] ?? 0;
};

const entryMatchesCategory = (entry: PullReportEntry, category: ReportCategory) => {
  if (category === 'fetched') {
    return (
      entry.action === 'insertedFromCloud' ||
      entry.action === 'updatedFromCloud' ||
      entry.action === 'unchanged' ||
      entry.action === 'pushedLocalUpdateToCloud' ||
      (entry.action === 'pushedBackToCloud' && entry.reason !== 'local_only') ||
      (entry.action === 'failed' && (entry.reason === 'invalid_cloud_item' || Boolean(entry.before) || Boolean(entry.after)))
    );
  }

  if (category === 'pushedLocalUpdateToCloud') {
    return entry.action === 'pushedLocalUpdateToCloud' || (
      entry.action === 'pushedBackToCloud' && entry.reason !== 'local_only'
    );
  }

  if (category === 'insertedLocalOnlyToCloud') {
    return entry.action === 'insertedLocalOnlyToCloud' || (
      entry.action === 'pushedBackToCloud' && entry.reason === 'local_only'
    );
  }

  return entry.action === category;
};

const PullReportsPage: React.FC<PullReportsPageProps> = ({
  reports,
  onClose,
  onDeleteReport,
  focusReportId,
}) => {
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id || '');
  const [reportIdPendingDelete, setReportIdPendingDelete] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (reports.length === 0) {
      setSelectedReportId('');
      return;
    }

    setSelectedReportId((current) => (
      focusReportId && reports.some((report) => report.id === focusReportId)
        ? focusReportId
        : current && reports.some((report) => report.id === current)
        ? current
        : reports[0].id
    ));
  }, [focusReportId, reports]);

  const selectedReport = useMemo(() => {
    return reports.find((report) => report.id === selectedReportId) || reports[0] || null;
  }, [reports, selectedReportId]);

  useEffect(() => {
    setSelectedCategory(null);
  }, [selectedReport?.id]);

  const categoryItems = useMemo(() => {
    if (!selectedReport) return [];
    return [
      { category: 'fetched' as const, count: selectedReport.summary.fetched },
      { category: 'unchanged' as const, count: selectedReport.summary.unchanged },
      { category: 'insertedFromCloud' as const, count: selectedReport.summary.insertedFromCloud },
      { category: 'updatedFromCloud' as const, count: selectedReport.summary.updatedFromCloud },
      { category: 'insertedLocalOnlyToCloud' as const, count: getSummaryCount(selectedReport, 'insertedLocalOnlyToCloud') },
      { category: 'pushedLocalUpdateToCloud' as const, count: getSummaryCount(selectedReport, 'pushedLocalUpdateToCloud') },
      { category: 'failed' as const, count: selectedReport.summary.failed },
    ];
  }, [selectedReport]);

  const selectedEntries = useMemo(() => {
    if (!selectedReport || !selectedCategory) return [];
    return selectedReport.entries.filter((entry) => entryMatchesCategory(entry, selectedCategory));
  }, [selectedCategory, selectedReport]);

  const handleDelete = async () => {
    if (!reportIdPendingDelete) return;
    try {
      setIsDeleting(true);
      await onDeleteReport(reportIdPendingDelete);
      if (selectedReportId === reportIdPendingDelete) {
        const next = reports.find((report) => report.id !== reportIdPendingDelete);
        setSelectedReportId(next?.id || '');
      }
      setReportIdPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#1a1c2c] text-slate-200">
      <PageHeader
        title="同步紀錄"
        leftAction={<ArrowLeft size={26} />}
        onLeftAction={onClose}
      />

      <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.1),_transparent_28%),linear-gradient(180deg,_#1f2235_0%,_#171a29_48%,_#121520_100%)] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6 pb-10">
          {reports.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.035] px-6 py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-500/10 text-cyan-200">
                <FileSearch size={24} />
              </div>
              <p className="mt-4 text-sm font-black text-white">目前還沒有同步紀錄</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                從設定頁執行年度雲端同步後，完整報告會保存在本機，之後可在這裡回看。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
              <section className="rounded-[28px] border border-white/8 bg-white/[0.045] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-sm">
                <div className="space-y-3">
                  {reports.map((report) => {
                    const isActive = report.id === selectedReport?.id;
                    return (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => setSelectedReportId(report.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition-all ${
                          isActive
                            ? 'border-cyan-400/30 bg-cyan-500/12'
                            : 'border-white/8 bg-[#131726]/80 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                              {new Date(report.createdAt).toLocaleString('zh-TW', { hour12: false })}
                            </p>
                            <p className="mt-1 text-base font-black text-white">{report.year} 年</p>
                          </div>
                          <span className={`rounded-xl border px-2 py-1 text-[10px] font-black ${STATUS_UI[report.status].className}`}>
                            {STATUS_UI[report.status].label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {selectedReport && (
                <section className="rounded-[28px] border border-white/8 bg-white/[0.045] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                        {new Date(selectedReport.createdAt).toLocaleString('zh-TW', { hour12: false })}
                      </p>
                      <h2 className="mt-1 text-xl font-black text-white">{selectedReport.year} 年同步報告</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-2xl border px-3 py-2 text-xs font-black ${STATUS_UI[selectedReport.status].className}`}>
                        {STATUS_UI[selectedReport.status].label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReportIdPendingDelete(selectedReport.id)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-500/15 text-rose-200 transition-all hover:bg-rose-500/20"
                        title="刪除報告"
                        aria-label="刪除報告"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {selectedReport.runError && (
                    <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">
                      {selectedReport.runError}
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
                    {categoryItems.map(({ category, count }) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        aria-pressed={selectedCategory === category}
                        className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                          selectedCategory === category
                            ? 'border-cyan-400/30 bg-cyan-500/12'
                            : 'border-white/8 bg-[#131726]/80 hover:bg-white/5'
                        }`}
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          {CATEGORY_LABELS[category]}
                        </p>
                        <p className="mt-2 text-lg font-black text-white">{count}</p>
                      </button>
                    ))}
                  </div>

                  {selectedCategory && (
                    <div className="mt-6">
                      <div className="space-y-4">
                        {selectedEntries.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-xs font-bold text-slate-500">
                            這個分類沒有可顯示的項目
                          </div>
                        ) : selectedCategory === 'fetched' || selectedCategory === 'unchanged' ? (
                            <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#101320]/70">
                              {selectedEntries.map((entry) => (
                                <div
                                  key={`${selectedCategory}-${entry.transactionId}`}
                                  className="border-b border-white/5 px-4 py-3 last:border-0"
                                >
                                  <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300">
                                    ID {entry.transactionId}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            selectedEntries.map((entry) => {
                              const before = toDisplayTransaction(entry.before);
                              const after = toDisplayTransaction(entry.after);
                              const showTwoSnapshots = Boolean(before && after && entry.reason !== 'cloud_only' && entry.reason !== 'local_only');
                              const showSingleAfter = !showTwoSnapshots && Boolean(after);
                              const showSingleBefore = !showTwoSnapshots && !after && Boolean(before);
                              const showMetadataOnly = !showTwoSnapshots && !showSingleAfter && !showSingleBefore;
                              const metaSlot = (
                                <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-3">
                                  <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300">
                                    ID {entry.transactionId}
                                  </span>
                                  <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300">
                                    {REASON_LABELS[entry.reason]}
                                  </span>
                                </div>
                              );
                              const errorSlot = entry.errorMessage ? (
                                <div className="border-b border-white/5 px-4 py-3 text-xs font-bold text-rose-200">
                                  {entry.errorMessage}
                                </div>
                              ) : null;

                              return (
                                <div key={`${selectedCategory}-${entry.transactionId}`} className="space-y-3">
                                  {showTwoSnapshots && before && after && (
                                    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#101320]/70">
                                      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-3">
                                        <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300">
                                          ID {entry.transactionId}
                                        </span>
                                        <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300">
                                          {REASON_LABELS[entry.reason]}
                                        </span>
                                      </div>
                                      {errorSlot}
                                      <div className="grid grid-cols-1 xl:grid-cols-2">
                                        <div className="border-b border-white/5 xl:border-b-0 xl:border-r">
                                          <div className="px-4 pt-4">
                                            <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300">Before</span>
                                          </div>
                                          <TransactionItem transaction={before} showDateTime />
                                        </div>
                                        <div>
                                          <div className="px-4 pt-4">
                                            <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300">After</span>
                                          </div>
                                          <TransactionItem transaction={after} showDateTime />
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {showSingleAfter && after && (
                                    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#101320]/70">
                                      {metaSlot}
                                      {errorSlot}
                                      <TransactionItem transaction={after} showDateTime />
                                    </div>
                                  )}

                                  {showSingleBefore && before && (
                                    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#101320]/70">
                                      {metaSlot}
                                      {errorSlot}
                                      <TransactionItem transaction={before} showDateTime />
                                    </div>
                                  )}

                                  {showMetadataOnly && (
                                    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#101320]/70">
                                      {metaSlot}
                                      {entry.errorMessage && (
                                        <div className="px-4 py-3 text-xs font-bold text-rose-200">
                                          {entry.errorMessage}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {reportIdPendingDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#171a29] p-6 shadow-2xl">
            <h2 className="text-lg font-black text-white">刪除同步報告</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              這只會刪掉本地保存的同步報告，不會回滾或刪除任何交易資料。
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReportIdPendingDelete(null)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="rounded-2xl border border-rose-400/25 bg-rose-500/15 px-4 py-3 text-sm font-black text-rose-200 disabled:opacity-40"
              >
                {isDeleting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PullReportsPage;
