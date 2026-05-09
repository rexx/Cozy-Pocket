import { Transaction } from '../types';

export interface MerchantUsageSummary {
  merchant: string;
  count: number;
}

export interface MerchantRenamePreview {
  oldMerchant: string;
  newMerchant: string;
  normalizedInput: string;
  affectedCount: number;
  willMerge: boolean;
  mergeTargetMerchant?: string;
  conflictsWithExistingMerchant: boolean;
}

export const normalizeMerchantName = (merchant: string) => merchant.trim().replace(/\s+/g, ' ');

const getMerchantComparisonKey = (merchant: string) => normalizeMerchantName(merchant).toLocaleLowerCase();

export const getMerchantUsageSummaries = (transactions: Transaction[]): MerchantUsageSummary[] => {
  const merchantCountMap = new Map<string, MerchantUsageSummary>();

  transactions.forEach((tx) => {
    const merchant = normalizeMerchantName(tx.merchant || '');
    if (!merchant) return;

    const merchantKey = getMerchantComparisonKey(merchant);
    const existing = merchantCountMap.get(merchantKey);

    if (existing) {
      merchantCountMap.set(merchantKey, {
        merchant: existing.merchant,
        count: existing.count + 1,
      });
      return;
    }

    merchantCountMap.set(merchantKey, { merchant, count: 1 });
  });

  return Array.from(merchantCountMap.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.merchant.localeCompare(b.merchant, 'zh-Hant');
    });
};

export const getTransactionsByMerchant = (
  transactions: Transaction[],
  merchant: string
) => {
  const merchantKey = getMerchantComparisonKey(merchant);
  if (!merchantKey) return [];

  return transactions
    .filter((tx) => getMerchantComparisonKey(tx.merchant || '') === merchantKey)
    .sort((a, b) => b.timestamp - a.timestamp);
};

export const buildMerchantRenamePreview = (
  transactions: Transaction[],
  oldMerchant: string,
  newMerchant: string
): MerchantRenamePreview => {
  const normalizedOldMerchant = normalizeMerchantName(oldMerchant);
  const normalizedNewMerchant = normalizeMerchantName(newMerchant);
  const oldMerchantKey = getMerchantComparisonKey(normalizedOldMerchant);
  const newMerchantKey = getMerchantComparisonKey(normalizedNewMerchant);

  if (!normalizedOldMerchant) {
    throw new Error('請先選擇要更名的商家');
  }

  if (!normalizedNewMerchant) {
    throw new Error('請輸入新的商家名稱');
  }

  if (normalizedOldMerchant === normalizedNewMerchant) {
    throw new Error('新商家名稱不可與原名稱相同');
  }

  const existingMerchantByKey = new Map(
    getMerchantUsageSummaries(transactions).map((item) => [
      getMerchantComparisonKey(item.merchant),
      item.merchant,
    ])
  );

  const existingOldMerchant = existingMerchantByKey.get(oldMerchantKey);
  if (!existingOldMerchant) {
    throw new Error(`找不到要更名的商家：${normalizedOldMerchant}`);
  }

  const affectedCount = transactions.filter((tx) => (
    getMerchantComparisonKey(tx.merchant || '') === oldMerchantKey
  )).length;

  const mergeTargetMerchant = existingMerchantByKey.get(newMerchantKey);
  const willMerge = oldMerchantKey !== newMerchantKey && Boolean(mergeTargetMerchant);
  const targetMerchant = willMerge && mergeTargetMerchant
    ? mergeTargetMerchant
    : normalizedNewMerchant;

  return {
    oldMerchant: existingOldMerchant,
    newMerchant: targetMerchant,
    normalizedInput: normalizedNewMerchant,
    affectedCount,
    willMerge,
    mergeTargetMerchant,
    conflictsWithExistingMerchant: willMerge,
  };
};

export const renameMerchantInTransactions = (
  transactions: Transaction[],
  oldMerchant: string,
  newMerchant: string
) => {
  const preview = buildMerchantRenamePreview(transactions, oldMerchant, newMerchant);

  const updatedTransactions = transactions.reduce<Transaction[]>((acc, tx) => {
    if (getMerchantComparisonKey(tx.merchant || '') !== getMerchantComparisonKey(preview.oldMerchant)) {
      return acc;
    }

    acc.push({
      ...tx,
      merchant: preview.newMerchant,
    });
    return acc;
  }, []);

  return {
    preview,
    updatedTransactions,
  };
};
