import React from 'react';
import { CloudDownload, CloudUpload, Database, History, Save } from 'lucide-react';
import SettingsSection, {
  sectionCyanButtonClassName,
  sectionInputClassName,
  sectionLabelClassName,
  sectionPanelClassName,
  sectionSecondaryButtonClassName,
} from './SettingsSection';

interface SyncSectionProps {
  syncApiUrl: string;
  syncToken: string;
  setSyncApiUrl: (value: string) => void;
  setSyncToken: (value: string) => void;
  onSaveSyncConfig: () => void;
  onOpenSyncProgress: () => void;
  onOpenPullDialog: () => void;
  onOpenPullReports: () => void;
  onUseMockSyncConfig: () => void;
  isOffline: boolean;
}

const SyncSection: React.FC<SyncSectionProps> = ({
  syncApiUrl,
  syncToken,
  setSyncApiUrl,
  setSyncToken,
  onSaveSyncConfig,
  onOpenSyncProgress,
  onOpenPullDialog,
  onOpenPullReports,
  onUseMockSyncConfig,
  isOffline,
}) => {
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
            <button type="button" onClick={onSaveSyncConfig} className={sectionCyanButtonClassName}>
              <Save size={16} />
              儲存同步設定
            </button>
            <button type="button" onClick={onOpenSyncProgress} className={sectionSecondaryButtonClassName}>
              <CloudUpload size={16} />
              開啟同步狀態頁
            </button>
            <button type="button" onClick={onOpenPullDialog} className={sectionSecondaryButtonClassName}>
              <CloudDownload size={16} />
              執行年度雲端同步
            </button>
            <button type="button" onClick={onOpenPullReports} className={sectionSecondaryButtonClassName}>
              <History size={16} />
              查看同步紀錄
            </button>
            <button type="button" onClick={onUseMockSyncConfig} className={sectionSecondaryButtonClassName}>
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
    </SettingsSection>
  );
};

export default SyncSection;
