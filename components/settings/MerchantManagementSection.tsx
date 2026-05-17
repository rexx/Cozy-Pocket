import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CloudUpload, Eye, LoaderCircle, PencilLine, Search, X } from 'lucide-react';
import { PaymentMethodDisplayMode, Transaction } from '../../types';
import { MerchantRenamePreview, MerchantUsageSummary, normalizeMerchantName } from '../../services/merchantService';
import TransactionItem from '../TransactionItem';
import SettingsSection, {
  sectionCyanButtonClassName,
  sectionEmeraldButtonClassName,
  sectionInputClassName,
  sectionLabelClassName,
  sectionPanelClassName,
  sectionSecondaryButtonClassName,
} from './SettingsSection';
import type { SettingsStatus, SettingsStatusAction } from './settingsStatus';

const MERCHANT_PAGE_SIZE = 200;

type MerchantFeedbackTone = 'error' | 'success' | 'warning';

const merchantFeedbackCardClassName: Record<MerchantFeedbackTone, string> = {
  error: 'border-red-500/20 bg-red-500/10 text-red-200',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-400/20 bg-amber-500/10 text-slate-200',
};

const merchantFeedbackTitleClassName: Record<MerchantFeedbackTone, string> = {
  error: 'text-red-200',
  success: 'text-emerald-200',
  warning: 'text-amber-300',
};

interface MerchantManagementSectionProps {
  status: SettingsStatus;
  merchantSummaries: MerchantUsageSummary[];
  selectedMerchantToRename: string;
  renamedMerchantInput: string;
  merchantRenamePreview: MerchantRenamePreview | null;
  merchantTransactions: Transaction[];
  paymentMethodDisplayMode: PaymentMethodDisplayMode;
  isMerchantPreviewLoading: boolean;
  isMerchantRenameSubmitting: boolean;
  isMerchantTransactionsLoading: boolean;
  onSelectMerchantToRename: (merchant: string) => void;
  onRenamedMerchantInputChange: (value: string) => void;
  onPreviewMerchantRename: () => void;
  onRenameMerchant: () => void;
  onMerchantTransactionClick: (transaction: Transaction) => void;
}

const merchantFeedbackActionClassName: Record<MerchantFeedbackTone, string> = {
  error: 'border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/25',
  success: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25',
  warning: 'border-amber-400/30 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25',
};

