
import React, { useRef, useState, useEffect } from 'react';
import { X, Download, Upload, Database, AlertTriangle, CheckCircle2, Globe, Trash2, CloudUpload, Tags, PencilLine } from 'lucide-react';
import { Transaction } from '../types';
import { db } from '../db';
import { format } from 'date-fns';
import { formatReadableDateTime, toEpochSeconds } from '../time';
import { SUPPORTED_CURRENCIES, getCurrencyDisplay, getEnabledCurrencies, getPreferredCurrency } from '../constants';
import PageHeader from './PageHeader';
import { TagRenamePreview, TagUsageSummary, normalizeTag } from '../services/tagService';
import TransactionItem from './TransactionItem';

interface DataManagementModalProps {
  onClose: () => void;
  onDataChange: () => void;
  onInsertExamples: () => Promise<number>;
  onTriggerSync: (label: string) => Promise<{ total: number; failed: number; skippedOffline: boolean }>;
  onOpenSyncProgress: () => void;
  onNotify: (message: string) => void;
  isOffline: boolean;
  tagSummaries: TagUsageSummary[];
  onPreviewTagRename: (oldTag: string, newTag: string) => Promise<TagRenamePreview>;
  onRenameTag: (oldTag: string, newTag: string) => Promise<TagRenamePreview & { skippedOffline: boolean; syncResult?: { total: number; failed: number; skippedOffline: boolean } }>;
  onGetTagTransactions: (tag: string) => Promise<Transaction[]>;
  onTagTransactionClick: (transaction: Transaction) => void;
}

