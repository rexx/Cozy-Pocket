import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { PaymentMethodDisplayMode, Transaction } from '../types';
import { MerchantRenamePreview, getMerchantUsageSummaries, normalizeMerchantName } from '../services/merchantService';
import PageHeader from './PageHeader';
import MerchantManagementSection from './settings/MerchantManagementSection';

interface MerchantManagementPageProps {
  transactions: Transaction[];
  paymentMethodDisplayMode: PaymentMethodDisplayMode;
  onClose: () => void;
  onDataChange: () => void | Promise<void>;
  onPreviewMerchantRename: (oldMerchant: string, newMerchant: string) => Promise<MerchantRenamePreview>;
  onRenameMerchant: (oldMerchant: string, newMerchant: string) => Promise<MerchantRenamePreview & { skippedOffline: boolean; syncResult?: { total: number; failed: number; skippedOffline: boolean } }>;
  onGetMerchantTransactions: (merchant: string) => Promise<Transaction[]>;
  onMerchantTransactionClick: (transaction: Transaction) => void;
}

type MerchantManagementStatus = {
  type: 'success' | 'error' | 'idle';
  message: string;
};

type MerchantRenameResult = MerchantRenamePreview & {
  skippedOffline: boolean;
  syncResult?: { total: number; failed: number; skippedOffline: boolean };
};

const getMerchantRenameActionMessage = (result: MerchantRenamePreview) => (
  result.willMerge
    ? `已將 ${result.oldMerchant} 合併到 ${result.newMerchant}`
    : `已將 ${result.oldMerchant} 更名為 ${result.newMerchant}`
);

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
  const [status, setStatus] = useState<MerchantManagementStatus>({ type: 'idle', message: '' });
  const [selectedMerchantToRename, setSelectedMerchantToRename] = useState('');
  const [renamedMerchantInput, setRenamedMerchantInput] = useState('');
  const [merchantRenamePreview, setMerchantRenamePreview] = useState<MerchantRenamePreview | null>(null);
  const [isMerchantPreviewLoading, setIsMerchantPreviewLoading] = useState(false);
  const [isMerchantRenameSubmitting, setIsMerchantRenameSubmitting] = useState(false);
  const [merchantTransactions, setMerchantTransactions] = useState<Transaction[]>([]);
  const [isMerchantTransactionsLoading, setIsMerchantTransactionsLoading] = useState(false);

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
      const result: MerchantRenameResult = await onRenameMerchant(
        merchantRenamePreview.oldMerchant,
        merchantRenamePreview.newMerchant
      );
      await onDataChange();
      resetMerchantRenameState(result.newMerchant);
      const actionMessage = getMerchantRenameActionMessage(result);

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
              setStatus({ type: 'idle', message: '' });
            }}
            onPreviewMerchantRename={() => void handlePreviewMerchantRename()}
            onRenameMerchant={() => void handleRenameMerchant()}
            onMerchantTransactionClick={onMerchantTransactionClick}
          />
        </div>
      </div>
    </div>
  );
};

export default MerchantManagementPage;
