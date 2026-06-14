import React, { useState } from 'react';
import { FlaskConical, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Transaction } from '../../types';
import { formatCurrencyAmount } from '../../constants';
import { confirmAction } from '../../services/dialogService';
import SettingsSection, {
  sectionCyanButtonClassName,
  sectionLabelClassName,
  sectionPanelClassName,
  sectionRedButtonClassName,
} from './SettingsSection';
import { idleStatus, type SettingsStatus } from './settingsStatus';
import { SettingsStatusCard } from './SettingsFeedbackCard';

interface DangerZoneSectionProps {
  onResetLocalData: () => Promise<void>;
  onInsertExamples: () => Promise<number>;
  onPreviewDeleteExamples: () => Promise<Transaction[]>;
  onDeleteExamples: (ids: string[]) => Promise<number>;
  onDataChange: () => void;
  onNotify: (message: string) => void;
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] || ch);

const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({
  onResetLocalData,
  onInsertExamples,
  onPreviewDeleteExamples,
  onDeleteExamples,
  onDataChange,
  onNotify,
}) => {
  const [status, setStatus] = useState<SettingsStatus>(idleStatus);

  const handleResetLocalData = async () => {
    const confirmed = await confirmAction({
      title: '重置本機資料？',
      text: '這會清除 Local Storage 與 IndexedDB 的所有資料，且無法復原。',
      confirmButtonText: '重置',
      cancelButtonText: '取消',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      setStatus(idleStatus);
      await onResetLocalData();
      setStatus({ type: 'success', message: '本機資料已清除，正在重新載入...' });
      setTimeout(() => {
        window.location.reload();
      }, 400);
    } catch (err: any) {
      setStatus({ type: 'error', message: `重置失敗: ${err.message}` });
    }
  };

  const handleInsertExamples = async () => {
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
      setStatus(idleStatus);
    } catch (err: any) {
      setStatus({ type: 'error', message: `插入範例資料失敗: ${err.message}` });
    }
  };

  const handleDeleteExamples = async () => {
    let candidates: Transaction[];
    try {
      candidates = await onPreviewDeleteExamples();
    } catch (err: any) {
      setStatus({ type: 'error', message: `預覽範例資料失敗: ${err.message}` });
      return;
    }

    if (candidates.length === 0) {
      onNotify('目前沒有範例資料可刪除');
      setStatus(idleStatus);
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
      setStatus(idleStatus);
    } catch (err: any) {
      setStatus({ type: 'error', message: `刪除範例資料失敗: ${err.message}` });
    }
  };

  return (
    <SettingsSection>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={`${sectionPanelClassName} flex h-full flex-col`}>
          <div className="mb-4 space-y-1">
            <p className={sectionLabelClassName}>Reset Local Data</p>
            <p className="text-sm text-slate-300">清除 Local Storage 與 IndexedDB，並重新載入頁面。</p>
          </div>
          <button type="button" onClick={() => void handleResetLocalData()} className={`${sectionRedButtonClassName} mt-auto w-full`}>
            <Trash2 size={16} />
            清除本機資料並重置
          </button>
        </div>

        <div className={`${sectionPanelClassName} flex h-full flex-col`}>
          <div className="mb-4 space-y-1">
            <p className={sectionLabelClassName}>Sample Data</p>
            <p className="text-sm text-slate-300">
              插入預設範例交易方便驗證畫面或 demo；刪除範例資料只會移除 id 以 <code className="rounded bg-white/10 px-1 py-0.5 text-xs">sample-tx-</code> 開頭、由本入口建立的紀錄。
            </p>
          </div>
          <div className="mt-auto flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void handleInsertExamples()} className={`${sectionCyanButtonClassName} w-full`}>
              <FlaskConical size={16} />
              插入範例資料
            </button>
            <button type="button" onClick={() => void handleDeleteExamples()} className={`${sectionRedButtonClassName} w-full`}>
              <Trash2 size={16} />
              刪除範例資料
            </button>
          </div>
        </div>
      </div>

      <SettingsStatusCard status={status} />
    </SettingsSection>
  );
};

export default DangerZoneSection;
