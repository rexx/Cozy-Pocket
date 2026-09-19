import React, { useState } from 'react';
import { CloudDownload, CloudUpload, Database, History, Save } from 'lucide-react';
import { PullReport, SyncOutcome } from '../../types';
import SettingsSection, {
  sectionCyanButtonClassName,
  sectionInputClassName,
  sectionLabelClassName,
  sectionPanelClassName,
  sectionSecondaryButtonClassName,
} from './SettingsSection';
import {
  applyOperationMessage,
  idleStatus,
  type SettingsStatus,
  type SettingsStatusAction,
} from './settingsStatus';
import { buildSyncedOperationMessage } from '../../services/notificationMessageService';
import { SettingsStatusCard } from './SettingsFeedbackCard';
import PullYearDialog from './PullYearDialog';

const MOCK_SYNC_API_URL = 'mock://cloud-sync';
const MOCK_SYNC_TOKEN = 'mock-token';

interface SyncSectionProps {
  syncApiUrl: string;
  syncToken: string;
  setSyncApiUrl: (value: string) => void;
  setSyncToken: (value: string) => void;
  onSaveSyncConfig: () => Promise<SyncOutcome>;
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
  const openSyncProgressAction: SettingsStatusAction = { label: '查看同步狀態', onClick: onOpenSyncProgress };

  const handleSaveSyncConfig = async () => {
    try {
      const syncResult = await onSaveSyncConfig();
      applyOperationMessage(
        buildSyncedOperationMessage('同步設定已儲存', syncResult),
        { notify: onNotify, setStatus, syncProgressAction: openSyncProgressAction }
      );
    } catch (err: any) {
      setStatus({ type: 'error', message: `同步設定儲存失敗: ${err.message}` });
    }
  };

  const handleUseMockSyncConfig = () => {
    setSyncApiUrl(MOCK_SYNC_API_URL);
    setSyncToken(MOCK_SYNC_TOKEN);
    setStatus({
      type: 'info',
      message: '已填入 mock API 設定\n按「儲存同步設定」後即可使用本機 mock cloud 測試。',
    });
  };

  const openPullDialog = () => {
    setStatus(idleStatus);
    setIsPullDialogOpen(true);
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

      <PullYearDialog
        isOpen={isPullDialogOpen}
        onClose={() => setIsPullDialogOpen(false)}
        pullYearOptions={pullYearOptions}
        onPullFromCloud={onPullFromCloud}
        onOpenPullReports={onOpenPullReports}
        onNotify={onNotify}
      />
    </SettingsSection>
  );
};

export default SyncSection;
