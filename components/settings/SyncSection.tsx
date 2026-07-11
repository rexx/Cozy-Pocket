import React, { useEffect, useState } from 'react';
import { CloudDownload, CloudUpload, Database, History, Save } from 'lucide-react';
import { PullReport } from '../../types';
import SettingsSection, {
  sectionCyanButtonClassName,
  sectionInputClassName,
  sectionLabelClassName,
  sectionPanelClassName,
  sectionSecondaryButtonClassName,
} from './SettingsSection';
import { idleStatus, type SettingsStatus, type SettingsStatusAction } from './settingsStatus';
import { SettingsStatusCard } from './SettingsFeedbackCard';

const MOCK_SYNC_API_URL = 'mock://cloud-sync';
const MOCK_SYNC_TOKEN = 'mock-token';

interface SyncSectionProps {
  syncApiUrl: string;
  syncToken: string;
  setSyncApiUrl: (value: string) => void;
  setSyncToken: (value: string) => void;
  onSaveSyncConfig: () => Promise<{ total: number; failed: number; skippedOffline: boolean }>;
  onOpenSyncProgress: () => void;
  onOpenPullReports: (reportId?: string) => void;
  onPullFromCloud: (year: string) => Promise<{ report: PullReport }>;
  pullYearOptions: string[];
  onNotify: (message: string) => void;
  isOffline: boolean;
}

const SyncSection: React.FC<SyncSectionProps> = ({
  syncApiUrl,
  syncToken,
  setSyncApiUrl,
  setSyncToken,
  onSaveSyncConfig,
  onOpenSyncProgress,
  onOpenPullReports,
  onPullFromCloud,
  pullYearOptions,
  onNotify,
  isOffline,
}) => {
  const [status, setStatus] = useState<SettingsStatus>(idleStatus);
  const [isPullDialogOpen, setIsPullDialogOpen] = useState(false);
  const [selectedPullYear, setSelectedPullYear] = useState('');
  const [isPullSubmitting, setIsPullSubmitting] = useState(false);
  const openSyncProgressAction: SettingsStatusAction = { label: '查看同步狀態', onClick: onOpenSyncProgress };

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

  const handleSaveSyncConfig = async () => {
    try {
      const syncResult = await onSaveSyncConfig();
      if (syncResult.skippedOffline) {
        setStatus({
          type: 'success',
          message: '同步設定已儲存\n目前離線，待恢復連線後再同步',
        });
      } else if (syncResult.failed > 0) {
        setStatus({
          type: 'error',
          message: `同步設定已儲存\n同步失敗 ${syncResult.failed}/${syncResult.total} 筆`,
          action: openSyncProgressAction,
        });
      } else {
        onNotify('同步設定已儲存');
        setStatus(idleStatus);
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: `同步設定儲存失敗: ${err.message}` });
    }
  };

  const handleUseMockSyncConfig = () => {
    setSyncApiUrl(MOCK_SYNC_API_URL);
    setSyncToken(MOCK_SYNC_TOKEN);
    setStatus({
      type: 'success',
      message: '已填入 mock API 設定\n按「儲存同步設定」後即可使用本機 mock cloud 測試。',
    });
  };

  const openPullDialog = () => {
    setStatus(idleStatus);
    setIsPullDialogOpen(true);
  };

  const closePullDialog = () => {
    if (isPullSubmitting) return;
    setIsPullDialogOpen(false);
  };

  const handlePullFromCloud = async () => {
    if (!selectedPullYear) {
      setStatus({ type: 'error', message: '請先選擇要同步的年份' });
      return;
    }

    try {
      setIsPullSubmitting(true);
      setStatus(idleStatus);
      const { report } = await onPullFromCloud(selectedPullYear);
      setIsPullDialogOpen(false);
      // Navigating to PullReportsPage unmounts this section, so the outcome
      // is surfaced via toast plus the focused report instead of inline status.
      onOpenPullReports(report.id);

      if (report.status === 'failed') {
        onNotify(`${report.year} 年年度雲端同步失敗`);
      } else if (report.status === 'partial') {
        onNotify(`已完成 ${report.year} 年年度雲端同步，但有部分失敗`);
      } else {
        onNotify(`已完成 ${report.year} 年年度雲端同步`);
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || '年度雲端同步失敗' });
    } finally {
      setIsPullSubmitting(false);
    }
  };

  return (
    <SettingsSection>
      <div className={sectionPanelClassName}>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className={sectionLabelClassName}>Sync API URL</label>
            <input
              type="text"
              value={syncApiUrl}
              onChange={(e) => setSyncApiUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className={sectionInputClassName}
            />
          </div>
          <div className="space-y-2">
            <label className={sectionLabelClassName}>Sync Token</label>
            <input
              type="password"
              value={syncToken}
              onChange={(e) => setSyncToken(e.target.value)}
              placeholder="輸入 GAS token"
              className={sectionInputClassName}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void handleSaveSyncConfig()} className={sectionCyanButtonClassName}>
              <Save size={16} />
              儲存同步設定
            </button>
            <button type="button" onClick={onOpenSyncProgress} className={sectionSecondaryButtonClassName}>
              <CloudUpload size={16} />
              開啟同步狀態頁
            </button>
            <button type="button" onClick={openPullDialog} className={sectionSecondaryButtonClassName}>
              <CloudDownload size={16} />
              執行年度雲端同步
            </button>
            <button type="button" onClick={() => onOpenPullReports()} className={sectionSecondaryButtonClassName}>
              <History size={16} />
              查看同步紀錄
            </button>
            <button type="button" onClick={handleUseMockSyncConfig} className={sectionSecondaryButtonClassName}>
              <Database size={16} />
              使用 mock API
            </button>
          </div>
        </div>
      </div>
      {isOffline && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-200">
          目前離線，可先記帳；同步會在恢復連線後再執行。
        </div>
      )}

      <SettingsStatusCard status={status} />

      {isPullDialogOpen && (
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
                onClick={closePullDialog}
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
    </SettingsSection>
  );
};

export default SyncSection;
