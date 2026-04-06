import { Transaction } from '../types';

export interface MerchantUsageSummary {
  merchant: string;
  count: number;
}

export interface MerchantRenamePreview {
  oldMerchant: string;
  newMerchant: string;
  affectedCount: number;
  conflictsWithExistingMerchant: boolean;
}

export const normalizeMerchantName = (merchant: string) => merchant.trim();

export const getMerchantUsageSummaries = (transactions: Transaction[]): MerchantUsageSummary[] => {
  const merchantCountMap = new Map<string, number>();

  transactions.forEach((tx) => {
    const merchant = normalizeMerchantName(tx.merchant || '');
    if (!merchant) return;
    merchantCountMap.set(merchant, (merchantCountMap.get(merchant) || 0) + 1);
  });

  return Array.from(merchantCountMap.entries())
    .map(([merchant, count]) => ({ merchant, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.merchant.localeCompare(b.merchant, 'zh-Hant');
    });
};

export const getTransactionsByMerchant = (
  transactions: Transaction[],
  merchant: string
) => {
  const normalizedMerchant = normalizeMerchantName(merchant);
  if (!normalizedMerchant) return [];

  return transactions
    .filter((tx) => normalizeMerchantName(tx.merchant || '') === normalizedMerchant)
    .sort((a, b) => b.timestamp - a.timestamp);
};

export const buildMerchantRenamePreview = (
  transactions: Transaction[],
  oldMerchant: string,
  newMerchant: string
): MerchantRenamePreview => {
  const normalizedOldMerchant = normalizeMerchantName(oldMerchant);
  const normalizedNewMerchant = normalizeMerchantName(newMerchant);

  if (!normalizedOldMerchant) {
    throw new Error('請先選擇要更名的商家');
  }

  if (!normalizedNewMerchant) {
    throw new Error('請輸入新的商家名稱');
  }

  if (normalizedOldMerchant === normalizedNewMerchant) {
    throw new Error('新商家名稱不可與原名稱相同');
  }

  const existingMerchants = new Set(
    getMerchantUsageSummaries(transactions).map((item) => item.merchant)
  );

  if (!existingMerchants.has(normalizedOldMerchant)) {
    throw new Error('找不到要更名的商家');
  }

  const affectedCount = transactions.filter((tx) => (
    normalizeMerchantName(tx.merchant || '') === normalizedOldMerchant
  )).length;

  return {
    oldMerchant: normalizedOldMerchant,
    newMerchant: normalizedNewMerchant,
    affectedCount,
    conflictsWithExistingMerchant: existingMerchants.has(normalizedNewMerchant),
  };
};

export const renameMerchantInTransactions = (
  transactions: Transaction[],
  oldMerchant: string,
  newMerchant: string
) => {
  const preview = buildMerchantRenamePreview(transactions, oldMerchant, newMerchant);

  const updatedTransactions = transactions.reduce<Transaction[]>((acc, tx) => {
    if (normalizeMerchantName(tx.merchant || '') !== preview.oldMerchant) {
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
