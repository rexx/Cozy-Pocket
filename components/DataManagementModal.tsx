
import React, { useRef, useState } from 'react';
import { X, Download, Upload, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Transaction } from '../types';
import { db } from '../db';
import { format } from 'date-fns';

interface DataManagementModalProps {
  onClose: () => void;
  onDataChange: () => void;
}

const CSV_HEADERS = ["id", "type", "amount", "categoryId", "subCategoryId", "name", "merchant", "note", "date", "time", "paymentMethod", "tags"];

const DataManagementModal: React.FC<DataManagementModalProps> = ({ onClose, onDataChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });

  const exportToCSV = async () => {
    try {
      const transactions = await db.transactions.toArray();
      const csvContent = [
        CSV_HEADERS.join(','),
        ...transactions.map(t => [
          t.id,
          t.type,
          t.amount,
          t.categoryId,
          t.subCategoryId || '',
          t.name || '',
          t.merchant || '',
          t.note || '',
          t.date,
          t.time,
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

  const parseCSVLine = (line: string) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += char;
      }
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
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        
        if (lines.length < 2) throw new Error('檔案格式不正確或無資料');

        const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
        const dataRows = lines.slice(1);

        const parsedTransactions: Transaction[] = dataRows.map(line => {
          const values = parseCSVLine(line);
          const obj: any = {};
          CSV_HEADERS.forEach((header, index) => {
            let val = values[index] || '';
            if (header === 'amount') obj[header] = parseFloat(val);
            else obj[header] = val;
          });
          return obj as Transaction;
        }).filter(t => !isNaN(t.amount));

        if (mode === 'overwrite') {
          await db.transactions.clear();
        }

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1c2c] animate-slide-up select-none overflow-hidden text-slate-200">
      <div className="flex-none">
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 bg-[#1e1e2d]">
          <button onClick={onClose} className="p-2 text-gray-400 active:scale-90 transition-transform"><X size={26} /></button>
          <h1 className="text-lg font-bold text-white tracking-wide">資料管理</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 no-scrollbar bg-gradient-to-b from-[#1e1e2d] to-[#1a1c2c]">
        
        {/* Export Section */}
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
          <button 
            onClick={exportToCSV}
            className="w-full py-4 bg-cyan-500 text-black font-black rounded-2xl active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)]"
          >
            立即匯出 CSV
          </button>
        </div>

        {/* Import Section */}
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
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv"
              className="hidden"
              onChange={() => setStatus({ type: 'idle', message: '' })}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl active:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <Database size={18} />
              {fileInputRef.current?.files?.[0]?.name || '選擇 CSV 檔案'}
            </button>
          </div>

          {fileInputRef.current?.files?.[0] && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                onClick={() => importFromCSV('append')}
                className="py-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl active:scale-95 transition-all"
              >
                追加匯入
              </button>
              <button 
                onClick={() => {
                  if(confirm('警告：完全覆蓋將會刪除目前所有的記帳紀錄，確定要繼續嗎？')) {
                    importFromCSV('overwrite');
                  }
                }}
                className="py-3 bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl active:scale-95 transition-all"
              >
                完全覆蓋
              </button>
            </div>
          )}
        </div>

        {/* Status Message */}
        {status.type !== 'idle' && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-slide-up ${
            status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <span className="text-sm font-bold">{status.message}</span>
          </div>
        )}

        <div className="pt-8 text-center space-y-2 opacity-20">
          <p className="text-[10px] font-black tracking-[0.3em] text-gray-400 uppercase">Privacy First</p>
          <p className="text-[9px] text-gray-500 leading-relaxed px-10">
            所有資料皆儲存在您的瀏覽器本地資料庫中。<br/>匯出功能可讓您輕鬆遷移資料。
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataManagementModal;
