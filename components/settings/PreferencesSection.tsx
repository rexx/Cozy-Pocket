import React from 'react';
import { Globe } from 'lucide-react';
import { getCurrencyDisplay, SUPPORTED_CURRENCIES } from '../../constants';
import SettingsSection, {
  sectionLabelClassName,
  sectionPanelClassName,
  sectionSelectClassName,
} from './SettingsSection';

interface PreferencesSectionProps {
  defaultCurrency: string;
  enabledCurrencies: string[];
  onDefaultCurrencyChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onEnabledCurrencyToggle: (currency: string) => void;
}

const PreferencesSection: React.FC<PreferencesSectionProps> = ({
  defaultCurrency,
  enabledCurrencies,
  onDefaultCurrencyChange,
  onEnabledCurrencyToggle,
}) => {
  const getCurrencyOptionLabel = (currency: string) => `${currency} (${getCurrencyDisplay(currency)})`;

  return (
    <SettingsSection
      title="偏好設定"
      description="管理預設幣別與交易表單中的幣別切換選單。"
      icon={Globe}
      accentClassName="border-cyan-400/20 bg-cyan-500/12 text-cyan-200"
    >
      <div className={`${sectionPanelClassName} flex items-center justify-between gap-4`}>
        <div className="space-y-1">
          <p className={sectionLabelClassName}>Default Currency</p>
          <p className="text-sm text-slate-300">新增交易時預設帶入的幣別。</p>
        </div>
        <select
          value={defaultCurrency}
          onChange={onDefaultCurrencyChange}
          className={`${sectionSelectClassName} min-w-[11rem]`}
        >
          {enabledCurrencies.map((currency) => (
            <option key={currency} value={currency}>
              {getCurrencyOptionLabel(currency)}
            </option>
          ))}
        </select>
      </div>

      <div className={sectionPanelClassName}>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className={sectionLabelClassName}>Enabled Currencies</p>
            <p className="text-sm text-slate-300">控制新增交易畫面可循環切換的幣別。</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black text-slate-400">
            {enabledCurrencies.length} / {SUPPORTED_CURRENCIES.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SUPPORTED_CURRENCIES.map((currency) => {
            const checked = enabledCurrencies.includes(currency);
            return (
              <label
                key={currency}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-bold transition-colors ${
                  checked
                    ? 'border-cyan-400/25 bg-cyan-500/12 text-white'
                    : 'border-white/10 bg-[#0f1321] text-slate-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onEnabledCurrencyToggle(currency)}
                  className="h-4 w-4 accent-cyan-400"
                />
                <span>{getCurrencyOptionLabel(currency)}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">至少要保留一個幣別；未勾選的幣別不會出現在新增交易的循環切換中。</p>
      </div>
    </SettingsSection>
  );
};

export default PreferencesSection;
