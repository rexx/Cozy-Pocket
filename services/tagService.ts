import { Transaction } from '../types';

export interface TagUsageSummary {
  tag: string;
  count: number;
}

export type TagReplacementOperation = 'remove' | 'rename' | 'split';

export interface TagReplacementPreview {
  oldTag: string;
  replacementTags: string[];
  affectedCount: number;
  willBecomeUntaggedCount: number;
  existingReplacementTags: string[];
  operation: TagReplacementOperation;
}

export const normalizeTag = (tag: string) => tag.trim().replace(/^#+/, '');

export const splitTags = (tags?: string) => (
  tags
    ? tags.split(/\s+/).map(normalizeTag).filter(Boolean)
    : []
);

// Canonical serializer for Transaction.tags: normalize, drop duplicates, and
// sort so the stored order is stable regardless of how the tags were entered
// or which token a replacement expanded from. Code point order, not
// localeCompare: it is engine-independent, so two devices writing the same tag
// set produce byte-identical strings and the sync content comparison cannot
// see a difference where there is none.
export const joinTags = (tags: string[]) => {
  const normalized = Array.from(new Set(tags.map(normalizeTag).filter(Boolean)));
  return normalized.sort().join(' ');
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
      // Same code point comparison joinTags uses, so equal-count tags appear
      // in the order they would be stored in.
      return a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0;
    });
};

export const getTransactionsByTag = (
  transactions: Transaction[],
  tag: string
) => {
  const normalizedTag = normalizeTag(tag);
  if (!normalizedTag) return [];

  return transactions
    .filter((tx) => splitTags(tx.tags).includes(normalizedTag))
    .sort((a, b) => b.timestamp - a.timestamp);
};

const applyReplacement = (tags: string[], oldTag: string, replacementTags: string[]) => (
  tags.flatMap((tag) => (tag === oldTag ? replacementTags : [tag]))
);

export const buildTagReplacementPreview = (
  transactions: Transaction[],
  oldTag: string,
  replacementTags: string[]
): TagReplacementPreview => {
  const normalizedOldTag = normalizeTag(oldTag);

  if (!normalizedOldTag) {
    throw new Error('請先選擇要處理的 tag');
  }

  // An empty array is the explicit remove intent; a non-empty input that
  // normalizes away is a typo the caller must fix, never a silent remove.
  const normalizedReplacementTags = splitTags(replacementTags.join(' '));
  const uniqueReplacementTags = Array.from(new Set(normalizedReplacementTags));
  if (replacementTags.length > 0 && uniqueReplacementTags.length === 0) {
    throw new Error('請輸入新的 tag 名稱');
  }

  if (uniqueReplacementTags.length === 1 && uniqueReplacementTags[0] === normalizedOldTag) {
    throw new Error('新 tag 名稱不可與原名稱相同');
  }

  const existingTags = new Set(
    getTagUsageSummaries(transactions).map((item) => item.tag)
  );

  if (!existingTags.has(normalizedOldTag)) {
    throw new Error('找不到要處理的 tag');
  }

  const affectedTransactions = transactions.filter((tx) => (
    splitTags(tx.tags).includes(normalizedOldTag)
  ));

  const willBecomeUntaggedCount = affectedTransactions.filter((tx) => (
    applyReplacement(splitTags(tx.tags), normalizedOldTag, uniqueReplacementTags).length === 0
  )).length;

  const operation: TagReplacementOperation = uniqueReplacementTags.length === 0
    ? 'remove'
    : uniqueReplacementTags.length === 1
      ? 'rename'
      : 'split';

  return {
    oldTag: normalizedOldTag,
    replacementTags: uniqueReplacementTags,
    affectedCount: affectedTransactions.length,
    willBecomeUntaggedCount,
    // The old tag itself is not a merge target: it disappears from every
    // affected transaction before the replacement lands.
    existingReplacementTags: uniqueReplacementTags.filter((tag) => (
      tag !== normalizedOldTag && existingTags.has(tag)
    )),
    operation,
  };
};

export const replaceTagInTransactions = (
  transactions: Transaction[],
  oldTag: string,
  replacementTags: string[]
) => {
  const preview = buildTagReplacementPreview(transactions, oldTag, replacementTags);

  const updatedTransactions = transactions.flatMap<Transaction>((tx) => {
    const tags = splitTags(tx.tags);
    if (!tags.includes(preview.oldTag)) return [];

    const replacedTags = applyReplacement(tags, preview.oldTag, preview.replacementTags);
    return [{ ...tx, tags: joinTags(replacedTags) }];
  });

  return {
    preview,
    updatedTransactions,
  };
};
