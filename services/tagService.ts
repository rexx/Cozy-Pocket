import { Transaction } from '../types';

export interface TagUsageSummary {
  tag: string;
  count: number;
}

export interface TagRenamePreview {
  oldTag: string;
  newTag: string;
  affectedCount: number;
  conflictsWithExistingTag: boolean;
}

export const normalizeTag = (tag: string) => tag.trim().replace(/^#+/, '');

export const splitTags = (tags?: string) => (
  tags
    ? tags.split(/\s+/).map(normalizeTag).filter(Boolean)
    : []
);

export const joinTags = (tags: string[]) => {
  const normalized = Array.from(new Set(tags.map(normalizeTag).filter(Boolean)));
  return normalized.length > 0 ? normalized.join(' ') : '';
};

export const extractTransactionTags = (tx: Transaction) => splitTags(tx.tags);

export const getTagUsageSummaries = (transactions: Transaction[]): TagUsageSummary[] => {
  const tagCountMap = new Map<string, number>();

  transactions.forEach((tx) => {
    splitTags(tx.tags).forEach((tag) => {
      tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1);
    });
  });

  return Array.from(tagCountMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag, 'zh-Hant');
    });
};

export const buildTagRenamePreview = (
  transactions: Transaction[],
  oldTag: string,
  newTag: string
): TagRenamePreview => {
  const normalizedOldTag = normalizeTag(oldTag);
  const normalizedNewTag = normalizeTag(newTag);

  if (!normalizedOldTag) {
    throw new Error('請先選擇要更名的 tag');
  }

  if (!normalizedNewTag) {
    throw new Error('請輸入新的 tag 名稱');
  }

  if (normalizedOldTag === normalizedNewTag) {
    throw new Error('新 tag 名稱不可與原名稱相同');
  }

  const existingTags = new Set(
    getTagUsageSummaries(transactions).map((item) => item.tag)
  );

  if (!existingTags.has(normalizedOldTag)) {
    throw new Error('找不到要更名的 tag');
  }

  const affectedCount = transactions.filter((tx) => (
    splitTags(tx.tags).includes(normalizedOldTag)
  )).length;

  return {
    oldTag: normalizedOldTag,
    newTag: normalizedNewTag,
    affectedCount,
    conflictsWithExistingTag: existingTags.has(normalizedNewTag),
  };
};

export const renameTagInTransactions = (
  transactions: Transaction[],
  oldTag: string,
  newTag: string
) => {
  const preview = buildTagRenamePreview(transactions, oldTag, newTag);

  const updatedTransactions = transactions.reduce<Transaction[]>((acc, tx) => {
    const tags = splitTags(tx.tags);
    if (!tags.includes(preview.oldTag)) {
      return acc;
    }

    const renamedTags = tags.map((tag) => (
      tag === preview.oldTag ? preview.newTag : tag
    ));

    acc.push({
      ...tx,
      tags: joinTags(renamedTags),
    });
    return acc;
  }, []);

  return {
    preview,
    updatedTransactions,
  };
};