const CSV_HEADERS = ["id", "type", "amount", "currency", "categoryId", "subCategoryId", "name", "merchant", "note", "timestamp", "readableDateTime", "paymentMethod", "tags", "updatedAt", "version"];
const DataManagementModal: React.FC<DataManagementModalProps> = ({
  onClose,
  onDataChange,
  onInsertExamples,
  onTriggerSync,
  onOpenSyncProgress,
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
          message: '同步設定已儲存；目前離線，待恢復連線後再同步',
        });
      } else if (syncResult.failed > 0) {
        onNotify('同步設定已儲存');
        setStatus({
          type: 'error',
          message: `同步設定已儲存，但同步失敗 ${syncResult.failed}/${syncResult.total} 筆`,
        });
      } else if (syncResult.total > 0) {
        onNotify('同步設定已儲存');
        setStatus({
          type: 'success',
          message: `同步設定已儲存，並已同步 ${syncResult.total} 筆`,
        });
      } else {
        onNotify('同步設定已儲存');
        setStatus({ type: 'success', message: '同步設定已儲存，沒有待同步資料' });
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
          message: `已將 #${result.oldTag} 更名為 #${result.newTag}，共更新 ${result.affectedCount} 筆；目前離線，待恢復連線後同步`,
        });
        return;
      }

      if (result.syncResult && result.syncResult.failed > 0) {
        setStatus({
          type: 'error',
          message: `已更名 ${result.affectedCount} 筆，但同步失敗 ${result.syncResult.failed}/${result.syncResult.total} 筆`,
        });
        return;
      }

      setStatus({
        type: 'success',
        message: `已將 #${result.oldTag} 更名為 #${result.newTag}，共更新 ${result.affectedCount} 筆`,
      });
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
      setStatus({ type: 'success', message: '匯出成功！' });
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
        setStatus({
          type: 'success',
          message: `${importBaseMessage}；目前離線，待恢復連線後再同步`,
        });
      } else if (syncResult.failed > 0) {
        setStatus({
          type: 'error',
          message: `${importBaseMessage}；同步失敗 ${syncResult.failed}/${syncResult.total} 筆`,
        });
      } else if (syncResult.total > 0) {
        setStatus({
          type: 'success',
          message: `${importBaseMessage}；已同步 ${syncResult.total} 筆`,
        });
      } else {
        setStatus({
          type: 'success',
          message: `${importBaseMessage}；沒有待同步資料`,
        });
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
      setStatus({ type: 'success', message: `已插入範例資料 (${count} 筆)` });
    } catch (err: any) {
      setStatus({ type: 'error', message: `插入範例資料失敗: ${err.message}` });
    }
  };

  const getCurrencyOptionLabel = (currency: string) => `${currency} (${getCurrencyDisplay(currency)})`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1c2c] animate-slide-up select-none overflow-hidden text-slate-200">
      <div className="flex-none">
        <PageHeader
          title="資料與設定"
          leftAction={<X size={26} />}
          onLeftAction={onClose}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-8 space-y-6 no-scrollbar bg-gradient-to-b from-[#1e1e2d] to-[#1a1c2c]">
        
        <div className="bg-[#252538] rounded-3xl p-6 border border-white/5 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Globe size={22} />
            </div>
            <div>
              <h2 className="font-bold text-white">偏好設定</h2>
              <p className="text-xs text-gray-500">自定義您的使用體驗</p>
            </div>
          </div>
          <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
            <span className="text-sm font-medium text-gray-300">預設幣別</span>
            <select 
              value={defaultCurrency} 
              onChange={handleDefaultCurrencyChange}
              className="bg-[#1a1c2c] text-white text-sm font-bold px-3 py-2 rounded-xl focus:outline-none border border-white/10"
            >
              {enabledCurrencies.map(c => <option key={c} value={c}>{getCurrencyOptionLabel(c)}</option>)}
            </select>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">循環選單幣別</span>
              <span className="text-[11px] text-gray-500 font-bold">{enabledCurrencies.length} / {SUPPORTED_CURRENCIES.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_CURRENCIES.map((currency) => {
                const checked = enabledCurrencies.includes(currency);
                return (
                  <label
                    key={currency}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-bold transition-all ${checked ? 'border-cyan-500/40 bg-cyan-500/10 text-white' : 'border-white/5 bg-[#1a1c2c] text-gray-500'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => void handleEnabledCurrencyToggle(currency)}
                      className="h-4 w-4 accent-cyan-400"
                    />
                    <span>{getCurrencyOptionLabel(currency)}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-500">未勾選的幣別不會出現在新增交易的循環切換中。</p>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-bold">Sync API URL</label>
              <input
                type="text"
                value={syncApiUrl}
                onChange={(e) => setSyncApiUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full bg-[#1a1c2c] text-white text-sm px-3 py-2 rounded-xl focus:outline-none border border-white/10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-bold">Sync Token</label>
              <input
                type="password"
                value={syncToken}
                onChange={(e) => setSyncToken(e.target.value)}
                placeholder="輸入 GAS token"
                className="w-full bg-[#1a1c2c] text-white text-sm px-3 py-2 rounded-xl focus:outline-none border border-white/10"
              />
            </div>
            <button
              onClick={saveSyncConfig}
              className="w-full py-3 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-black rounded-xl active:scale-95 transition-all"
            >
              儲存同步設定
            </button>
            <button
              onClick={onOpenSyncProgress}
              className="w-full py-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-black rounded-xl active:scale-95 transition-all inline-flex items-center justify-center gap-2"
            >
              <CloudUpload size={14} />
              開啟同步狀態頁
            </button>
            {isOffline && (
              <p className="text-[11px] text-amber-300 font-bold">
                目前離線，可先記帳；同步會在恢復連線後再執行。
              </p>
            )}
          </div>
        </div>

        <div className="bg-[#252538] rounded-3xl p-6 border border-cyan-500/20 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Tags size={22} />
            </div>
            <div>
              <h2 className="font-bold text-white">Tag 管理</h2>
              <p className="text-xs text-gray-500">更名既有 tag，並同步更新所有受影響的交易</p>
            </div>
          </div>

          {tagSummaries.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-400">
              目前還沒有可管理的 tag。
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400">選擇要更名的 tag</p>
                <div className="flex flex-wrap gap-2">
                  {tagSummaries.map(({ tag, count }) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleSelectTagToRename(tag)}
                      className={`rounded-full border px-3 py-2 text-xs font-black transition-all ${
                        selectedTagToRename === tag
                          ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.12)]'
                          : 'border-white/10 bg-white/5 text-gray-300 hover:text-white'
                      }`}
                    >
                      #{tag} · {count} 筆
                    </button>
                  ))}
                </div>
              </div>

              {selectedTagToRename ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400 font-bold">目前 tag</label>
                    <div className="rounded-xl border border-white/10 bg-[#1a1c2c] px-3 py-2 text-sm font-bold text-white">
                      #{selectedTagToRename}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400 font-bold">新 tag 名稱</label>
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#1a1c2c] px-3 py-2">
                      <PencilLine size={16} className="text-gray-500" />
                      <input
                        type="text"
                        value={renamedTagInput}
                        onChange={(e) => {
                          setRenamedTagInput(e.target.value);
                          setTagRenamePreview(null);
                        }}
                        placeholder="輸入新的 tag 名稱"
                        className="w-full bg-transparent text-sm font-bold text-white focus:outline-none placeholder-gray-600"
                        disabled={isTagPreviewLoading || isTagRenameSubmitting}
                      />
                    </div>
                  </div>

                  {tagRenamePreview && (
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 space-y-1">
                      <p className="text-xs font-black text-amber-300">更名預覽</p>
                      <p className="text-xs text-gray-200">#{tagRenamePreview.oldTag} → #{tagRenamePreview.newTag}</p>
                      <p className="text-xs text-emerald-300">預計影響：{tagRenamePreview.affectedCount} 筆交易</p>
                      {tagRenamePreview.conflictsWithExistingTag && (
                        <p className="text-xs text-amber-200">提醒：新名稱已存在；確認後會合併為同一個 tag，並自動去除重複 tag。</p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handlePreviewTagRename}
                      disabled={!renamedTagInput.trim() || isTagPreviewLoading || isTagRenameSubmitting}
                      className="py-3 bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-black rounded-xl active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
                    >
                      {isTagPreviewLoading ? '預覽中...' : '預覽影響筆數'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRenameTag}
                      disabled={!tagRenamePreview || tagRenamePreview.affectedCount === 0 || isTagPreviewLoading || isTagRenameSubmitting}
                      className="py-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-black rounded-xl active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
                    >
                      {isTagRenameSubmitting ? '更名中...' : '確認更名'}
                    </button>
                  </div>

                  <div className="pt-2">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-black text-white">#{selectedTagToRename} · {tagTransactions.length} 筆</h3>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1a1c2c]">
                      {isTagTransactionsLoading ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-400">載入中...</div>
                      ) : tagTransactions.length > 0 ? (
                        tagTransactions.map((tx) => (
                          <TransactionItem
                            key={tx.id}
                            transaction={tx}
                            onClick={onTagTransactionClick}
                            showDateTime
                          />
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center text-sm text-gray-400">目前沒有符合這個 tag 的交易。</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="bg-[#252538] rounded-3xl p-6 border border-red-500/20 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400">
              <Trash2 size={22} />
            </div>
            <div>
              <h2 className="font-bold text-white">重置本機資料</h2>
              <p className="text-xs text-gray-500">清除 Local Storage 與 IndexedDB，並重新載入頁面</p>
            </div>
          </div>
          <button
            onClick={resetLocalData}
            className="w-full py-4 bg-red-500/20 border border-red-500/30 text-red-300 font-black rounded-2xl active:scale-[0.98] transition-all"
          >
            清除本機資料並重置
          </button>
        </div>

        <div className="bg-[#252538] rounded-3xl p-6 border border-cyan-500/20 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Database size={22} />
            </div>
            <div>
              <h2 className="font-bold text-white">範例資料</h2>
              <p className="text-xs text-gray-500">手動插入預設範例交易</p>
            </div>
          </div>
          <button
            onClick={insertExamples}
            className="w-full py-4 bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-black rounded-2xl active:scale-[0.98] transition-all"
          >
            插入範例資料
          </button>
        </div>

        <div className="bg-[#252538] rounded-3xl p-6 border border-white/5 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Download size={22} />
            </div>
            <div>
              <h2 className="font-bold text-white">匯出備份</h2>
              <p className="text-xs text-gray-500">將目前所有的記帳紀錄匯出為 CSV 檔案</p>
            </div>
          </div>
          <button onClick={exportToCSV} className="w-full py-4 bg-cyan-500 text-black font-black rounded-2xl active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)]">立即匯出 CSV</button>
        </div>

        <div className="bg-[#252538] rounded-3xl p-6 border border-white/5 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Upload size={22} />
            </div>
            <div>
              <h2 className="font-bold text-white">匯入資料</h2>
              <p className="text-xs text-gray-500">從備份的 CSV 檔案中還原紀錄</p>
            </div>
          </div>
          <div className="relative">
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportFileChange} />
            <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl active:bg-white/10 transition-all flex items-center justify-center gap-2">
              <Database size={18} /> {selectedImportFileName || '選擇 CSV 檔案'}
            </button>
          </div>
          {isParsingImportFile && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-300">
              解析檔案中，正在建立匯入預覽...
            </div>
          )}
          {importPreview && (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 space-y-1">
              <p className="text-xs font-black text-amber-300">匯入預覽</p>
              <p className="text-xs text-gray-300">資料列：{importPreview.totalRows} 行</p>
              <p className="text-xs text-emerald-300">可匯入：{importPreview.validRows} 筆</p>
              <p className="text-xs text-amber-200">重複 ID（既有資料）：{importPreview.duplicateWithExistingCount} 筆</p>
              <p className="text-xs text-amber-200">重複 ID（檔案內）：{importPreview.duplicateInFileCount} 筆</p>
              {importPreview.invalidRows > 0 && (
                <p className="text-xs text-red-300">略過無效資料：{importPreview.invalidRows} 筆</p>
              )}
            </div>
          )}
          {importPreview && importPreview.validRows > 0 && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => importFromPreview('append')} className="py-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl active:scale-95 transition-all">附加匯入</button>
              <button onClick={() => importFromPreview('overwrite')} className="py-3 bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl active:scale-95 transition-all">覆寫匯入</button>
            </div>
          )}
        </div>

        {status.type !== 'idle' && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-slide-up ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <span className="text-sm font-bold">{status.message}</span>
          </div>
        )}

        <div className="pt-8 text-center space-y-2 opacity-20">
          <p className="text-[10px] font-black tracking-[0.3em] text-gray-400 uppercase">Privacy First</p>
          <p className="text-[9px] text-gray-500 leading-relaxed px-10">所有資料皆儲存在您的瀏覽器本地資料庫中。<br/>匯出功能可讓您輕鬆遷移資料。</p>
        </div>
      </div>
    </div>
  );
};

export default DataManagementModal;
