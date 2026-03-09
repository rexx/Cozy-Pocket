import { db } from '../db';
import { Transaction } from '../types';
import { formatReadableDateTime, toEpochMillis, toEpochSeconds } from '../time';

type ResultStatus = 'success' | 'skipped' | 'error';

export interface SyncResultItem {
  id: string;
  status: ResultStatus;
  message?: string;
}
export interface SyncProgress {
  processed: number;
  total: number;
  failed: number;
}
type SyncProgressCallback = (progress: SyncProgress) => void;

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

const setSyncStatusForItems = async (
  items: Transaction[],
  syncStatus: Transaction['syncStatus'],
  lastSyncError?: string
) => {
  for (const item of items) {
    const existing = await db.transactions.get(item.id);
    if (!existing) continue;
    await db.transactions.put({
      ...existing,
      syncStatus,
      lastSyncError,
      updatedAt: existing.updatedAt || Date.now(),
    });
  }
};

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
  timestamp: toEpochSeconds(tx.timestamp),
  readableDateTime: tx.readableDateTime || formatReadableDateTime(tx.timestamp),
  paymentMethod: tx.paymentMethod,
  tags: tx.tags || '',
  updatedAt: Number(tx.updatedAt || toEpochMillis(tx.timestamp) || Date.now()),
  version: Number(tx.version || 1),
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
    const payload = JSON.stringify({
      token: config.token,
      action: 'create',
      items: items.map(toPayloadItem),
    });

    const res = await fetch(config.apiUrl, {
      method: 'POST',
      // Use a CORS "simple request" body to avoid OPTIONS preflight for GAS web app.
      body: new URLSearchParams({ payload }),
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

export const syncCreateItems = async (
  items: Transaction[],
  onProgress?: SyncProgressCallback
): Promise<SyncResultItem[]> => {
  const config = await getSyncConfig();
  const total = items.length;

  onProgress?.({
    processed: 0,
    total,
    failed: 0,
  });

  if (!config) {
    const failedResults: SyncResultItem[] = items.map((item) => ({
      id: item.id,
      status: 'error',
      message: 'Sync config missing',
    }));
    onProgress?.({
      processed: total,
      total,
      failed: failedResults.length,
    });
    return failedResults;
  }

  await setSyncStatusForItems(items, 'syncing', undefined);
  onProgress?.({
    processed: 0,
    total,
    failed: 0,
  });

  const results = await syncCreateItemsWithConfig(config, items);
  await applyResultsToLocal(results);
  onProgress?.({
    processed: total,
    total,
    failed: results.filter((result) => result.status === 'error').length,
  });
  return results;
};

export const syncPendingTransactions = async (
  onProgress?: SyncProgressCallback
): Promise<SyncResultItem[]> => {
  const config = await getSyncConfig();
  if (!config) return [];

  const pending = (await db.transactions.toArray()).filter((tx) => tx.syncStatus !== 'synced');
  if (pending.length === 0) return [];

  onProgress?.({
    processed: 0,
    total: pending.length,
    failed: 0,
  });

  const allResults: SyncResultItem[] = [];
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    await setSyncStatusForItems(batch, 'syncing', undefined);
    onProgress?.({
      processed,
      total: pending.length,
      failed,
    });
    const batchResults = await syncCreateItemsWithConfig(config, batch);
    await applyResultsToLocal(batchResults);
    allResults.push(...batchResults);
    processed += batch.length;
    failed += batchResults.filter((result) => result.status === 'error').length;
    onProgress?.({
      processed,
      total: pending.length,
      failed,
    });
  }

  return allResults;
};
