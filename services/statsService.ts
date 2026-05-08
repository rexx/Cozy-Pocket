import { endOfMonth, endOfYear } from 'date-fns';
import { Transaction, TransactionType } from '../types';
import { toEpochSeconds } from '../time';
import { extractTransactionTags, normalizeTag } from './tagService';

export interface CurrencyStats {
  income: number;
  expense: number;
}

export interface CategoryStatsSubItem {
  subCategoryId: string;
  total: number;
  count: number;
  transactions: Transaction[];
}

export interface CategoryStatsItem {
  currency: string;
  type: TransactionType;
  categoryId: string;
  total: number;
  count: number;
  transactions: Transaction[];
  subcategories: CategoryStatsSubItem[];
}

type MutableCategoryStatsItem = Omit<CategoryStatsItem, 'subcategories'> & {
  subcategoryMap: Map<string, CategoryStatsSubItem>;
};

export const getStatsByCurrency = (txs: Transaction[]) => {
  return txs.reduce((acc, curr) => {
    const currency = curr.currency || 'TWD';
    if (!acc[currency]) {
      acc[currency] = { income: 0, expense: 0 };
    }

    if (curr.type === '收入') {
      acc[currency].income += Math.abs(curr.amount);
    } else {
      acc[currency].expense += Math.abs(curr.amount);
    }

    return acc;
  }, {} as Record<string, CurrencyStats>);
};

export const getCategoryStats = (txs: Transaction[]): CategoryStatsItem[] => {
  const grouped = new Map<string, MutableCategoryStatsItem>();

  txs.forEach((tx) => {
    const currency = tx.currency || 'TWD';
    const categoryId = tx.categoryId || '';
    const key = `${currency}:${tx.type}:${categoryId}`;
    const amount = Math.abs(tx.amount);
    let item = grouped.get(key);

    if (!item) {
      item = {
        currency,
        type: tx.type,
        categoryId,
        total: 0,
        count: 0,
        transactions: [],
        subcategoryMap: new Map<string, CategoryStatsSubItem>(),
      };
      grouped.set(key, item);
    }

    item.total += amount;
    item.count += 1;
    item.transactions.push(tx);

    if (tx.type === '支出' || tx.subCategoryId) {
      const subCategoryId = tx.subCategoryId || '';
      let subItem = item.subcategoryMap.get(subCategoryId);

      if (!subItem) {
        subItem = {
          subCategoryId,
          total: 0,
          count: 0,
          transactions: [],
        };
        item.subcategoryMap.set(subCategoryId, subItem);
      }

      subItem.total += amount;
      subItem.count += 1;
      subItem.transactions.push(tx);
    }
  });

  return Array.from(grouped.values())
    .map(({ subcategoryMap, ...item }) => ({
      ...item,
      subcategories: Array.from(subcategoryMap.values()).sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        if (b.count !== a.count) return b.count - a.count;
        return a.subCategoryId.localeCompare(b.subCategoryId);
      }),
    }))
    .sort((a, b) => {
      if (a.currency !== b.currency) return a.currency.localeCompare(b.currency);
      if (a.type !== b.type) return a.type === '支出' ? -1 : 1;
      if (b.total !== a.total) return b.total - a.total;
      if (b.count !== a.count) return b.count - a.count;
      return a.categoryId.localeCompare(b.categoryId);
    });
};

export const getMonthTransactions = (transactions: Transaction[], date: Date) => {
  const start = toEpochSeconds(new Date(date.getFullYear(), date.getMonth(), 1).getTime());
  const end = toEpochSeconds(endOfMonth(date).getTime());
  return transactions.filter((tx) => tx.timestamp >= start && tx.timestamp <= end);
};

export const getYearTransactions = (transactions: Transaction[], date: Date) => {
  const start = toEpochSeconds(new Date(date.getFullYear(), 0, 1).getTime());
  const end = toEpochSeconds(endOfYear(date).getTime());
  return transactions.filter((tx) => tx.timestamp >= start && tx.timestamp <= end);
};

export const getMonthTags = (transactions: Transaction[]) => {
  const tagSet = new Set<string>();
  transactions.forEach((tx) => {
    extractTransactionTags(tx).forEach((tag) => tagSet.add(tag));
  });
  return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
};

export const filterTransactionsByTag = (transactions: Transaction[], tag: string) => {
  const normalized = normalizeTag(tag);
  if (!normalized) return transactions;
  return transactions.filter((tx) => extractTransactionTags(tx).includes(normalized));
};
