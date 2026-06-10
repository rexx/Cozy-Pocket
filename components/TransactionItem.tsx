
import React from 'react';
import { PaymentMethodDisplayMode, Transaction } from '../types';
import { CATEGORIES, formatCurrencyAmount } from '../constants';
import { MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { toEpochMillis } from '../time';
import { categoryIconMap } from './categoryIcons';
import { getPaymentMethodIcon } from './paymentMethodIcons';

interface TransactionItemProps {
  transaction: Transaction;
  onClick?: (transaction: Transaction) => void;
  showDateTime?: boolean;
  paymentMethodDisplayMode?: PaymentMethodDisplayMode;
  shouldSuppressClick?: () => boolean;
}

const SYNC_STATUS_UI: Record<'pending' | 'syncing' | 'synced' | 'error', { dotClassName: string; title: string }> = {
  pending: {
    title: '待同步',
    dotClassName: 'bg-amber-300'
  },
  syncing: {
    title: '同步中',
    dotClassName: 'border border-gray-400 bg-transparent'
  },
  synced: {
    title: '已同步',
    dotClassName: 'bg-emerald-300'
  },
  error: {
    title: '同步失敗',
    dotClassName: 'bg-rose-300'
  }
};

const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onClick,
  showDateTime = false,
  paymentMethodDisplayMode = 'text',
  shouldSuppressClick,
}) => {
  const category = CATEGORIES.find(c => c.id === transaction.categoryId) || CATEGORIES[CATEGORIES.length - 1];
  const subCategory = category.subcategories?.find(s => s.id === transaction.subCategoryId);
  const isIncome = transaction.type === '收入';

  const iconName = (!isIncome && subCategory) ? subCategory.icon : category.icon;
  const IconComp = categoryIconMap[iconName] || MoreHorizontal;

  let title = '';
  if (transaction.name) {
    title = transaction.name;
  } else if (transaction.merchant) {
    title = transaction.merchant;
  } else if (subCategory) {
    title = subCategory.name;
  } else {
    title = category.name;
  }

  const subtitleParts: string[] = [];
  if (transaction.name && title !== transaction.name) subtitleParts.push(transaction.name);
  if (transaction.merchant && title !== transaction.merchant) subtitleParts.push(transaction.merchant);
  if (subCategory && title !== subCategory.name) subtitleParts.push(subCategory.name);
  else if (!subCategory && title !== category.name) subtitleParts.push(category.name);
  if (transaction.note) subtitleParts.push(transaction.note);

  const tags = transaction.tags
    ? transaction.tags.split(/\s+/).filter(t => t.length > 0)
    : [];

  const displayAmount = isIncome ? transaction.amount : -transaction.amount;
  const formattedAmount = `${displayAmount < 0 ? '-' : ''}${formatCurrencyAmount(displayAmount, transaction.currency)}`;

  const formattedTime = format(
    new Date(toEpochMillis(transaction.timestamp)),
    showDateTime ? 'yyyy-MM-dd HH:mm' : 'HH:mm'
  );
  const syncStatus = transaction.syncStatus || 'pending';
  const syncStatusUi = SYNC_STATUS_UI[syncStatus];
  const paymentMethodIcon = paymentMethodDisplayMode === 'icon'
    ? getPaymentMethodIcon(transaction.paymentMethod)
    : null;
  const PaymentMethodIcon = paymentMethodIcon;

  return (
    <div 
      onClick={() => {
        if (shouldSuppressClick?.()) return;
        onClick?.(transaction);
      }}
      className={`flex items-center gap-4 py-4 px-5 transition-all duration-200 border-b border-white/5 last:border-0 group ${
        onClick ? 'cursor-pointer active:bg-white/5' : ''
      }`}
    >
      <div 
        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform group-active:scale-90 transition-transform flex-shrink-0"
        style={{ backgroundColor: category.color }}
      >
        <IconComp size={22} color="white" strokeWidth={2.5} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-0.5">
          {/* When tags exist, cap the title width so a long title cannot push tags
              out entirely; tags then use all remaining space and truncate only when
              the row genuinely runs out of room. flex-1 makes the percentage cap
              resolve against the full row width instead of a content-sized box. */}
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <h3
              className={`text-gray-100 font-bold truncate text-base tracking-tight leading-tight ${
                tags.length > 0 ? 'flex-shrink-0 max-w-[65%]' : ''
              }`}
            >
              {title}
            </h3>
            {tags.length > 0 && (
              <span className="flex items-center gap-1 min-w-0">
                {tags.map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className="min-w-0 truncate text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-400 font-bold border border-white/5"
                  >
                    #{tag}
                  </span>
                ))}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
            <span
              title={syncStatusUi.title}
              aria-label={syncStatusUi.title}
              className={`inline-block w-1.5 h-1.5 rounded-full ${syncStatusUi.dotClassName}`}
            />
            <span className="text-[10px] text-gray-600 font-bold tabular-nums">
              {formattedTime}
            </span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <p className="text-gray-500 text-xs truncate pr-4 font-medium">
            {subtitleParts.join(' · ')}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {PaymentMethodIcon ? (
              <span
                title={transaction.paymentMethod}
                aria-label={transaction.paymentMethod}
                className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-white/5 bg-white/5 text-gray-500"
              >
                <PaymentMethodIcon size={13} strokeWidth={2.5} />
              </span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-500 font-black uppercase tracking-widest border border-white/5">
                {transaction.paymentMethod}
              </span>
            )}
            <span className={`font-black text-lg tabular-nums ${isIncome ? 'text-rose-400' : 'text-emerald-400'}`}>
              {formattedAmount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionItem;
