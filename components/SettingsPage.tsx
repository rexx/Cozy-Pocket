
import React, { useRef, useState, useEffect } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  CheckCircle2,
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
import { SUPPORTED_CURRENCIES, formatCurrencyAmount, getEnabledCurrencies, getPreferredCurrency } from '../constants';
import PageHeader from './PageHeader';
import { TagRenamePreview, TagUsageSummary, normalizeTag } from '../services/tagService';
import { MerchantRenamePreview, MerchantUsageSummary, normalizeMerchantName } from '../services/merchantService';
import PreferencesSection from './settings/PreferencesSection';
import AiSection from './settings/AiSection';
import SyncSection from './settings/SyncSection';
import TagManagementSection from './settings/TagManagementSection';
import MerchantManagementSection from './settings/MerchantManagementSection';
import ImportExportSection from './settings/ImportExportSection';
import DangerZoneSection from './settings/DangerZoneSection';
import { SETTINGS_SECTION_COPY } from './settings/settingsSectionCopy';
import { idleStatus, type SettingsStatus } from './settings/settingsStatus';
import { confirmAction } from '../services/dialogService';
import { GEMINI_API_KEY_SETTING_KEY, PAYMENT_METHOD_DISPLAY_MODE_SETTING_KEY, HOME_NAV_ARROWS_VISIBLE_SETTING_KEY, getGeminiApiKey } from '../preferences';

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
  tagSummaries: TagUsageSummary[];
  merchantSummaries: MerchantUsageSummary[];
  onPreviewTagRename: (oldTag: string, newTag: string) => Promise<TagRenamePreview>;
  onRenameTag: (oldTag: string, newTag: string) => Promise<TagRenamePreview & { skippedOffline: boolean; syncResult?: { total: number; failed: number; skippedOffline: boolean } }>;
  onGetTagTransactions: (tag: string) => Promise<Transaction[]>;
  onTagTransactionClick: (transaction: Transaction) => void;
  onPreviewMerchantRename: (oldMerchant: string, newMerchant: string) => Promise<MerchantRenamePreview>;
  onRenameMerchant: (oldMerchant: string, newMerchant: string) => Promise<MerchantRenamePreview & { skippedOffline: boolean; syncResult?: { total: number; failed: number; skippedOffline: boolean } }>;
  onGetMerchantTransactions: (merchant: string) => Promise<Transaction[]>;
  onMerchantTransactionClick: (transaction: Transaction) => void;
}

