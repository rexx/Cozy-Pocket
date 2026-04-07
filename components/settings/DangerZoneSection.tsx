import React from 'react';
import { AlertOctagon, FlaskConical, Trash2 } from 'lucide-react';
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
    <SettingsSection
      title="危險操作"
      description="重置本機資料，或加入範例資料。"
      icon={AlertOctagon}
      accentClassName="border-red-400/20 bg-red-500/12 text-red-200"
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={`${sectionPanelClassName} flex h-full flex-col`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/12 text-red-200">
              <Trash2 size={18} />
            </div>
            <div>
              <p className={sectionLabelClassName}>Reset Local Data</p>
              <p className="text-sm text-slate-300">清除 Local Storage 與 IndexedDB，並重新載入頁面。</p>
            </div>
          </div>
          <button type="button" onClick={onResetLocalData} className={`${sectionRedButtonClassName} mt-auto w-full`}>
            清除本機資料並重置
          </button>
        </div>

        <div className={`${sectionPanelClassName} flex h-full flex-col`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/12 text-cyan-200">
              <FlaskConical size={18} />
            </div>
            <div>
              <p className={sectionLabelClassName}>Insert Sample Data</p>
              <p className="text-sm text-slate-300">手動插入預設範例交易，方便驗證畫面或 demo。</p>
            </div>
          </div>
          <button type="button" onClick={onInsertExamples} className={`${sectionCyanButtonClassName} mt-auto w-full`}>
            插入範例資料
          </button>
        </div>
      </div>
    </SettingsSection>
  );
};

export default DangerZoneSection;
