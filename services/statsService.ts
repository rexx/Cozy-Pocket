import { endOfMonth, endOfYear } from 'date-fns';
import { Transaction } from '../types';
import { toEpochSeconds } from '../time';

export interface CurrencyStats {
  income: number;
  expense: number;
}

export const normalizeTag = (tag: string) => tag.trim().replace(/^#+/, '');

export const extractTransactionTags = (tx: Transaction) => (
  tx.tags
    ? tx.tags.split(/\s+/).map(normalizeTag).filter(Boolean)
    : []
);

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