const CSV_HEADERS = ["id", "type", "amount", "currency", "categoryId", "subCategoryId", "name", "merchant", "note", "timestamp", "readableDateTime", "paymentMethod", "tags", "updatedAt", "version"];

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] || ch);
const MOCK_SYNC_API_URL = 'mock://cloud-sync';
const MOCK_SYNC_TOKEN = 'mock-token';

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
  tagSummaries,
  merchantSummaries,
  onPreviewTagRename,
  onRenameTag,
  onGetTagTransactions,
  onTagTransactionClick,
  onPreviewMerchantRename,
  onRenameMerchant,
  onGetMerchantTransactions,
  onMerchantTransactionClick,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<SettingsStatus>(idleStatus);
  const openSyncProgressAction = { label: '查看同步狀態', onClick: onOpenSyncProgress };
  const [defaultCurrency, setDefaultCurrency] = useState('TWD');
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>([...SUPPORTED_CURRENCIES]);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
  const [hasGeminiApiKey, setHasGeminiApiKey] = useState(false);
  const [syncApiUrl, setSyncApiUrl] = useState('');
  const [syncToken, setSyncToken] = useState('');
  const [selectedImportFileName, setSelectedImportFileName] = useState('');
  const [isParsingImportFile, setIsParsingImportFile] = useState(false);
  const [selectedTagToRename, setSelectedTagToRename] = useState('');
  const [renamedTagInput, setRenamedTagInput] = useState('');
  const [tagRenamePreview, setTagRenamePreview] = useState<TagRenamePreview | null>(null);
  const [isTagPreviewLoading, setIsTagPreviewLoading] = useState(false);
  const [isTagRenameSubmitting, setIsTagRenameSubmitting] = useState(false);
  const [tagTransactions, setTagTransactions] = useState<Transaction[]>([]);
  const [isTagTransactionsLoading, setIsTagTransactionsLoading] = useState(false);
  const [selectedMerchantToRename, setSelectedMerchantToRename] = useState('');
  const [renamedMerchantInput, setRenamedMerchantInput] = useState('');
  const [merchantRenamePreview, setMerchantRenamePreview] = useState<MerchantRenamePreview | null>(null);
  const [isMerchantPreviewLoading, setIsMerchantPreviewLoading] = useState(false);
  const [isMerchantRenameSubmitting, setIsMerchantRenameSubmitting] = useState(false);
  const [merchantTransactions, setMerchantTransactions] = useState<Transaction[]>([]);
  const [isMerchantTransactionsLoading, setIsMerchantTransactionsLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    transactions: Transaction[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateWithExistingCount: number;
    duplicateInFileCount: number;
  } | null>(null);
  const [isPullDialogOpen, setIsPullDialogOpen] = useState(false);
  const [selectedPullYear, setSelectedPullYear] = useState('');
  const [isPullSubmitting, setIsPullSubmitting] = useState(false);

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

  useEffect(() => {
    if (!selectedTagToRename) return;
    const normalizedSelectedTag = normalizeTag(selectedTagToRename);
    const hasSelectedTag = tagSummaries.some(({ tag }) => tag === normalizedSelectedTag);
    if (!hasSelectedTag) {
      setSelectedTagToRename('');
      setRenamedTagInput('');
      setTagRenamePreview(null);
      setTagTransactions([]);
    }
  }, [selectedTagToRename, tagSummaries]);

  useEffect(() => {
    if (!selectedTagToRename) {
      setTagTransactions([]);
      setIsTagTransactionsLoading(false);
      return;
    }

    let isMounted = true;

    const loadTagTransactions = async () => {
      try {
        setIsTagTransactionsLoading(true);
        const results = await onGetTagTransactions(selectedTagToRename);
        if (!isMounted) return;
        setTagTransactions(results);
      } catch (err: any) {
        if (!isMounted) return;
        setTagTransactions([]);
        setStatus({ type: 'error', message: err.message || '讀取 tag 項目失敗' });
      } finally {
        if (isMounted) {
          setIsTagTransactionsLoading(false);
        }
      }
    };

    void loadTagTransactions();

    return () => {
      isMounted = false;
    };
  }, [onGetTagTransactions, selectedTagToRename]);

  useEffect(() => {
    if (!selectedMerchantToRename || isMerchantRenameSubmitting) return;
    const selectedMerchantKey = normalizeMerchantName(selectedMerchantToRename).toLocaleLowerCase();
    const hasSelectedMerchant = merchantSummaries.some(({ merchant }) => (
      normalizeMerchantName(merchant).toLocaleLowerCase() === selectedMerchantKey
    ));
    if (!hasSelectedMerchant) {
      setSelectedMerchantToRename('');
      setRenamedMerchantInput('');
      setMerchantRenamePreview(null);
      setMerchantTransactions([]);
    }
  }, [isMerchantRenameSubmitting, merchantSummaries, selectedMerchantToRename]);

  useEffect(() => {
    if (!selectedMerchantToRename) {
      setMerchantTransactions([]);
      setIsMerchantTransactionsLoading(false);
      return;
    }

    let isMounted = true;

    const loadMerchantTransactions = async () => {
      try {
        setIsMerchantTransactionsLoading(true);
        const results = await onGetMerchantTransactions(selectedMerchantToRename);
        if (!isMounted) return;
        setMerchantTransactions(results);
      } catch (err: any) {
        if (!isMounted) return;
        setMerchantTransactions([]);
        setStatus({ type: 'error', message: err.message || '讀取商家項目失敗' });
      } finally {
        if (isMounted) {
          setIsMerchantTransactionsLoading(false);
        }
      }
    };

    void loadMerchantTransactions();

    return () => {
      isMounted = false;
    };
  }, [onGetMerchantTransactions, selectedMerchantToRename]);

  const handleDefaultCurrencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    setDefaultCurrency(newVal);
    await db.settings.put({ key: 'defaultCurrency', value: newVal });
    onDataChange();
  };

  const handleEnabledCurrencyToggle = async (currency: string) => {
    const isEnabled = enabledCurrencies.includes(currency);
    if (isEnabled && enabledCurrencies.length === 1) {
      const message = '至少要保留一個可用幣別';
      setStatus({ type: 'error', message });
      onNotify(message);
      return;
    }

    const nextEnabledCurrencies = isEnabled
      ? enabledCurrencies.filter((item) => item !== currency)
      : SUPPORTED_CURRENCIES.filter((item) => item === currency || enabledCurrencies.includes(item));
    const nextDefaultCurrency = getPreferredCurrency(defaultCurrency, nextEnabledCurrencies);

    setEnabledCurrencies(nextEnabledCurrencies);
    setDefaultCurrency(nextDefaultCurrency);
    setStatus({ type: 'idle', message: '' });

    await db.settings.bulkPut([
      { key: 'enabledCurrencies', value: nextEnabledCurrencies },
      { key: 'defaultCurrency', value: nextDefaultCurrency }
    ]);
    onDataChange();
  };

  const handlePaymentMethodDisplayModeChange = async (mode: PaymentMethodDisplayMode) => {
    setStatus({ type: 'idle', message: '' });
    onPaymentMethodDisplayModeChange(mode);
    await db.settings.put({ key: PAYMENT_METHOD_DISPLAY_MODE_SETTING_KEY, value: mode });
    onDataChange();
  };

  const handleHomeNavArrowsVisibleChange = async (visible: boolean) => {
    setStatus({ type: 'idle', message: '' });
    onHomeNavArrowsVisibleChange(visible);
    await db.settings.put({ key: HOME_NAV_ARROWS_VISIBLE_SETTING_KEY, value: visible });
    onDataChange();
  };

  const saveGeminiApiKey = async () => {
    const trimmedApiKey = geminiApiKeyInput.trim();
    try {
      if (trimmedApiKey) {
        await db.settings.put({ key: GEMINI_API_KEY_SETTING_KEY, value: trimmedApiKey });
      } else {
        await db.settings.delete(GEMINI_API_KEY_SETTING_KEY);
      }
      setGeminiApiKeyInput(trimmedApiKey);
      setHasGeminiApiKey(trimmedApiKey.length > 0);
      const message = trimmedApiKey ? 'AI 設定已儲存' : 'AI 設定已清除';
      setStatus({ type: 'success', message });
      onNotify(message);
      onDataChange();
    } catch (err: any) {
      setStatus({ type: 'error', message: `AI 設定儲存失敗: ${err.message}` });
    }
  };

  const saveSyncConfig = async () => {
    try {
      await db.settings.bulkPut([
        { key: 'syncApiUrl', value: syncApiUrl.trim() },
        { key: 'syncToken', value: syncToken.trim() }
      ]);
      onDataChange();
      const syncResult = await onTriggerSync('同步設定後立即同步');
      if (syncResult.skippedOffline) {
        onNotify('同步設定已儲存');
        setStatus({
          type: 'success',
          message: '同步設定已儲存\n目前離線，待恢復連線後再同步',
        });
      } else if (syncResult.failed > 0) {
        onNotify(`同步設定已儲存，但有 ${syncResult.failed} 筆同步失敗`);
        setStatus({
          type: 'error',
          message: `同步設定已儲存\n同步失敗 ${syncResult.failed}/${syncResult.total} 筆`,
          action: openSyncProgressAction,
        });
      } else {
        onNotify('同步設定已儲存');
        setStatus({ type: 'idle', message: '' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: `同步設定儲存失敗: ${err.message}` });
    }
  };

  const useMockSyncConfig = () => {
    setSyncApiUrl(MOCK_SYNC_API_URL);
    setSyncToken(MOCK_SYNC_TOKEN);
    setStatus({
      type: 'success',
      message: '已填入 mock API 設定\n按「儲存同步設定」後即可使用本機 mock cloud 測試。',
    });
  };

  const openPullDialog = () => {
    setStatus({ type: 'idle', message: '' });
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
      setStatus({ type: 'idle', message: '' });
      const { report } = await onPullFromCloud(selectedPullYear);
      setIsPullDialogOpen(false);
      onOpenPullReports(report.id);

      if (report.status === 'failed') {
        setStatus({
          type: 'error',
          message: `${report.year} 年年度雲端同步失敗\n${report.runError || '請稍後再試'}`,
        });
        return;
      }

      const summaryMessage = [
        `雲端讀取 ${report.summary.fetched}`,
        `雲端新增本機 ${report.summary.insertedFromCloud}`,
        `雲端覆蓋本機 ${report.summary.updatedFromCloud}`,
        `本機覆蓋雲端 ${report.summary.pushedLocalUpdateToCloud ?? 0}`,
        `本機新增雲端 ${report.summary.insertedLocalOnlyToCloud ?? 0}`,
        `未變更 ${report.summary.unchanged}`,
        `失敗 ${report.summary.failed}`,
      ].join(' / ');

      if (report.status === 'partial') {
        onNotify(`已完成 ${report.year} 年年度雲端同步，但有部分失敗`);
        setStatus({
          type: 'error',
          message: `已完成 ${report.year} 年年度雲端同步，但有部分失敗\n${summaryMessage}`,
        });
        return;
      }

      onNotify(`已完成 ${report.year} 年年度雲端同步`);
      setStatus({
        type: 'success',
        message: `已完成 ${report.year} 年年度雲端同步\n${summaryMessage}`,
      });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || '年度雲端同步失敗' });
    } finally {
      setIsPullSubmitting(false);
    }
  };

  const resetTagRenameState = (nextSelectedTag = '') => {
    const currentTagKey = normalizeTag(selectedTagToRename);
    const nextTagKey = normalizeTag(nextSelectedTag);
    const willSwitchTag = currentTagKey !== nextTagKey;

    setSelectedTagToRename(nextSelectedTag);
    setRenamedTagInput('');
    setTagRenamePreview(null);
    setIsTagPreviewLoading(false);
    setIsTagRenameSubmitting(false);
    if (!nextSelectedTag || willSwitchTag) {
      setTagTransactions([]);
      setIsTagTransactionsLoading(Boolean(nextSelectedTag));
    }
  };

  const handleSelectTagToRename = (tag: string) => {
    setStatus({ type: 'idle', message: '' });
    resetTagRenameState(tag);
  };

  const handlePreviewTagRename = async () => {
    try {
      setIsTagPreviewLoading(true);
      setStatus({ type: 'idle', message: '' });
      const preview = await onPreviewTagRename(selectedTagToRename, renamedTagInput);
      setTagRenamePreview(preview);
      if (preview.affectedCount === 0) {
        setStatus({ type: 'error', message: '預覽結果為 0 筆，無法執行更名' });
      } else if (preview.conflictsWithExistingTag) {
        setStatus({ type: 'success', message: `提醒：#${preview.newTag} 已存在，執行後會合併 tag 並自動去重` });
      }
    } catch (err: any) {
      setTagRenamePreview(null);
      setStatus({ type: 'error', message: err.message || 'Tag 預覽失敗' });
    } finally {
      setIsTagPreviewLoading(false);
    }
  };

  const handleRenameTag = async () => {
    if (!tagRenamePreview || tagRenamePreview.affectedCount === 0) {
      setStatus({ type: 'error', message: '請先預覽受影響筆數後再執行更名' });
      return;
    }

    try {
      setIsTagRenameSubmitting(true);
      setStatus({ type: 'idle', message: '' });
      const result = await onRenameTag(selectedTagToRename, renamedTagInput);
      await onDataChange();
      resetTagRenameState(result.newTag);
      const renameSummary = `已將 #${result.oldTag} 更名為 #${result.newTag}`;

      if (result.skippedOffline) {
        setStatus({
          type: 'success',
          message: `${renameSummary}，共更新 ${result.affectedCount} 筆\n目前離線，待恢復連線後同步`,
        });
        return;
      }

      if (result.syncResult && result.syncResult.failed > 0) {
        setStatus({
          type: 'error',
          message: `${renameSummary}，共更新 ${result.affectedCount} 筆\n同步失敗 ${result.syncResult.failed}/${result.syncResult.total} 筆`,
          action: openSyncProgressAction,
        });
        return;
      }

      setStatus({
        type: 'success',
        message: `${renameSummary}，共更新 ${result.affectedCount} 筆`,
      });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Tag 更名失敗' });
    } finally {
      setIsTagRenameSubmitting(false);
    }
  };

  const resetMerchantRenameState = (nextSelectedMerchant = '') => {
    const currentMerchantKey = normalizeMerchantName(selectedMerchantToRename).toLocaleLowerCase();
    const nextMerchantKey = normalizeMerchantName(nextSelectedMerchant).toLocaleLowerCase();
    const willSwitchMerchant = currentMerchantKey !== nextMerchantKey;

    setSelectedMerchantToRename(nextSelectedMerchant);
    setRenamedMerchantInput('');
    setMerchantRenamePreview(null);
    setIsMerchantPreviewLoading(false);
    setIsMerchantRenameSubmitting(false);
    if (!nextSelectedMerchant || willSwitchMerchant) {
      setMerchantTransactions([]);
      setIsMerchantTransactionsLoading(Boolean(nextSelectedMerchant));
    }
  };

  const handleSelectMerchantToRename = (merchant: string) => {
    setStatus({ type: 'idle', message: '' });
    resetMerchantRenameState(merchant);
  };

  const handlePreviewMerchantRename = async () => {
    try {
      setIsMerchantPreviewLoading(true);
      setStatus({ type: 'idle', message: '' });
      const preview = await onPreviewMerchantRename(selectedMerchantToRename, renamedMerchantInput);
      setMerchantRenamePreview(preview);
      if (preview.affectedCount === 0) {
        setStatus({ type: 'error', message: '預覽結果為 0 筆，無法執行更名' });
      }
    } catch (err: any) {
      setMerchantRenamePreview(null);
      setStatus({ type: 'error', message: err.message || '商家預覽失敗' });
    } finally {
      setIsMerchantPreviewLoading(false);
    }
  };

  const handleRenameMerchant = async () => {
    if (!merchantRenamePreview || merchantRenamePreview.affectedCount === 0) {
      setStatus({ type: 'error', message: '請先預覽受影響筆數後再執行更名' });
      return;
    }

    try {
      setIsMerchantRenameSubmitting(true);
      setStatus({ type: 'idle', message: '' });
      const result = await onRenameMerchant(
        merchantRenamePreview.oldMerchant,
        merchantRenamePreview.newMerchant
      );
      await onDataChange();
      resetMerchantRenameState(result.newMerchant);
      const actionMessage = result.willMerge
        ? `已將 ${result.oldMerchant} 合併到 ${result.newMerchant}`
        : `已將 ${result.oldMerchant} 更名為 ${result.newMerchant}`;

      if (result.skippedOffline) {
        setStatus({
          type: 'success',
          message: `${actionMessage}，共更新 ${result.affectedCount} 筆\n目前離線，待恢復連線後同步`,
        });
        return;
      }

      if (result.syncResult && result.syncResult.failed > 0) {
        setStatus({
          type: 'error',
          message: `${actionMessage}，共更新 ${result.affectedCount} 筆\n同步失敗 ${result.syncResult.failed}/${result.syncResult.total} 筆`,
          action: openSyncProgressAction,
        });
        return;
      }

      setStatus({
        type: 'success',
        message: `${actionMessage}，共更新 ${result.affectedCount} 筆`,
      });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || '商家更名失敗' });
    } finally {
      setIsMerchantRenameSubmitting(false);
    }
  };

  const exportToCSV = async () => {
    try {
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
      onNotify('匯出成功');
      setStatus({ type: 'idle', message: '' });
    } catch (err: any) {
      setStatus({ type: 'error', message: `匯出失敗: ${err.message}` });
    }
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

  const parseTransactionsFromCSV = async (text: string) => {
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

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setStatus({ type: 'idle', message: '' });
    setImportPreview(null);
    setSelectedImportFileName(file?.name || '');
    if (!file) return;

    try {
      setIsParsingImportFile(true);
      const text = await file.text();
      const preview = await parseTransactionsFromCSV(text);
      setImportPreview(preview);
      if (preview.validRows === 0) {
        setStatus({ type: 'error', message: '預覽完成，但找不到可匯入的有效交易紀錄' });
      } else {
        setStatus({ type: 'idle', message: '' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: `檔案預覽失敗: ${err.message}` });
    } finally {
      setIsParsingImportFile(false);
    }
  };

  const importFromPreview = async (mode: 'overwrite' | 'append') => {
    if (!importPreview || importPreview.validRows === 0) {
      setStatus({ type: 'error', message: '請先選擇可匯入的 CSV 檔案並完成預覽' });
      return;
    }

    if (mode === 'overwrite') {
      const firstConfirm = await confirmAction({
        title: '覆蓋匯入資料？',
        text: `將覆蓋目前所有資料，並匯入 ${importPreview.validRows} 筆。確定要繼續嗎？`,
        confirmButtonText: '繼續',
        cancelButtonText: '取消',
        tone: 'danger',
      });
      if (!firstConfirm) return;
      const secondConfirm = await confirmAction({
        title: '再次確認覆蓋匯入',
        text: '此操作會先清空現有資料，且無法復原。確定要「完全覆蓋」嗎？',
        confirmButtonText: '完全覆蓋',
        cancelButtonText: '取消',
        tone: 'danger',
      });
      if (!secondConfirm) return;
    }

    const hasDuplicateOverwriteRisk = (
      (mode === 'append' && importPreview.duplicateWithExistingCount > 0) ||
      importPreview.duplicateInFileCount > 0
    );
    if (hasDuplicateOverwriteRisk) {
      const duplicateConfirm = await confirmAction({
        title: '偵測到重複 ID',
        text: `既有 ${importPreview.duplicateWithExistingCount} 筆、檔案內 ${importPreview.duplicateInFileCount} 筆，這些資料會被覆蓋。確定要匯入嗎？`,
        confirmButtonText: '仍要匯入',
        cancelButtonText: '取消',
      });
      if (!duplicateConfirm) return;
    }
    const finalConfirm = await confirmAction({
      title: mode === 'overwrite' ? '執行覆寫匯入？' : '執行附加匯入？',
      text: mode === 'overwrite'
        ? `即將覆寫匯入 ${importPreview.validRows} 筆，確定執行？`
        : `即將附加匯入 ${importPreview.validRows} 筆，確定執行？`,
      confirmButtonText: '確認匯入',
      cancelButtonText: '取消',
      tone: mode === 'overwrite' ? 'danger' : 'default',
    });
    if (!finalConfirm) return;

    try {
      let overwrittenCount = 0;
      if (mode === 'append') {
        const incomingIds = Array.from(new Set(importPreview.transactions.map((tx) => tx.id)));
        const existing = await db.transactions.bulkGet(incomingIds);
        overwrittenCount = existing.filter(Boolean).length;
      }

      if (mode === 'overwrite') await db.transactions.clear();
      await db.transactions.bulkPut(importPreview.transactions);
      onDataChange();
      const syncResult = await onTriggerSync('匯入後立即同步');
      const importBaseMessage = (mode === 'append' && overwrittenCount > 0)
        ? `匯入成功 (${importPreview.validRows} 筆)，其中 ${overwrittenCount} 筆同 ID 已覆蓋`
        : `匯入成功 (${importPreview.validRows} 筆)`;
      if (syncResult.skippedOffline) {
        onNotify(`匯入成功 (${importPreview.validRows} 筆)`);
        setStatus({
          type: 'success',
          message: `${importBaseMessage}\n目前離線，待恢復連線後再同步`,
        });
      } else if (syncResult.failed > 0) {
        onNotify(`匯入完成，但有 ${syncResult.failed} 筆同步失敗`);
        setStatus({
          type: 'error',
          message: `${importBaseMessage}\n同步失敗 ${syncResult.failed}/${syncResult.total} 筆`,
          action: openSyncProgressAction,
        });
      } else if (syncResult.total > 0) {
        onNotify(importBaseMessage);
        setStatus({ type: 'idle', message: '' });
      } else {
        onNotify(importBaseMessage);
        setStatus({ type: 'idle', message: '' });
      }
      setImportPreview(null);
      setSelectedImportFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setStatus({ type: 'error', message: `匯入失敗: ${err.message}` });
    }
  };

  const resetLocalData = async () => {
    const confirmed = await confirmAction({
      title: '重置本機資料？',
      text: '這會清除 Local Storage 與 IndexedDB 的所有資料，且無法復原。',
      confirmButtonText: '重置',
      cancelButtonText: '取消',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      setStatus({ type: 'idle', message: '' });
      localStorage.clear();
      await db.delete();
      setStatus({ type: 'success', message: '本機資料已清除，正在重新載入...' });
      setTimeout(() => {
        window.location.reload();
      }, 400);
    } catch (err: any) {
      setStatus({ type: 'error', message: `重置失敗: ${err.message}` });
    }
  };

  const insertExamples = async () => {
    const confirmed = await confirmAction({
      title: '插入範例資料？',
      text: '這會加入多筆預設範例交易，方便驗證畫面或 demo。',
      confirmButtonText: '插入',
      cancelButtonText: '取消',
      tone: 'default',
    });
    if (!confirmed) return;

    try {
      const count = await onInsertExamples();
      onDataChange();
      onNotify(`已插入範例資料 (${count} 筆)`);
      setStatus({ type: 'idle', message: '' });
    } catch (err: any) {
      setStatus({ type: 'error', message: `插入範例資料失敗: ${err.message}` });
    }
  };

  const deleteExamples = async () => {
    let candidates: Transaction[];
    try {
      candidates = await onPreviewDeleteExamples();
    } catch (err: any) {
      setStatus({ type: 'error', message: `預覽範例資料失敗: ${err.message}` });
      return;
    }

    if (candidates.length === 0) {
      onNotify('目前沒有範例資料可刪除');
      setStatus({ type: 'idle', message: '' });
      return;
    }

    const previewItems = [...candidates]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((tx) => {
        const label = tx.merchant?.trim() || tx.name?.trim() || '未命名';
        const dateLabel = tx.readableDateTime?.trim()
          || format(new Date(tx.timestamp * 1000), 'yyyy-MM-dd HH:mm');
        const amountLabel = formatCurrencyAmount(tx.amount, tx.currency || 'TWD');
        const sign = tx.type === '支出' ? '-' : '+';
        return `<li class="flex justify-between gap-3"><span class="truncate text-slate-200">${escapeHtml(dateLabel)} · ${escapeHtml(label)}</span><span class="font-mono text-slate-300">${sign}${escapeHtml(amountLabel)}</span></li>`;
      })
      .join('');
    const previewHtml = `
      <div class="space-y-2 text-sm">
        <p class="text-slate-300">將刪除 <span class="font-black text-white">${candidates.length}</span> 筆 id 以 <code class="rounded bg-white/10 px-1 py-0.5 text-xs">sample-tx-</code> 開頭的範例交易：</p>
        <ul class="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-3">${previewItems}</ul>
        <p class="text-xs text-slate-400">此操作只會刪除 id 具有範例資料 prefix 的交易，不會影響你自己建立的紀錄。</p>
      </div>
    `;

    const confirmed = await confirmAction({
      title: '刪除範例資料？',
      html: previewHtml,
      confirmButtonText: '刪除範例',
      cancelButtonText: '取消',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      const removed = await onDeleteExamples(candidates.map((tx) => tx.id));
      onDataChange();
      if (removed === 0) {
        onNotify('沒有可刪除的範例資料');
      } else {
        onNotify(`已刪除範例資料 (${removed} 筆)`);
      }
      setStatus({ type: 'idle', message: '' });
    } catch (err: any) {
      setStatus({ type: 'error', message: `刪除範例資料失敗: ${err.message}` });
    }
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
      meta: selectedImportFileName || 'CSV 備份與匯入',
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

  const renderStatusMessage = () => {
    if (status.type === 'idle') return null;

    const toneClassName = status.type === 'success'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
      : 'border-red-500/20 bg-red-500/10 text-red-300';
    const actionToneClassName = status.type === 'success'
      ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'
      : 'border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/25';

    return (
      <div className={`flex flex-col gap-3 rounded-2xl border p-4 animate-slide-up sm:flex-row sm:items-center sm:justify-between ${toneClassName}`}>
        <div className="flex items-center gap-3">
          {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-bold whitespace-pre-line">{status.message}</span>
        </div>
        {status.action && (
          <button
            type="button"
            onClick={status.action.onClick}
            className={`inline-flex shrink-0 items-center justify-center gap-2 self-stretch rounded-2xl border px-4 py-2 text-xs font-black transition-colors sm:self-auto ${actionToneClassName}`}
          >
            <CloudUpload size={14} />
            {status.action.label}
          </button>
        )}
      </div>
    );
  };

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
            onDefaultCurrencyChange={handleDefaultCurrencyChange}
            onEnabledCurrencyToggle={(currency) => void handleEnabledCurrencyToggle(currency)}
            onPaymentMethodDisplayModeChange={(mode) => void handlePaymentMethodDisplayModeChange(mode)}
            onHomeNavArrowsVisibleChange={(visible) => void handleHomeNavArrowsVisibleChange(visible)}
          />
        );
      case 'ai':
        return (
          <AiSection
            geminiApiKeyInput={geminiApiKeyInput}
            hasGeminiApiKey={hasGeminiApiKey}
            isOffline={isOffline}
            onGeminiApiKeyInputChange={(value) => {
              setGeminiApiKeyInput(value);
              setStatus({ type: 'idle', message: '' });
            }}
            onSaveGeminiApiKey={() => void saveGeminiApiKey()}
          />
        );
      case 'sync':
        return (
          <SyncSection
            syncApiUrl={syncApiUrl}
            syncToken={syncToken}
            setSyncApiUrl={setSyncApiUrl}
            setSyncToken={setSyncToken}
            onSaveSyncConfig={() => void saveSyncConfig()}
            onOpenSyncProgress={onOpenSyncProgress}
            onOpenPullDialog={openPullDialog}
            onOpenPullReports={onOpenPullReports}
            onUseMockSyncConfig={useMockSyncConfig}
            isOffline={isOffline}
          />
        );
      case 'tags':
        return (
          <TagManagementSection
            status={status}
            tagSummaries={tagSummaries}
            selectedTagToRename={selectedTagToRename}
            renamedTagInput={renamedTagInput}
            tagRenamePreview={tagRenamePreview}
            tagTransactions={tagTransactions}
            paymentMethodDisplayMode={paymentMethodDisplayMode}
            isTagPreviewLoading={isTagPreviewLoading}
            isTagRenameSubmitting={isTagRenameSubmitting}
            isTagTransactionsLoading={isTagTransactionsLoading}
            onSelectTagToRename={handleSelectTagToRename}
            onRenamedTagInputChange={(value) => {
              setRenamedTagInput(value);
              setTagRenamePreview(null);
            }}
            onPreviewTagRename={() => void handlePreviewTagRename()}
            onRenameTag={() => void handleRenameTag()}
            onTagTransactionClick={onTagTransactionClick}
          />
        );
      case 'merchant':
        return (
          <MerchantManagementSection
            status={status}
            merchantSummaries={merchantSummaries}
            selectedMerchantToRename={selectedMerchantToRename}
            renamedMerchantInput={renamedMerchantInput}
            merchantRenamePreview={merchantRenamePreview}
            merchantTransactions={merchantTransactions}
            paymentMethodDisplayMode={paymentMethodDisplayMode}
            isMerchantPreviewLoading={isMerchantPreviewLoading}
            isMerchantRenameSubmitting={isMerchantRenameSubmitting}
            isMerchantTransactionsLoading={isMerchantTransactionsLoading}
            onSelectMerchantToRename={handleSelectMerchantToRename}
            onRenamedMerchantInputChange={(value) => {
              setRenamedMerchantInput(value);
              setMerchantRenamePreview(null);
            }}
            onPreviewMerchantRename={() => void handlePreviewMerchantRename()}
            onRenameMerchant={() => void handleRenameMerchant()}
            onMerchantTransactionClick={onMerchantTransactionClick}
          />
        );
      case 'import-export':
        return (
          <ImportExportSection
            fileInputRef={fileInputRef}
            selectedImportFileName={selectedImportFileName}
            isParsingImportFile={isParsingImportFile}
            importPreview={importPreview}
            onExportToCsv={() => void exportToCSV()}
            onImportFileChange={(e) => void handleImportFileChange(e)}
            onImportFromPreview={(mode) => void importFromPreview(mode)}
          />
        );
      case 'danger':
        return (
          <DangerZoneSection
            onResetLocalData={() => void resetLocalData()}
            onInsertExamples={() => void insertExamples()}
            onDeleteExamples={() => void deleteExamples()}
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
          {section !== 'merchant' && section !== 'tags' && renderStatusMessage()}
          <p className="pt-6 text-center text-[10px] font-bold uppercase tracking-[0.4em] text-gray-700 opacity-15">
            Cozy Pocket • Minimalism
          </p>
        </div>
      </div>

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
    </div>
  );
};

export default SettingsPage;
