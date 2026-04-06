import React from 'react';
import { CloudUpload } from 'lucide-react';
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
  isOffline: boolean;
}

const SyncSection: React.FC<SyncSectionProps> = ({
  syncApiUrl,
  syncToken,
  setSyncApiUrl,
  setSyncToken,
  onSaveSyncConfig,
  onOpenSyncProgress,
  isOffline,
}) => {
  return (
    <SettingsSection
      title="同步設定"
      description="管理雲端同步端點與手動查看同步進度。"
      icon={CloudUpload}
      accentClassName="border-indigo-400/20 bg-indigo-500/12 text-indigo-200"
    >
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
              儲存同步設定
            </button>
            <button type="button" onClick={onOpenSyncProgress} className={sectionSecondaryButtonClassName}>
              <CloudUpload size={16} />
              開啟同步狀態頁
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
