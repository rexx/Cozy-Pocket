
import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle2, Store } from 'lucide-react';
import { Transaction } from '../types';
import { db } from '../db';
import { format } from 'date-fns';
import { formatReadableDateTime, toEpochSeconds } from '../time';
import { SUPPORTED_CURRENCIES, getEnabledCurrencies, getPreferredCurrency } from '../constants';
import PageHeader from './PageHeader';
import { TagRenamePreview, TagUsageSummary, normalizeTag } from '../services/tagService';
import PreferencesSection from './settings/PreferencesSection';
import SyncSection from './settings/SyncSection';
import TagManagementSection from './settings/TagManagementSection';
import ImportExportSection from './settings/ImportExportSection';
import DangerZoneSection from './settings/DangerZoneSection';

interface SettingsPageProps {
  onClose: () => void;
  onDataChange: () => void;
  onInsertExamples: () => Promise<number>;
  onTriggerSync: (label: string) => Promise<{ total: number; failed: number; skippedOffline: boolean }>;
  onOpenSyncProgress: () => void;
  onOpenMerchantManagement: () => void;
  onNotify: (message: string) => void;
  isOffline: boolean;
  tagSummaries: TagUsageSummary[];
  onPreviewTagRename: (oldTag: string, newTag: string) => Promise<TagRenamePreview>;
  onRenameTag: (oldTag: string, newTag: string) => Promise<TagRenamePreview & { skippedOffline: boolean; syncResult?: { total: number; failed: number; skippedOffline: boolean } }>;
  onGetTagTransactions: (tag: string) => Promise<Transaction[]>;
  onTagTransactionClick: (transaction: Transaction) => void;
}

