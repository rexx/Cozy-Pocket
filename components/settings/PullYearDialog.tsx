import React, { useEffect, useState } from 'react';
import { PullReport } from '../../types';
import { idleStatus, type SettingsStatus } from './settingsStatus';
import { describePullReportOutcome } from '../../services/notificationMessageService';
import { SettingsStatusCard } from './SettingsFeedbackCard';

interface PullYearDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pullYearOptions: string[];
  onPullFromCloud: (year: string) => Promise<{ report: PullReport }>;
  onOpenPullReports: (reportId?: string) => void;
  onNotify: (message: string) => void;
}

const PullYearDialog: React.FC<PullYearDialogProps> = ({
  isOpen,
  onClose,
  pullYearOptions,
  onPullFromCloud,
  onOpenPullReports,
  onNotify,
}) => {
  const [status, setStatus] = useState<SettingsStatus>(idleStatus);
  const [selectedPullYear, setSelectedPullYear] = useState('');
  const [isPullSubmitting, setIsPullSubmitting] = useState(false);

  useEffect(() => {
    if (pullYearOptions.length === 0) {
      setSelectedPullYear('');
      return;
    }

    setSelectedPullYear((current) => (
      current && pullYearOptions.includes(current)
        ? current
        : pullYearOptions[0]
    ));
  }, [pullYearOptions]);

  // Every opening starts from a clean slate. The status card lives outside the
  // overlay so a failed attempt stays readable after the dialog is dismissed.
  useEffect(() => {
    if (isOpen) {
      setStatus(idleStatus);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isPullSubmitting) return;
    onClose();
  };

  const handlePullFromCloud = async () => {
    if (!selectedPullYear) {
      setStatus({ type: 'warning', message: '請先選擇要同步的年份' });
      return;
    }

    try {
      setIsPullSubmitting(true);
      setStatus(idleStatus);
      const { report } = await onPullFromCloud(selectedPullYear);
      onClose();
      // Navigating to PullReportsPage unmounts this dialog, so the outcome
      // is surfaced via toast plus the focused report instead of inline status.
      onOpenPullReports(report.id);

      onNotify(describePullReportOutcome(report.year, report.status));
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || '年度雲端同步失敗' });
    } finally {
      setIsPullSubmitting(false);
    }
  };

  return (
    <>
      <SettingsStatusCard status={status} />

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#171a29] p-6 shadow-2xl">
            <h2 className="text-lg font-black text-white">年度雲端同步</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              一次只處理單一年份。系統會先讀取該年份雲端資料，再依 version 與 updatedAt 自動判斷要更新本機或回推雲端，並留下完整同步報告。
            </p>

            <div className="mt-5 space-y-3">
              <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                選擇年份
              </label>
              <select
                value={selectedPullYear}
                onChange={(e) => setSelectedPullYear(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#0f1321] px-3 py-3 text-sm font-bold text-white outline-none"
              >
                {pullYearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handlePullFromCloud()}
                disabled={isPullSubmitting || !selectedPullYear}
                className="rounded-2xl border border-cyan-400/25 bg-cyan-500/15 px-4 py-3 text-sm font-black text-cyan-200 disabled:opacity-40"
              >
                {isPullSubmitting ? '處理中...' : '開始同步'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PullYearDialog;
