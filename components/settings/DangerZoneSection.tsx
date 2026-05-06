import React from 'react';
import { FlaskConical, Trash2 } from 'lucide-react';
import SettingsSection, {
  sectionCyanButtonClassName,
  sectionLabelClassName,
  sectionPanelClassName,
  sectionRedButtonClassName,
} from './SettingsSection';

interface DangerZoneSectionProps {
  onResetLocalData: () => void;
  onInsertExamples: () => void;
}

const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({
  onResetLocalData,
  onInsertExamples,
}) => {
  return (
    <SettingsSection>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={`${sectionPanelClassName} flex h-full flex-col`}>
          <div className="mb-4 space-y-1">
            <p className={sectionLabelClassName}>Reset Local Data</p>
            <p className="text-sm text-slate-300">清除 Local Storage 與 IndexedDB，並重新載入頁面。</p>
          </div>
          <button type="button" onClick={onResetLocalData} className={`${sectionRedButtonClassName} mt-auto w-full`}>
            <Trash2 size={16} />
            清除本機資料並重置
          </button>
        </div>

        <div className={`${sectionPanelClassName} flex h-full flex-col`}>
          <div className="mb-4 space-y-1">
            <p className={sectionLabelClassName}>Insert Sample Data</p>
            <p className="text-sm text-slate-300">手動插入預設範例交易，方便驗證畫面或 demo。</p>
          </div>
          <button type="button" onClick={onInsertExamples} className={`${sectionCyanButtonClassName} mt-auto w-full`}>
            <FlaskConical size={16} />
            插入範例資料
          </button>
        </div>
      </div>
    </SettingsSection>
  );
};

export default DangerZoneSection;
