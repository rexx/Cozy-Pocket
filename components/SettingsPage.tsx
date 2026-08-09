
import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  ArrowLeft,
  ArrowUpDown,
  ChevronRight,
  CloudUpload,
  Globe,
  Sparkles,
  Store,
  Tags,
  type LucideIcon,
} from 'lucide-react';
import { PaymentMethodDisplayMode, PullReport, Transaction } from '../types';
import { db } from '../db';
import { format } from 'date-fns';
import { formatReadableDateTime, toEpochSeconds } from '../time';
import { SUPPORTED_CURRENCIES, getEnabledCurrencies, getPreferredCurrency } from '../constants';
import PageHeader from './PageHeader';
import { TagReplacementPreview, TagUsageSummary } from '../services/tagService';
import { MerchantRenamePreview, MerchantUsageSummary } from '../services/merchantService';
import PreferencesSection from './settings/PreferencesSection';
import AiSection from './settings/AiSection';
import SyncSection from './settings/SyncSection';
import TagManagementSection from './settings/TagManagementSection';
import MerchantManagementSection from './settings/MerchantManagementSection';
import ImportExportSection, { type ImportCommitResult, type ImportPreview } from './settings/ImportExportSection';
import DangerZoneSection from './settings/DangerZoneSection';
import { SETTINGS_SECTION_COPY } from './settings/settingsSectionCopy';
import { GEMINI_API_KEY_SETTING_KEY, PAYMENT_METHOD_DISPLAY_MODE_SETTING_KEY, HOME_NAV_ARROWS_VISIBLE_SETTING_KEY, ERROR_BANNER_VISIBLE_SETTING_KEY, getGeminiApiKey } from '../preferences';

export type SettingsSectionPage = keyof typeof SETTINGS_SECTION_COPY;

interface SettingsPageProps {
  section?: SettingsSectionPage | null;
  onClose: () => void;
  onCloseSection: () => void;
  onOpenSection: (section: SettingsSectionPage) => void;
  onDataChange: () => void;
  onInsertExamples: () => Promise<number>;
  onPreviewDeleteExamples: () => Promise<Transaction[]>;
  onDeleteExamples: (ids: string[]) => Promise<number>;
  onTriggerSync: (label: string) => Promise<{ total: number; failed: number; skippedOffline: boolean }>;
  onOpenSyncProgress: () => void;
  onOpenPullReports: (reportId?: string) => void;
  onPullFromCloud: (year: string) => Promise<{ report: PullReport }>;
  pullYearOptions: string[];
  onNotify: (message: string) => void;
  isOffline: boolean;
  paymentMethodDisplayMode: PaymentMethodDisplayMode;
  onPaymentMethodDisplayModeChange: (mode: PaymentMethodDisplayMode) => void;
  homeNavArrowsVisible: boolean;
  onHomeNavArrowsVisibleChange: (visible: boolean) => void;
  errorBannerVisible: boolean;
  onErrorBannerVisibleChange: (visible: boolean) => void;
  tagSummaries: TagUsageSummary[];
  merchantSummaries: MerchantUsageSummary[];
  onPreviewTagReplacement: (oldTag: string, replacementTags: string[]) => Promise<TagReplacementPreview>;
  onReplaceTag: (oldTag: string, replacementTags: string[]) => Promise<TagReplacementPreview & { skippedOffline: boolean; syncResult?: { total: number; failed: number; skippedOffline: boolean } }>;
  onGetTagTransactions: (tag: string) => Promise<Transaction[]>;
  onTagTransactionClick: (transaction: Transaction) => void;
  onPreviewMerchantRename: (oldMerchant: string, newMerchant: string) => Promise<MerchantRenamePreview>;
  onRenameMerchant: (oldMerchant: string, newMerchant: string) => Promise<MerchantRenamePreview & { skippedOffline: boolean; syncResult?: { total: number; failed: number; skippedOffline: boolean } }>;
  onGetMerchantTransactions: (merchant: string) => Promise<Transaction[]>;
  onMerchantTransactionClick: (transaction: Transaction) => void;
}

const CSV_HEADERS = ["id", "type", "amount", "currency", "categoryId", "subCategoryId", "name", "merchant", "note", "timestamp", "readableDateTime", "paymentMethod", "tags", "updatedAt", "version"];

const SECTION_GLOW_COLORS: Record<SettingsSectionPage | 'overview', string> = {
  overview: 'rgba(34,211,238,0.1)',
  preferences: 'rgba(34,211,238,0.1)',
  ai: 'rgba(34,211,238,0.1)',
  sync: 'rgba(99,102,241,0.12)',
  tags: 'rgba(34,211,238,0.1)',
  merchant: 'rgba(245,158,11,0.12)',
  'import-export': 'rgba(245,158,11,0.12)',
  danger: 'rgba(239,68,68,0.12)',
};

