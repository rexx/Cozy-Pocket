
import React, { useRef, useState, useEffect } from 'react';
import { X, Download, Upload, Database, AlertTriangle, CheckCircle2, Globe, Trash2 } from 'lucide-react';
import { Transaction } from '../types';
import { db } from '../db';
import { format } from 'date-fns';
import { formatReadableDateTime, toEpochSeconds } from '../time';

interface DataManagementModalProps {
  onClose: () => void;
  onDataChange: () => void;
}

const CSV_HEADERS = ["id", "type", "amount", "currency", "categoryId", "subCategoryId", "name", "merchant", "note", "timestamp", "readableDateTime", "paymentMethod", "tags"];
const CURRENCIES = ['TWD', 'USD', 'JPY', 'EUR', 'HKD', 'CNY'];

const DataManagementModal: React.FC<DataManagementModalProps> = ({ onClose, onDataChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  const [defaultCurrency, setDefaultCurrency] = useState('TWD');
  const [syncApiUrl, setSyncApiUrl] = useState('');
  const [syncToken, setSyncToken] = useState('');

  useEffect(() => {
    Promise.all([
      db.settings.get('defaultCurrency'),
      db.settings.get('syncApiUrl'),
      db.settings.get('syncToken')
    ]).then(([currencySetting, apiUrlSetting, tokenSetting]) => {
      if (currencySetting) setDefaultCurrency(currencySetting.value);
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

  const saveSyncConfig = async () => {
    try {
      await db.settings.bulkPut([
        { key: 'syncApiUrl', value: syncApiUrl.trim() },
        { key: 'syncToken', value: syncToken.trim() }
      ]);
      setStatus({ type: 'success', message: '同步設定已儲存' });
      onDataChange();
    } catch (err: any) {
      setStatus({ type: 'error', message: `同步設定儲存失敗: ${err.message}` });
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
          t.tags || ''
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

  const importFromCSV = async (mode: 'overwrite' | 'append') => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error('檔案內容為空');
        const lines = splitCSVIntoRows(text);
        if (lines.length < 2) throw new Error('檔案格式不正確或無資料');
        const parsedHeader = parseCSVLine(lines[0]);
        const headers = parsedHeader.length > 0 ? parsedHeader : CSV_HEADERS;
        const dataRows = lines.slice(1);
        const parsedTransactions: Transaction[] = dataRows.map(line => {
          const values = parseCSVLine(line);
          const obj: any = {};
          headers.forEach((header, index) => {
            let val = values[index] || '';
            if (header === 'amount') obj[header] = parseFloat(val);
            else if (header === 'timestamp') obj[header] = toEpochSeconds(parseInt(val, 10));
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
        if (parsedTransactions.length === 0) throw new Error('找不到有效的交易紀錄');
        if (mode === 'overwrite') await db.transactions.clear();
        await db.transactions.bulkPut(parsedTransactions);
        onDataChange();
        setStatus({ type: 'success', message: `匯入成功 (${parsedTransactions.length} 筆)` });
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        setStatus({ type: 'error', message: `匯入失敗: ${err.message}` });
      }
    };
    reader.readAsText(file);
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1c2c] animate-slide-up select-none overflow-hidden text-slate-200">
      <div className="flex-none">
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 bg-[#1e1e2d]">
          <button onClick={onClose} className="p-2 text-gray-400 active:scale-90 transition-transform"><X size={26} /></button>
          <h1 className="text-lg font-bold text-white tracking-wide">資料與設定</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 no-scrollbar bg-gradient-to-b from-[#1e1e2d] to-[#1a1c2c]">
        
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
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
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
          </div>
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
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={() => setStatus({ type: 'idle', message: '' })} />
            <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl active:bg-white/10 transition-all flex items-center justify-center gap-2">
              <Database size={18} /> {fileInputRef.current?.files?.[0]?.name || '選擇 CSV 檔案'}
            </button>
          </div>
          {fileInputRef.current?.files?.[0] && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => importFromCSV('append')} className="py-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl active:scale-95 transition-all">追加匯入</button>
              <button onClick={() => { if(confirm('警告：完全覆蓋將會刪除目前所有的記帳紀錄，確定要繼續嗎？')) { importFromCSV('overwrite'); } }} className="py-3 bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl active:scale-95 transition-all">完全覆蓋</button>
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
