import React from 'react';
import { PencilLine, Store } from 'lucide-react';
import { Transaction } from '../../types';
import { MerchantRenamePreview, MerchantUsageSummary } from '../../services/merchantService';
import TransactionItem from '../TransactionItem';
import SettingsSection, {
  sectionCyanButtonClassName,
  sectionEmeraldButtonClassName,
  sectionInputClassName,
  sectionLabelClassName,
  sectionPanelClassName,
} from './SettingsSection';

interface MerchantManagementSectionProps {
  merchantSummaries: MerchantUsageSummary[];
  selectedMerchantToRename: string;
  renamedMerchantInput: string;
  merchantRenamePreview: MerchantRenamePreview | null;
  merchantTransactions: Transaction[];
  isMerchantPreviewLoading: boolean;
  isMerchantRenameSubmitting: boolean;
  isMerchantTransactionsLoading: boolean;
  onSelectMerchantToRename: (merchant: string) => void;
  onRenamedMerchantInputChange: (value: string) => void;
  onPreviewMerchantRename: () => void;
  onRenameMerchant: () => void;
  onMerchantTransactionClick: (transaction: Transaction) => void;
}

const MerchantManagementSection: React.FC<MerchantManagementSectionProps> = ({
  merchantSummaries,
  selectedMerchantToRename,
  renamedMerchantInput,
  merchantRenamePreview,
  merchantTransactions,
  isMerchantPreviewLoading,
  isMerchantRenameSubmitting,
  isMerchantTransactionsLoading,
  onSelectMerchantToRename,
  onRenamedMerchantInputChange,
  onPreviewMerchantRename,
  onRenameMerchant,
  onMerchantTransactionClick,
}) => {
  return (
    <SettingsSection
      title="商家管理"
      description="批次更名既有商家，並同步更新所有相關交易。"
      icon={Store}
      accentClassName="border-amber-400/20 bg-amber-500/12 text-amber-200"
    >
      {merchantSummaries.length === 0 ? (
        <div className={`${sectionPanelClassName} text-sm text-slate-400`}>目前還沒有可管理的商家。</div>
      ) : (
        <>
          <div className={sectionPanelClassName}>
            <p className={`${sectionLabelClassName} mb-3`}>Select Merchant</p>
            <div className="flex flex-wrap gap-2">
              {merchantSummaries.map(({ merchant, count }) => (
                <button
                  key={merchant}
                  type="button"
                  onClick={() => onSelectMerchantToRename(merchant)}
                  className={`rounded-full border px-3 py-2 text-xs font-black transition-colors ${
                    selectedMerchantToRename === merchant
                      ? 'border-amber-400/25 bg-amber-500/12 text-amber-100'
                      : 'border-white/10 bg-[#0f1321] text-slate-300 hover:text-white'
                  }`}
                >
                  {merchant} · {count} 筆
                </button>
              ))}
            </div>
          </div>

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

              {merchantRenamePreview && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-slate-200">
                  <p className="font-black text-amber-300">更名預覽</p>
                  <p className="mt-1">{merchantRenamePreview.oldMerchant} → {merchantRenamePreview.newMerchant}</p>
                  <p className="mt-1 text-emerald-300">預計影響：{merchantRenamePreview.affectedCount} 筆交易</p>
                  {merchantRenamePreview.conflictsWithExistingMerchant && (
                    <p className="mt-1 text-amber-200">提醒：新商家名稱已存在；確認後會將既有交易合併到同一名稱。</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={onPreviewMerchantRename}
                  disabled={!renamedMerchantInput.trim() || isMerchantPreviewLoading || isMerchantRenameSubmitting}
                  className={sectionCyanButtonClassName}
                >
                  {isMerchantPreviewLoading ? '預覽中...' : '預覽影響筆數'}
                </button>
                <button
                  type="button"
                  onClick={onRenameMerchant}
                  disabled={!merchantRenamePreview || merchantRenamePreview.affectedCount === 0 || isMerchantPreviewLoading || isMerchantRenameSubmitting}
                  className={sectionEmeraldButtonClassName}
                >
                  {isMerchantRenameSubmitting ? '更名中...' : '確認更名'}
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className={sectionLabelClassName}>Related Transactions</p>
                  <span className="text-xs font-bold text-slate-400">
                    {selectedMerchantToRename} · {merchantTransactions.length} 筆
                  </span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f1321]">
                  {isMerchantTransactionsLoading ? (
                    <div className="px-4 py-6 text-center text-sm text-slate-400">載入中...</div>
                  ) : merchantTransactions.length > 0 ? (
                    merchantTransactions.map((tx) => (
                      <TransactionItem
                        key={tx.id}
                        transaction={tx}
                        onClick={onMerchantTransactionClick}
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