const MerchantFeedbackCard: React.FC<{
  children: React.ReactNode;
  title?: string;
  tone: MerchantFeedbackTone;
  action?: SettingsStatusAction;
}> = ({ children, title, tone, action }) => (
  <div className={`rounded-2xl border px-4 py-3 text-xs ${merchantFeedbackCardClassName[tone]}`}>
    {title && <p className={`font-black ${merchantFeedbackTitleClassName[tone]}`}>{title}</p>}
    <div className={title ? 'mt-1 space-y-1' : 'space-y-1'}>
      {children}
    </div>
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-xs font-black transition-colors sm:w-auto ${merchantFeedbackActionClassName[tone]}`}
      >
        <CloudUpload size={14} />
        {action.label}
      </button>
    )}
  </div>
);

const MerchantManagementSection: React.FC<MerchantManagementSectionProps> = ({
  status,
  merchantSummaries,
  selectedMerchantToRename,
  renamedMerchantInput,
  merchantRenamePreview,
  merchantTransactions,
  paymentMethodDisplayMode,
  isMerchantPreviewLoading,
  isMerchantRenameSubmitting,
  isMerchantTransactionsLoading,
  onSelectMerchantToRename,
  onRenamedMerchantInputChange,
  onPreviewMerchantRename,
  onRenameMerchant,
  onMerchantTransactionClick,
}) => {
  const [merchantSearchQuery, setMerchantSearchQuery] = useState('');
  const [visibleMerchantCount, setVisibleMerchantCount] = useState(MERCHANT_PAGE_SIZE);
  const normalizedMerchantInput = normalizeMerchantName(renamedMerchantInput);
  const isPreviewDisabled = !normalizedMerchantInput || isMerchantPreviewLoading || isMerchantRenameSubmitting;
  const affectedTransactionCount = merchantRenamePreview?.affectedCount ?? merchantTransactions.length;

  const filteredMerchantSummaries = useMemo(() => {
    const query = merchantSearchQuery.trim().toLocaleLowerCase();
    if (!query) return merchantSummaries;

    return merchantSummaries.filter(({ merchant }) => (
      merchant.toLocaleLowerCase().includes(query)
    ));
  }, [merchantSearchQuery, merchantSummaries]);

  const visibleMerchantSummaries = useMemo(() => (
    filteredMerchantSummaries.slice(0, visibleMerchantCount)
  ), [filteredMerchantSummaries, visibleMerchantCount]);

  const selectedMerchantSummary = selectedMerchantToRename
    ? filteredMerchantSummaries.find(({ merchant }) => merchant === selectedMerchantToRename)
    : undefined;
  const selectedMerchantInFilteredResults = Boolean(selectedMerchantSummary);
  const selectedMerchantIsVisible = selectedMerchantToRename
    ? visibleMerchantSummaries.some(({ merchant }) => merchant === selectedMerchantToRename)
    : false;
  const hasMoreMerchants = visibleMerchantSummaries.length < filteredMerchantSummaries.length;

  const handleMerchantSearchQueryChange = (value: string) => {
    setMerchantSearchQuery(value);
    setVisibleMerchantCount(MERCHANT_PAGE_SIZE);
  };

  useEffect(() => {
    setVisibleMerchantCount(MERCHANT_PAGE_SIZE);
  }, [merchantSummaries]);

  const statusMessage = status.type !== 'idle' ? (
    <MerchantFeedbackCard tone={status.type} action={status.action}>
      <p className="text-sm font-bold whitespace-pre-line">{status.message}</p>
    </MerchantFeedbackCard>
  ) : null;
  const renameFeedbackMessage = !merchantRenamePreview && status.type !== 'idle' ? statusMessage : null;
  const resultStatusMessage = !selectedMerchantToRename && status.type !== 'idle'
    ? statusMessage
    : null;

  return (
    <SettingsSection>
      {merchantSummaries.length === 0 ? (
        <div className={`${sectionPanelClassName} text-sm text-slate-400`}>目前還沒有可管理的商家。</div>
      ) : (
        <>
          <div className={sectionPanelClassName}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className={sectionLabelClassName}>Select Merchant</p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  顯示 {visibleMerchantSummaries.length} / {filteredMerchantSummaries.length} 個商家，共 {merchantSummaries.length} 個
                </p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={merchantSearchQuery}
                  onChange={(e) => handleMerchantSearchQueryChange(e.target.value)}
                  placeholder="搜尋商家"
                  className={`${sectionInputClassName} pl-10 pr-10`}
                />
                {merchantSearchQuery && (
                  <button
                    type="button"
                    onClick={() => handleMerchantSearchQueryChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-white"
                    aria-label="清除商家搜尋"
                    title="清除商家搜尋"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {filteredMerchantSummaries.length > 0 ? (
              <>
                <div className="mt-4 flex max-h-[50vh] flex-wrap gap-2 overflow-y-auto overscroll-contain pr-1 no-scrollbar">
                  {selectedMerchantSummary && !selectedMerchantIsVisible && (
                    <button
                      type="button"
                      onClick={() => onSelectMerchantToRename(selectedMerchantSummary.merchant)}
                      className="min-w-0 max-w-full break-words rounded-2xl border border-amber-400/25 bg-amber-500/12 px-3 py-2 text-left text-xs font-black leading-snug text-amber-100 transition-colors"
                    >
                      {selectedMerchantSummary.merchant} · {selectedMerchantSummary.count} 筆 · 已選取
                    </button>
                  )}
                  {visibleMerchantSummaries.map(({ merchant, count }) => (
                    <button
                      key={merchant}
                      type="button"
                      onClick={() => onSelectMerchantToRename(merchant)}
                      className={`min-w-0 max-w-full break-words rounded-2xl border px-3 py-2 text-left text-xs font-black leading-snug transition-colors ${
                        selectedMerchantToRename === merchant
                          ? 'border-amber-400/25 bg-amber-500/12 text-amber-100'
                          : 'border-white/10 bg-[#0f1321] text-slate-300 hover:text-white'
                      }`}
                    >
                      {merchant} · {count} 筆
                    </button>
                  ))}
                </div>

                {hasMoreMerchants && (
                  <button
                    type="button"
                    onClick={() => setVisibleMerchantCount((current) => current + MERCHANT_PAGE_SIZE)}
                    className={`${sectionSecondaryButtonClassName} mt-4 w-full sm:w-auto`}
                  >
                    載入更多商家
                  </button>
                )}
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#0f1321] px-4 py-6 text-center text-sm text-slate-400">
                找不到符合「{merchantSearchQuery.trim()}」的商家。
              </div>
            )}

            {merchantSearchQuery.trim() && selectedMerchantToRename && !selectedMerchantInFilteredResults && (
              <p className="mt-3 text-xs font-bold text-amber-200">
                目前選取的商家不在搜尋結果中；清空搜尋可回到完整清單。
              </p>
            )}
          </div>

          {resultStatusMessage}

          {selectedMerchantToRename ? (
            <div className={`${sectionPanelClassName} space-y-4`}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className={sectionLabelClassName}>Current Merchant</label>
                  <div className="rounded-2xl border border-white/10 bg-[#0f1321] px-3 py-3 text-sm font-bold text-white">
                    {selectedMerchantToRename}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={sectionLabelClassName}>New Merchant Name</label>
                  <div className="relative">
                    <PencilLine size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={renamedMerchantInput}
                      onChange={(e) => onRenamedMerchantInputChange(e.target.value)}
                      placeholder="輸入新的商家名稱"
                      className={`${sectionInputClassName} pl-10`}
                      disabled={isMerchantPreviewLoading || isMerchantRenameSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={onPreviewMerchantRename}
                  disabled={isPreviewDisabled}
                  className={sectionCyanButtonClassName}
                >
                  <Eye size={16} />
                  {isMerchantPreviewLoading ? '預覽中...' : '預覽影響筆數'}
                </button>
              </div>

              {merchantRenamePreview && (
                <MerchantFeedbackCard title="更名預覽" tone="warning">
                  <p>{merchantRenamePreview.oldMerchant} → {merchantRenamePreview.newMerchant}</p>
                  <p className="text-emerald-300">預計影響：{merchantRenamePreview.affectedCount} 筆交易</p>
                  {merchantRenamePreview.normalizedInput !== renamedMerchantInput.trim() && (
                    <p className="text-slate-300">輸入會整理為：{merchantRenamePreview.normalizedInput}</p>
                  )}
                  {merchantRenamePreview.willMerge && (
                    <p className="text-amber-200">
                      提醒：{merchantRenamePreview.newMerchant} 已存在；確認後會合併到既有商家，不會新增重複商家。
                    </p>
                  )}
                </MerchantFeedbackCard>
              )}
              {renameFeedbackMessage}

              {merchantRenamePreview && (
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={onRenameMerchant}
                    disabled={merchantRenamePreview.affectedCount === 0 || isMerchantPreviewLoading || isMerchantRenameSubmitting}
                    className={sectionEmeraldButtonClassName}
                  >
                    {isMerchantRenameSubmitting ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    {isMerchantRenameSubmitting ? '更名中...' : '確認更名'}
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className={sectionLabelClassName}>{merchantRenamePreview ? 'Affected Transactions' : 'Related Transactions'}</p>
                  <span className="text-xs font-bold text-slate-400">
                    {selectedMerchantToRename} · {affectedTransactionCount} 筆
                  </span>
                </div>
                <div className="max-h-[50vh] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0f1321] no-scrollbar">
                  {isMerchantTransactionsLoading ? (
                    <div className="px-4 py-6 text-center text-sm text-slate-400">載入中...</div>
                  ) : merchantTransactions.length > 0 ? (
                    merchantTransactions.map((tx) => (
                      <TransactionItem
                        key={tx.id}
                        transaction={tx}
                        onClick={onMerchantTransactionClick}
                        paymentMethodDisplayMode={paymentMethodDisplayMode}
                        showDateTime
                      />
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-slate-400">目前沒有符合這個商家的交易。</div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </SettingsSection>
  );
};

export default MerchantManagementSection;