interface SettingsOverviewItem {
  section: SettingsSectionPage;
  title: string;
  description: string;
  meta: string;
  icon: LucideIcon;
  accentClassName: string;
}

const SettingsPage: React.FC<SettingsPageProps> = ({
  section = null,
  onClose,
  onCloseSection,
  onOpenSection,
  onDataChange,
  onInsertExamples,
  onPreviewDeleteExamples,
  onDeleteExamples,
  onTriggerSync,
  onOpenSyncProgress,
  onOpenPullReports,
  onPullFromCloud,
  pullYearOptions,
  onNotify,
  isOffline,
  paymentMethodDisplayMode,
  onPaymentMethodDisplayModeChange,
  homeNavArrowsVisible,
  onHomeNavArrowsVisibleChange,
  errorBannerVisible,
  onErrorBannerVisibleChange,
  tagSummaries,
  merchantSummaries,
  onPreviewTagReplacement,
  onReplaceTag,
  onGetTagTransactions,
  onTagTransactionClick,
  onPreviewMerchantRename,
  onRenameMerchant,
  onGetMerchantTransactions,
  onMerchantTransactionClick,
}) => {
  const [defaultCurrency, setDefaultCurrency] = useState('TWD');
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>([...SUPPORTED_CURRENCIES]);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
  const [hasGeminiApiKey, setHasGeminiApiKey] = useState(false);
  const [syncApiUrl, setSyncApiUrl] = useState('');
  const [syncToken, setSyncToken] = useState('');

  useEffect(() => {
    Promise.all([
      db.settings.get('defaultCurrency'),
      db.settings.get('enabledCurrencies'),
      db.settings.get(GEMINI_API_KEY_SETTING_KEY),
      db.settings.get('syncApiUrl'),
      db.settings.get('syncToken')
    ]).then(([currencySetting, enabledCurrenciesSetting, geminiApiKeySetting, apiUrlSetting, tokenSetting]) => {
      const nextEnabledCurrencies = getEnabledCurrencies(enabledCurrenciesSetting?.value);
      const savedGeminiApiKey = getGeminiApiKey(geminiApiKeySetting?.value);
      setEnabledCurrencies(nextEnabledCurrencies);
      setDefaultCurrency(getPreferredCurrency(currencySetting?.value, nextEnabledCurrencies));
      setGeminiApiKeyInput(savedGeminiApiKey);
      setHasGeminiApiKey(savedGeminiApiKey.length > 0);
      if (apiUrlSetting?.value) setSyncApiUrl(apiUrlSetting.value);
      if (tokenSetting?.value) setSyncToken(tokenSetting.value);
    });
  }, []);

  const handleDefaultCurrencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    setDefaultCurrency(newVal);
    await db.settings.put({ key: 'defaultCurrency', value: newVal });
    onDataChange();
  };

  const handleEnabledCurrencyToggle = async (currency: string) => {
    const isEnabled = enabledCurrencies.includes(currency);
    // Defensive invariant: never disable the last currency. The user-facing
    // warning for this case lives in PreferencesSection.
    if (isEnabled && enabledCurrencies.length === 1) return;

    const nextEnabledCurrencies = isEnabled
      ? enabledCurrencies.filter((item) => item !== currency)
      : SUPPORTED_CURRENCIES.filter((item) => item === currency || enabledCurrencies.includes(item));
    const nextDefaultCurrency = getPreferredCurrency(defaultCurrency, nextEnabledCurrencies);

    setEnabledCurrencies(nextEnabledCurrencies);
    setDefaultCurrency(nextDefaultCurrency);

    await db.settings.bulkPut([
      { key: 'enabledCurrencies', value: nextEnabledCurrencies },
      { key: 'defaultCurrency', value: nextDefaultCurrency }
    ]);
    onDataChange();
  };

  const handlePaymentMethodDisplayModeChange = async (mode: PaymentMethodDisplayMode) => {
    onPaymentMethodDisplayModeChange(mode);
    await db.settings.put({ key: PAYMENT_METHOD_DISPLAY_MODE_SETTING_KEY, value: mode });
    onDataChange();
  };

  const handleHomeNavArrowsVisibleChange = async (visible: boolean) => {
    onHomeNavArrowsVisibleChange(visible);
    await db.settings.put({ key: HOME_NAV_ARROWS_VISIBLE_SETTING_KEY, value: visible });
    onDataChange();
  };

  const handleErrorBannerVisibleChange = async (visible: boolean) => {
    onErrorBannerVisibleChange(visible);
    await db.settings.put({ key: ERROR_BANNER_VISIBLE_SETTING_KEY, value: visible });
    onDataChange();
  };

  const saveGeminiApiKey = async (): Promise<void> => {
    const trimmedApiKey = geminiApiKeyInput.trim();
    if (trimmedApiKey) {
      await db.settings.put({ key: GEMINI_API_KEY_SETTING_KEY, value: trimmedApiKey });
    } else {
      await db.settings.delete(GEMINI_API_KEY_SETTING_KEY);
    }
    setGeminiApiKeyInput(trimmedApiKey);
    setHasGeminiApiKey(trimmedApiKey.length > 0);
    onNotify(trimmedApiKey ? 'AI 設定已儲存' : 'AI 設定已清除');
    onDataChange();
  };

  const saveSyncConfig = async (): Promise<{ total: number; failed: number; skippedOffline: boolean }> => {
    await db.settings.bulkPut([
      { key: 'syncApiUrl', value: syncApiUrl.trim() },
      { key: 'syncToken', value: syncToken.trim() }
    ]);
    onDataChange();
    return onTriggerSync('同步設定後立即同步');
  };

  const exportToCSV = async (): Promise<void> => {
    const transactions = await db.transactions.toArray();
    const csvContent = [
      CSV_HEADERS.join(','),
      ...transactions.map(t => [
        t.id,
        t.type,
        t.amount,
        t.currency || 'TWD',
        t.categoryId,
        t.subCategoryId || '',
        t.name || '',
        t.merchant || '',
        t.note || '',
        t.timestamp,
        t.readableDateTime || formatReadableDateTime(t.timestamp),
        t.paymentMethod,
        t.tags || '',
        t.updatedAt || '',
        t.version || ''
      ].map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `cozy_pocket_backup_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const splitCSVIntoRows = (text: string) => {
    const rows: string[] = [];
    let currentRow = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      if (char === '"') {
        if (inQuotes && nextChar === '"') { currentRow += '""'; i++; }
        else { inQuotes = !inQuotes; currentRow += '"'; }
      } else if (!inQuotes && (char === '\n' || char === '\r')) {
        if (currentRow.trim().length > 0) rows.push(currentRow);
        currentRow = '';
        if (char === '\r' && nextChar === '\n') i++;
      } else { currentRow += char; }
    }
    if (currentRow.trim().length > 0) rows.push(currentRow);
    return rows;
  };

  const parseCSVLine = (line: string) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) { result.push(cur); cur = ''; }
      else { cur += char; }
    }
    result.push(cur);
    return result;
  };

  const parseImportFile = async (file: File): Promise<ImportPreview> => {
    const text = await file.text();
    if (!text) throw new Error('檔案內容為空');
    const lines = splitCSVIntoRows(text);
    if (lines.length < 2) throw new Error('檔案格式不正確或無資料');

    const parsedHeader = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
    const headers = parsedHeader.length > 0 ? parsedHeader : CSV_HEADERS;
    const dataRows = lines.slice(1);
    const parsedTransactions: Transaction[] = dataRows.map(line => {
      const values = parseCSVLine(line);
      const obj: any = {};
      headers.forEach((header, index) => {
        const val = values[index] || '';
        if (header === 'amount') obj[header] = parseFloat(val);
        else if (header === 'timestamp') obj[header] = toEpochSeconds(parseInt(val, 10));
        else if (header === 'updatedAt' || header === 'version') obj[header] = parseInt(val, 10);
        else obj[header] = val;
      });
      if (Number.isNaN(obj.timestamp) && obj.readableDateTime) {
        obj.timestamp = toEpochSeconds(new Date(obj.readableDateTime).getTime());
      }
      if (!obj.readableDateTime && Number.isFinite(obj.timestamp)) {
        obj.readableDateTime = formatReadableDateTime(obj.timestamp);
      }
      if (!obj.currency) obj.currency = 'TWD';
      return obj as Transaction;
    }).filter(t => !isNaN(t.amount) && !isNaN(t.timestamp));

    const idCountMap = new Map<string, number>();
    for (const tx of parsedTransactions) {
      const count = idCountMap.get(tx.id) || 0;
      idCountMap.set(tx.id, count + 1);
    }
    const duplicateInFileCount = Array.from(idCountMap.values()).filter((count) => count > 1).length;

    const uniqueIds = Array.from(idCountMap.keys());
    const existing = await db.transactions.bulkGet(uniqueIds);
    const duplicateWithExistingCount = existing.filter(Boolean).length;

    return {
      transactions: parsedTransactions,
      totalRows: dataRows.length,
      validRows: parsedTransactions.length,
      invalidRows: dataRows.length - parsedTransactions.length,
      duplicateWithExistingCount,
      duplicateInFileCount,
    };
  };

  const commitImport = async (
    transactions: Transaction[],
    mode: 'overwrite' | 'append'
  ): Promise<ImportCommitResult> => {
    let overwrittenCount = 0;
    if (mode === 'append') {
      const incomingIds = Array.from(new Set(transactions.map((tx) => tx.id)));
      const existing = await db.transactions.bulkGet(incomingIds);
      overwrittenCount = existing.filter(Boolean).length;
    }

    if (mode === 'overwrite') await db.transactions.clear();
    await db.transactions.bulkPut(transactions);
    onDataChange();
    const syncResult = await onTriggerSync('匯入後立即同步');
    return { ...syncResult, overwrittenCount };
  };

  const resetLocalData = async (): Promise<void> => {
    localStorage.clear();
    await db.delete();
  };

  const pageTitle = section ? SETTINGS_SECTION_COPY[section].title : '資料與設定';
  const pageBackgroundStyle: React.CSSProperties = {
    background: `radial-gradient(circle at top, ${SECTION_GLOW_COLORS[section || 'overview']}, transparent 28%), linear-gradient(180deg, #1f2235 0%, #171a29 48%, #121520 100%)`,
  };
  const overviewItems: SettingsOverviewItem[] = [
    {
      section: 'preferences',
      title: SETTINGS_SECTION_COPY.preferences.title,
      description: SETTINGS_SECTION_COPY.preferences.description,
      meta: `${defaultCurrency} · ${enabledCurrencies.length} 個可用幣別`,
      icon: Globe,
      accentClassName: 'border-cyan-400/20 bg-cyan-500/12 text-cyan-200',
    },
    {
      section: 'ai',
      title: SETTINGS_SECTION_COPY.ai.title,
      description: SETTINGS_SECTION_COPY.ai.description,
      meta: hasGeminiApiKey ? 'API key 已設定' : '尚未設定 API key',
      icon: Sparkles,
      accentClassName: 'border-cyan-400/20 bg-cyan-500/12 text-cyan-200',
    },
    {
      section: 'sync',
      title: SETTINGS_SECTION_COPY.sync.title,
      description: SETTINGS_SECTION_COPY.sync.description,
      meta: isOffline ? '目前離線' : '可執行同步',
      icon: CloudUpload,
      accentClassName: 'border-indigo-400/20 bg-indigo-500/12 text-indigo-200',
    },
    {
      section: 'tags',
      title: SETTINGS_SECTION_COPY.tags.title,
      description: SETTINGS_SECTION_COPY.tags.description,
      meta: `${tagSummaries.length} 個 tag`,
      icon: Tags,
      accentClassName: 'border-cyan-400/20 bg-cyan-500/12 text-cyan-200',
    },
    {
      section: 'merchant',
      title: SETTINGS_SECTION_COPY.merchant.title,
      description: SETTINGS_SECTION_COPY.merchant.description,
      meta: `${merchantSummaries.length} 個商家`,
      icon: Store,
      accentClassName: 'border-amber-400/20 bg-amber-500/12 text-amber-200',
    },
    {
      section: 'import-export',
      title: SETTINGS_SECTION_COPY['import-export'].title,
      description: SETTINGS_SECTION_COPY['import-export'].description,
      meta: 'CSV 備份與匯入',
      icon: ArrowUpDown,
      accentClassName: 'border-amber-400/20 bg-amber-500/12 text-amber-200',
    },
    {
      section: 'danger',
      title: SETTINGS_SECTION_COPY.danger.title,
      description: SETTINGS_SECTION_COPY.danger.description,
      meta: '重置 / 範例資料',
      icon: AlertOctagon,
      accentClassName: 'border-red-400/20 bg-red-500/12 text-red-200',
    },
  ];

  const renderOverview = () => (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {overviewItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.section}
              type="button"
              onClick={() => onOpenSection(item.section)}
              className="group flex min-h-[9.5rem] items-stretch gap-4 rounded-[28px] border border-white/8 bg-white/[0.045] p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-sm transition-colors hover:bg-white/[0.065] active:scale-[0.99] sm:p-6"
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${item.accentClassName}`}>
                <Icon size={20} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-black tracking-[0.02em] text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
                  </div>
                  <ChevronRight size={20} className="mt-0.5 shrink-0 text-slate-500 transition-colors group-hover:text-white" />
                </div>
                <p className="mt-auto pt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{item.meta}</p>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );

  const renderSection = () => {
    switch (section) {
      case 'preferences':
        return (
          <PreferencesSection
            defaultCurrency={defaultCurrency}
            enabledCurrencies={enabledCurrencies}
            paymentMethodDisplayMode={paymentMethodDisplayMode}
            homeNavArrowsVisible={homeNavArrowsVisible}
            errorBannerVisible={errorBannerVisible}
            onDefaultCurrencyChange={handleDefaultCurrencyChange}
            onEnabledCurrencyToggle={(currency) => void handleEnabledCurrencyToggle(currency)}
            onPaymentMethodDisplayModeChange={(mode) => void handlePaymentMethodDisplayModeChange(mode)}
            onHomeNavArrowsVisibleChange={(visible) => void handleHomeNavArrowsVisibleChange(visible)}
            onErrorBannerVisibleChange={(visible) => void handleErrorBannerVisibleChange(visible)}
            onNotify={onNotify}
          />
        );
      case 'ai':
        return (
          <AiSection
            geminiApiKeyInput={geminiApiKeyInput}
            hasGeminiApiKey={hasGeminiApiKey}
            isOffline={isOffline}
            onGeminiApiKeyInputChange={setGeminiApiKeyInput}
            onSaveGeminiApiKey={saveGeminiApiKey}
          />
        );
      case 'sync':
        return (
          <SyncSection
            syncApiUrl={syncApiUrl}
            syncToken={syncToken}
            setSyncApiUrl={setSyncApiUrl}
            setSyncToken={setSyncToken}
            onSaveSyncConfig={saveSyncConfig}
            onOpenSyncProgress={onOpenSyncProgress}
            onOpenPullReports={onOpenPullReports}
            onPullFromCloud={onPullFromCloud}
            pullYearOptions={pullYearOptions}
            onNotify={onNotify}
            isOffline={isOffline}
          />
        );
      case 'tags':
        return (
          <TagManagementSection
            tagSummaries={tagSummaries}
            paymentMethodDisplayMode={paymentMethodDisplayMode}
            onPreviewTagReplacement={onPreviewTagReplacement}
            onReplaceTag={onReplaceTag}
            onGetTagTransactions={onGetTagTransactions}
            onTagTransactionClick={onTagTransactionClick}
            onDataChange={onDataChange}
            onOpenSyncProgress={onOpenSyncProgress}
            onNotify={onNotify}
          />
        );
      case 'merchant':
        return (
          <MerchantManagementSection
            merchantSummaries={merchantSummaries}
            paymentMethodDisplayMode={paymentMethodDisplayMode}
            onPreviewMerchantRename={onPreviewMerchantRename}
            onRenameMerchant={onRenameMerchant}
            onGetMerchantTransactions={onGetMerchantTransactions}
            onMerchantTransactionClick={onMerchantTransactionClick}
            onDataChange={onDataChange}
            onOpenSyncProgress={onOpenSyncProgress}
            onNotify={onNotify}
          />
        );
      case 'import-export':
        return (
          <ImportExportSection
            onExportToCsv={exportToCSV}
            onParseImportFile={parseImportFile}
            onCommitImport={commitImport}
            onOpenSyncProgress={onOpenSyncProgress}
            onNotify={onNotify}
          />
        );
      case 'danger':
        return (
          <DangerZoneSection
            onResetLocalData={resetLocalData}
            onInsertExamples={onInsertExamples}
            onPreviewDeleteExamples={onPreviewDeleteExamples}
            onDeleteExamples={onDeleteExamples}
            onDataChange={onDataChange}
            onNotify={onNotify}
          />
        );
      default:
        return renderOverview();
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#1a1c2c] select-none overflow-hidden text-slate-200">
      <div className="flex-none">
        <PageHeader
          title={pageTitle}
          leftAction={<ArrowLeft size={26} />}
          onLeftAction={section ? onCloseSection : onClose}
        />
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 pt-6 sm:px-6 sm:pt-8 no-scrollbar"
        style={pageBackgroundStyle}
      >
        <div className="mx-auto max-w-6xl space-y-6 pb-10">
          {section && (
            <p className="mx-auto max-w-3xl text-center text-sm font-semibold leading-relaxed text-slate-400">
              {SETTINGS_SECTION_COPY[section].description}
            </p>
          )}
          {renderSection()}
          <p className="pt-6 text-center text-[10px] font-bold uppercase tracking-[0.4em] text-gray-700 opacity-15">
            Cozy Pocket • Minimalism
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