const CSV_HEADERS = ["id", "type", "amount", "currency", "categoryId", "subCategoryId", "name", "merchant", "note", "timestamp", "readableDateTime", "paymentMethod", "tags", "updatedAt", "version"];
const SettingsPage: React.FC<SettingsPageProps> = ({
  onClose,
  onDataChange,
  onInsertExamples,
  onTriggerSync,
  onOpenSyncProgress,
  onOpenMerchantManagement,
  onNotify,
  isOffline,
  tagSummaries,
  onPreviewTagRename,
  onRenameTag,
  onGetTagTransactions,
  onTagTransactionClick,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  const [defaultCurrency, setDefaultCurrency] = useState('TWD');
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>([...SUPPORTED_CURRENCIES]);
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
  const [importPreview, setImportPreview] = useState<{
    transactions: Transaction[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateWithExistingCount: number;
    duplicateInFileCount: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      db.settings.get('defaultCurrency'),
      db.settings.get('enabledCurrencies'),
      db.settings.get('syncApiUrl'),
      db.settings.get('syncToken')
    ]).then(([currencySetting, enabledCurrenciesSetting, apiUrlSetting, tokenSetting]) => {
      const nextEnabledCurrencies = getEnabledCurrencies(enabledCurrenciesSetting?.value);
      setEnabledCurrencies(nextEnabledCurrencies);
      setDefaultCurrency(getPreferredCurrency(currencySetting?.value, nextEnabledCurrencies));
      if (apiUrlSetting?.value) setSyncApiUrl(apiUrlSetting.value);
      if (tokenSetting?.value) setSyncToken(tokenSetting.value);
    });
  }, []);

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

  const handleDefaultCurrencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    setDefaultCurrency(newVal);
    await db.settings.put({ key: 'defaultCurrency', value: newVal });
    onDataChange();
  };

  const handleEnabledCurrencyToggle = async (currency: string) => {
    const isEnabled = enabledCurrencies.includes(currency);
    if (isEnabled && enabledCurrencies.length === 1) {
      setStatus({ type: 'error', message: '至少要保留一個可用幣別' });
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
        });
      } else {
        onNotify('同步設定已儲存');
        setStatus({ type: 'idle', message: '' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: `同步設定儲存失敗: ${err.message}` });
    }
  };

  const resetTagRenameState = (nextSelectedTag = '') => {
    setSelectedTagToRename(nextSelectedTag);
    setRenamedTagInput('');
    setTagRenamePreview(null);
    setIsTagPreviewLoading(false);
    setIsTagRenameSubmitting(false);
    if (!nextSelectedTag) {
      setTagTransactions([]);
      setIsTagTransactionsLoading(false);
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
      resetTagRenameState('');
      onDataChange();

      if (result.skippedOffline) {
        setStatus({
          type: 'success',
          message: `已將 #${result.oldTag} 更名為 #${result.newTag}，共更新 ${result.affectedCount} 筆\n目前離線，待恢復連線後同步`,
        });
        return;
      }

      if (result.syncResult && result.syncResult.failed > 0) {
        setStatus({
          type: 'error',
          message: `已將 #${result.oldTag} 更名為 #${result.newTag}，共更新 ${result.affectedCount} 筆\n同步失敗 ${result.syncResult.failed}/${result.syncResult.total} 筆`,
        });
        return;
      }

      setStatus({ type: 'idle', message: '' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Tag 更名失敗' });
    } finally {
      setIsTagRenameSubmitting(false);
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
      const firstConfirm = confirm(`將覆蓋目前所有資料，並匯入 ${importPreview.validRows} 筆。確定要繼續嗎？`);
      if (!firstConfirm) return;
      const secondConfirm = confirm('再次確認：此操作會先清空現有資料，且無法復原。確定要「完全覆蓋」嗎？');
      if (!secondConfirm) return;
    }

    const hasDuplicateOverwriteRisk = (
      (mode === 'append' && importPreview.duplicateWithExistingCount > 0) ||
      importPreview.duplicateInFileCount > 0
    );
    if (hasDuplicateOverwriteRisk) {
      const duplicateConfirm = confirm(
        `偵測到重複 ID（既有 ${importPreview.duplicateWithExistingCount} 筆、檔案內 ${importPreview.duplicateInFileCount} 筆），這些資料會被覆蓋。確定要匯入嗎？`
      );
      if (!duplicateConfirm) return;
    }
    const finalConfirm = confirm(
      mode === 'overwrite'
        ? `最後確認：即將覆寫匯入 ${importPreview.validRows} 筆，確定執行？`
        : `最後確認：即將附加匯入 ${importPreview.validRows} 筆，確定執行？`
    );
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
    if (!confirm('這會清除 Local Storage 與 IndexedDB 的所有資料，且無法復原。確定要重置嗎？')) return;
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
    try {
      const count = await onInsertExamples();
      onDataChange();
      onNotify(`已插入範例資料 (${count} 筆)`);
      setStatus({ type: 'idle', message: '' });
    } catch (err: any) {
      setStatus({ type: 'error', message: `插入範例資料失敗: ${err.message}` });
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#1a1c2c] select-none overflow-hidden text-slate-200">
      <div className="flex-none">
        <PageHeader
          title="資料與設定"
          leftAction={<ArrowLeft size={26} />}
          onLeftAction={onClose}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-6 sm:px-6 sm:pt-8 no-scrollbar bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.1),_transparent_28%),linear-gradient(180deg,_#1f2235_0%,_#171a29_48%,_#121520_100%)]">
        <div className="mx-auto max-w-6xl space-y-6 pb-10">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <PreferencesSection
              defaultCurrency={defaultCurrency}
              enabledCurrencies={enabledCurrencies}
              onDefaultCurrencyChange={handleDefaultCurrencyChange}
              onEnabledCurrencyToggle={(currency) => void handleEnabledCurrencyToggle(currency)}
            />
            <SyncSection
              syncApiUrl={syncApiUrl}
              syncToken={syncToken}
              setSyncApiUrl={setSyncApiUrl}
              setSyncToken={setSyncToken}
              onSaveSyncConfig={() => void saveSyncConfig()}
              onOpenSyncProgress={onOpenSyncProgress}
              isOffline={isOffline}
            />
          </div>

          <TagManagementSection
            tagSummaries={tagSummaries}
            selectedTagToRename={selectedTagToRename}
            renamedTagInput={renamedTagInput}
            tagRenamePreview={tagRenamePreview}
            tagTransactions={tagTransactions}
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

          <section className="rounded-[28px] border border-white/8 bg-white/[0.045] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-sm sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/12 text-amber-200">
                  <Store size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black tracking-[0.02em] text-white">商家管理</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    商家清單改到獨立頁面管理，避免設定頁被長列表撐滿。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenMerchantManagement}
                className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-500/15 px-4 py-3 text-sm font-black text-amber-200 transition-all hover:bg-amber-500/20 active:scale-[0.98]"
              >
                前往管理
              </button>
            </div>
          </section>

          <ImportExportSection
            fileInputRef={fileInputRef}
            selectedImportFileName={selectedImportFileName}
            isParsingImportFile={isParsingImportFile}
            importPreview={importPreview}
            onExportToCsv={() => void exportToCSV()}
            onImportFileChange={(e) => void handleImportFileChange(e)}
            onImportFromPreview={(mode) => void importFromPreview(mode)}
          />

          <DangerZoneSection
            onResetLocalData={() => void resetLocalData()}
            onInsertExamples={() => void insertExamples()}
          />

          {status.type !== 'idle' && (
            <div className={`flex items-center gap-3 rounded-2xl border p-4 animate-slide-up ${status.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
              {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              <span className="text-sm font-bold whitespace-pre-line">{status.message}</span>
            </div>
          )}

          <div className="pt-6 text-center opacity-30">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Privacy First</p>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              所有資料皆儲存在您的瀏覽器本地資料庫中。
              <br />
              匯出功能可讓您輕鬆遷移資料。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
