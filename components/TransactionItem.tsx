
import React from 'react';
import { PaymentMethodDisplayMode, Transaction } from '../types';
import { CATEGORIES, formatCurrencyAmount } from '../constants';
import { MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { toEpochMillis } from '../time';
import { categoryIconMap } from './categoryIcons';
import { getPaymentMethodIcon } from './paymentMethodIcons';

/** `compact` trades the visible year and time for title width; the full value moves to title / aria-label. */
type DateTimeDisplayMode = 'full' | 'compact';

interface TransactionItemProps {
  transaction: Transaction;
  onClick?: (transaction: Transaction) => void;
  showDateTime?: boolean;
  dateTimeDisplayMode?: DateTimeDisplayMode;
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
  dateTimeDisplayMode = 'full',
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

  const transactionDate = new Date(toEpochMillis(transaction.timestamp));
  const fullDateTime = format(transactionDate, 'yyyy-MM-dd HH:mm');
  const isCompactDate = showDateTime && dateTimeDisplayMode === 'compact';
  const formattedTime = isCompactDate
    ? format(transactionDate, 'MM-dd')
    : showDateTime ? fullDateTime : format(transactionDate, 'HH:mm');
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
          <h3 className="min-w-0 text-gray-100 font-bold truncate text-base tracking-tight leading-tight">
            {title}
          </h3>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
            <span
              title={syncStatusUi.title}
              aria-label={syncStatusUi.title}
              className={`inline-block w-1.5 h-1.5 rounded-full ${syncStatusUi.dotClassName}`}
            />
            <span
              title={isCompactDate ? fullDateTime : undefined}
              aria-label={isCompactDate ? fullDateTime : undefined}
              className="text-[10px] text-gray-600 font-bold tabular-nums whitespace-nowrap"
            >
              {formattedTime}
            </span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          {/* Shrink order on this row: the subtitle gives up width first so tag
              chips stay fully readable. The chip group is capped at the row width
              so a single overlong tag truncates instead of overlapping the amount. */}
          <div className="flex min-w-0 items-center gap-2">
            {subtitleParts.length > 0 && (
              <p className="text-gray-500 text-xs truncate font-medium">
                {subtitleParts.join(' · ')}
              </p>
            )}
            {tags.length > 0 && (
              <span className="flex min-w-0 max-w-full flex-shrink-0 items-center gap-1">
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
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
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
