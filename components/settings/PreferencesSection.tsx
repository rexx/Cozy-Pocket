import React from 'react';
import { CreditCard, Eye, EyeOff, Type, type LucideIcon } from 'lucide-react';
import { getCurrencyDisplay, SUPPORTED_CURRENCIES } from '../../constants';
import { type PaymentMethodDisplayMode } from '../../types';
import SettingsSection, {
  sectionLabelClassName,
  sectionPanelClassName,
  sectionSelectClassName,
} from './SettingsSection';

interface PreferencesSectionProps {
  defaultCurrency: string;
  enabledCurrencies: string[];
  paymentMethodDisplayMode: PaymentMethodDisplayMode;
  homeNavArrowsVisible: boolean;
  onDefaultCurrencyChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onEnabledCurrencyToggle: (currency: string) => void;
  onPaymentMethodDisplayModeChange: (mode: PaymentMethodDisplayMode) => void;
  onHomeNavArrowsVisibleChange: (visible: boolean) => void;
}

const PAYMENT_METHOD_DISPLAY_OPTIONS: Array<{
  value: PaymentMethodDisplayMode;
  label: string;
  Icon: LucideIcon;
}> = [
  { value: 'text', label: '文字', Icon: Type },
  { value: 'icon', label: '圖示', Icon: CreditCard },
];

const HOME_NAV_ARROWS_OPTIONS: Array<{
  value: boolean;
  label: string;
  Icon: LucideIcon;
}> = [
  { value: true, label: '顯示', Icon: Eye },
  { value: false, label: '隱藏', Icon: EyeOff },
];

const PreferencesSection: React.FC<PreferencesSectionProps> = ({
  defaultCurrency,
  enabledCurrencies,
  paymentMethodDisplayMode,
  homeNavArrowsVisible,
  onDefaultCurrencyChange,
  onEnabledCurrencyToggle,
  onPaymentMethodDisplayModeChange,
  onHomeNavArrowsVisibleChange,
}) => {
  const getCurrencyOptionLabel = (currency: string) => `${currency} (${getCurrencyDisplay(currency)})`;

  return (
    <SettingsSection>
      <div className={sectionPanelClassName}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className={sectionLabelClassName}>Payment Method Display</p>
            <p className="text-sm text-slate-300">控制交易列表中的支付方式要顯示為圖示或文字。</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-[#0f1321] p-1 sm:w-auto sm:min-w-[11rem]">
            {PAYMENT_METHOD_DISPLAY_OPTIONS.map((option) => {
              const OptionIcon = option.Icon;
              const isActive = paymentMethodDisplayMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onPaymentMethodDisplayModeChange(option.value)}
                  aria-pressed={isActive}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-[0.9rem] px-3 text-sm font-black transition-all ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.12)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <OptionIcon size={15} strokeWidth={2.4} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={sectionPanelClassName}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className={sectionLabelClassName}>Home Navigation Buttons</p>
            <p className="text-sm text-slate-300">控制首頁月曆與交易列表的左右切換按鈕是否顯示；隱藏後仍可左右滑動切換。</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-[#0f1321] p-1 sm:w-auto sm:min-w-[11rem]">
            {HOME_NAV_ARROWS_OPTIONS.map((option) => {
              const OptionIcon = option.Icon;
              const isActive = homeNavArrowsVisible === option.value;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => onHomeNavArrowsVisibleChange(option.value)}
                  aria-pressed={isActive}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-[0.9rem] px-3 text-sm font-black transition-all ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.12)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <OptionIcon size={15} strokeWidth={2.4} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={sectionPanelClassName}>
        <div className="space-y-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className={sectionLabelClassName}>Currency Options</p>
              <p className="text-sm text-slate-300">新增交易時預設帶入的幣別，並控制交易表單可循環切換的幣別。</p>
            </div>
            <select
              value={defaultCurrency}
              onChange={onDefaultCurrencyChange}
              className={`${sectionSelectClassName} w-full sm:min-w-[11rem] sm:w-auto`}
            >
              {enabledCurrencies.map((currency) => (
                <option key={currency} value={currency}>
                  {getCurrencyOptionLabel(currency)}
                </option>
              ))}
            </select>
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
          <p className="text-xs text-slate-500">至少要保留一個幣別；未勾選的幣別不會出現在新增交易的循環切換中。</p>
        </div>
      </div>
    </SettingsSection>
  );
};

export default PreferencesSection;
