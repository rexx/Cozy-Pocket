import { db } from '../db';
import { Transaction } from '../types';

type ResultStatus = 'success' | 'skipped' | 'error';

interface SyncResultItem {
  id: string;
  status: ResultStatus;
  message?: string;
}

interface SyncApiResponse {
  status: 'success' | 'error' | 'unauthorized';
  message?: string;
  results?: SyncResultItem[];
}

interface SyncConfig {
  apiUrl: string;
  token: string;
}

const BATCH_SIZE = 50;

const getSyncConfig = async (): Promise<SyncConfig | null> => {
  const [apiUrlSetting, tokenSetting] = await Promise.all([
    db.settings.get('syncApiUrl'),
    db.settings.get('syncToken'),
  ]);
  const apiUrl = (apiUrlSetting?.value || '').trim();
  const token = (tokenSetting?.value || '').trim();

  if (!apiUrl || !token) {
    return null;
  }

  return { apiUrl, token };
};

const toPayloadItem = (tx: Transaction) => ({
  id: tx.id,
  type: tx.type,
  amount: tx.amount,
  currency: tx.currency,
  categoryId: tx.categoryId,
  subCategoryId: tx.subCategoryId || '',
  name: tx.name || '',
  merchant: tx.merchant || '',
  note: tx.note || '',
  timestamp: tx.timestamp,
  paymentMethod: tx.paymentMethod,
  tags: tx.tags || '',
  projectName: tx.projectName || '',
});

const normalizeResults = (
  items: Transaction[],
  resultsFromApi: SyncResultItem[] | undefined
): SyncResultItem[] => {
  if (!Array.isArray(resultsFromApi)) {
    return items.map((item) => ({
      id: item.id,
      status: 'error',
      message: 'Missing results array in sync response',
    }));
  }

  const resultMap = new Map(resultsFromApi.map((r) => [r.id, r]));
  return items.map((item) => {
    const found = resultMap.get(item.id);
    if (!found) {
      return {
        id: item.id,
        status: 'error',
        message: 'Missing item result in sync response',
      };
    }
    return found;
  });
};

const applyResultsToLocal = async (results: SyncResultItem[]) => {
  for (const result of results) {
    const existing = await db.transactions.get(result.id);
    if (!existing) continue;

    const isSynced = result.status === 'success' || result.status === 'skipped';
    await db.transactions.put({
      ...existing,
      syncStatus: isSynced ? 'synced' : 'error',
      lastSyncError: isSynced ? undefined : (result.message || 'Sync failed'),
      updatedAt: existing.updatedAt || Date.now(),
    });
  }
};

const syncCreateItemsWithConfig = async (
  config: SyncConfig,
  items: Transaction[]
): Promise<SyncResultItem[]> => {
  if (items.length === 0) return [];

  try {
    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: config.token,
        action: 'create',
        items: items.map(toPayloadItem),
      }),
    });

    let json: SyncApiResponse | null = null;
    try {
      json = await res.json();
    } catch {
      return items.map((item) => ({
        id: item.id,
        status: 'error',
        message: 'Invalid JSON response',
      }));
    }

    if (!json || json.status !== 'success') {
      const message = json?.message || (json?.status === 'unauthorized' ? 'Unauthorized' : 'Sync failed');
      return items.map((item) => ({
        id: item.id,
        status: 'error',
        message,
      }));
    }

    return normalizeResults(items, json.results);
  } catch (error: any) {
    const message = error?.message || 'Network error';
    return items.map((item) => ({
      id: item.id,
      status: 'error',
      message,
    }));
  }
};

export const syncCreateItems = async (items: Transaction[]): Promise<SyncResultItem[]> => {
  const config = await getSyncConfig();
  if (!config) {
    return items.map((item) => ({
      id: item.id,
      status: 'error',
      message: 'Sync config missing',
    }));
  }

  const results = await syncCreateItemsWithConfig(config, items);
  await applyResultsToLocal(results);
  return results;
};

export const syncPendingTransactions = async (): Promise<SyncResultItem[]> => {
  const config = await getSyncConfig();
  if (!config) return [];

  const pending = (await db.transactions.toArray()).filter((tx) => tx.syncStatus !== 'synced');
  if (pending.length === 0) return [];

  const allResults: SyncResultItem[] = [];

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const batchResults = await syncCreateItemsWithConfig(config, batch);
    await applyResultsToLocal(batchResults);
    allResults.push(...batchResults);
  }

  return allResults;
};

