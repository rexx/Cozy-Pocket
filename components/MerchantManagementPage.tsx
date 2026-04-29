import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PaymentMethodDisplayMode, Transaction } from '../types';
import { MerchantRenamePreview, getMerchantUsageSummaries, normalizeMerchantName } from '../services/merchantService';
import PageHeader from './PageHeader';
import MerchantManagementSection from './settings/MerchantManagementSection';

interface MerchantManagementPageProps {
  transactions: Transaction[];
  paymentMethodDisplayMode: PaymentMethodDisplayMode;
  onClose: () => void;
  onDataChange: () => void;
  onPreviewMerchantRename: (oldMerchant: string, newMerchant: string) => Promise<MerchantRenamePreview>;
  onRenameMerchant: (oldMerchant: string, newMerchant: string) => Promise<MerchantRenamePreview & { skippedOffline: boolean; syncResult?: { total: number; failed: number; skippedOffline: boolean } }>;
  onGetMerchantTransactions: (merchant: string) => Promise<Transaction[]>;
  onMerchantTransactionClick: (transaction: Transaction) => void;
}

const MerchantManagementPage: React.FC<MerchantManagementPageProps> = ({
  transactions,
  paymentMethodDisplayMode,
  onClose,
  onDataChange,
  onPreviewMerchantRename,
  onRenameMerchant,
  onGetMerchantTransactions,
  onMerchantTransactionClick,
}) => {
  const merchantSummaries = useMemo(() => getMerchantUsageSummaries(transactions), [transactions]);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string }>({ type: 'idle', message: '' });
  const [selectedMerchantToRename, setSelectedMerchantToRename] = useState('');
  const [renamedMerchantInput, setRenamedMerchantInput] = useState('');
  const [merchantRenamePreview, setMerchantRenamePreview] = useState<MerchantRenamePreview | null>(null);
  const [isMerchantPreviewLoading, setIsMerchantPreviewLoading] = useState(false);
  const [isMerchantRenameSubmitting, setIsMerchantRenameSubmitting] = useState(false);
  const [merchantTransactions, setMerchantTransactions] = useState<Transaction[]>([]);
  const [isMerchantTransactionsLoading, setIsMerchantTransactionsLoading] = useState(false);

  useEffect(() => {
    if (!selectedMerchantToRename) return;
    const normalizedSelectedMerchant = normalizeMerchantName(selectedMerchantToRename);
    const hasSelectedMerchant = merchantSummaries.some(({ merchant }) => merchant === normalizedSelectedMerchant);
    if (!hasSelectedMerchant) {
      setSelectedMerchantToRename('');
      setRenamedMerchantInput('');
      setMerchantRenamePreview(null);
      setMerchantTransactions([]);
    }
  }, [merchantSummaries, selectedMerchantToRename]);

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

  const resetMerchantRenameState = (nextSelectedMerchant = '') => {
    setSelectedMerchantToRename(nextSelectedMerchant);
    setRenamedMerchantInput('');
    setMerchantRenamePreview(null);
    setIsMerchantPreviewLoading(false);
    setIsMerchantRenameSubmitting(false);
    if (!nextSelectedMerchant) {
      setMerchantTransactions([]);
      setIsMerchantTransactionsLoading(false);
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
      } else if (preview.conflictsWithExistingMerchant) {
        setStatus({ type: 'success', message: `提醒：${preview.newMerchant} 已存在，執行後會合併到相同商家名稱` });
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
      const result = await onRenameMerchant(selectedMerchantToRename, renamedMerchantInput);
      resetMerchantRenameState('');
      onDataChange();

      if (result.skippedOffline) {
        setStatus({
          type: 'success',
          message: `已將 ${result.oldMerchant} 更名為 ${result.newMerchant}，共更新 ${result.affectedCount} 筆\n目前離線，待恢復連線後同步`,
        });
        return;
      }

      if (result.syncResult && result.syncResult.failed > 0) {
        setStatus({
          type: 'error',
          message: `已將 ${result.oldMerchant} 更名為 ${result.newMerchant}，共更新 ${result.affectedCount} 筆\n同步失敗 ${result.syncResult.failed}/${result.syncResult.total} 筆`,
        });
        return;
      }

      setStatus({ type: 'idle', message: '' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || '商家更名失敗' });
    } finally {
      setIsMerchantRenameSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#1a1c2c] overflow-hidden text-slate-200">
      <PageHeader
        title="商家管理"
        leftAction={<ArrowLeft size={26} />}
        onLeftAction={onClose}
      />

      <div className="flex-1 overflow-y-auto px-4 pt-6 sm:px-6 sm:pt-8 no-scrollbar bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.12),_transparent_28%),linear-gradient(180deg,_#1f2235_0%,_#171a29_48%,_#121520_100%)]">
        <div className="mx-auto max-w-5xl space-y-6 pb-10">
          <MerchantManagementSection
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

          {status.type !== 'idle' && (
            <div className={`flex items-center gap-3 rounded-2xl border p-4 animate-slide-up ${status.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
              {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              <span className="text-sm font-bold whitespace-pre-line">{status.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MerchantManagementPage;
