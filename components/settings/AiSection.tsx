import React from 'react';
import { KeyRound, Sparkles } from 'lucide-react';
import SettingsSection, {
  sectionCyanButtonClassName,
  sectionInputClassName,
  sectionLabelClassName,
  sectionPanelClassName,
} from './SettingsSection';

interface AiSectionProps {
  geminiApiKeyInput: string;
  hasGeminiApiKey: boolean;
  isOffline: boolean;
  onGeminiApiKeyInputChange: (value: string) => void;
  onSaveGeminiApiKey: () => void;
}

const AiSection: React.FC<AiSectionProps> = ({
  geminiApiKeyInput,
  hasGeminiApiKey,
  isOffline,
  onGeminiApiKeyInputChange,
  onSaveGeminiApiKey,
}) => {
  return (
    <SettingsSection
      title="AI 設定"
      description="設定 Gemini API key，讓新增交易可使用 AI 快速填寫。"
      icon={Sparkles}
      accentClassName="border-cyan-400/20 bg-cyan-500/12 text-cyan-200"
    >
      <div className={sectionPanelClassName}>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className={sectionLabelClassName}>Gemini API Key</label>
            <input
              type="password"
              value={geminiApiKeyInput}
              onChange={(e) => onGeminiApiKeyInputChange(e.target.value)}
              placeholder="輸入 Gemini API key"
              className={sectionInputClassName}
            />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <button type="button" onClick={onSaveGeminiApiKey} className={sectionCyanButtonClassName}>
              <KeyRound size={16} />
              儲存 AI 設定
            </button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-slate-300">
            {hasGeminiApiKey ? 'Gemini API key 已儲存於此瀏覽器；清空欄位後儲存即可移除。' : '尚未設定 Gemini API key，AI 快速填寫已停用。'}
          </div>
        </div>
      </div>
      {isOffline && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-200">
          目前離線，AI 解析需要恢復網路後才能使用。
        </div>
      )}
    </SettingsSection>
  );
};

export default AiSection;
