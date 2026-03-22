import { db } from '../db';
import { Transaction } from '../types';
import { formatReadableDateTime, toEpochMillis, toEpochSeconds } from '../time';
import { isOffline } from './networkService';

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

const normalizeErrorMessage = (value: unknown, fallback: string): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value instanceof Error) {
    return value.message || fallback;
  }
  if (value && typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json === '{}' ? fallback : json;
    } catch {
      return fallback;
    }
  }
  if (value == null) return fallback;
  return String(value);
};

const buildHttpErrorMessage = (
  res: Response,
  payloadMessage?: unknown,
  rawText?: string
): string => {
  const parts = [`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`];
  const detail = normalizeErrorMessage(
    payloadMessage ?? rawText,
    ''
  );
  if (detail) {
    parts.push(detail);
  }
  return parts.join(' | ');
};

const buildFetchDiagnosticMessage = (apiUrl: string, error: unknown): string => {
  const message = normalizeErrorMessage(error, 'Network error');
  const details: string[] = [message];

  try {
    const parsedUrl = new URL(apiUrl);
    details.push(`url=${parsedUrl.origin}${parsedUrl.pathname}`);
  } catch {
    details.push(`url=${apiUrl || '(empty)'}`);
    details.push('同步網址格式可能不正確');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    details.push(`origin=${window.location.origin}`);
  }

  if (typeof navigator !== 'undefined') {
    details.push(`online=${navigator.onLine ? 'true' : 'false'}`);
  }

  if (/Failed to fetch/i.test(message)) {
    details.push('可能原因: GAS 網址錯誤、Web App 尚未部署/未開放權限、CORS 被擋、網路無法連線');
  }

  return details.join(' | ');
};

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
  if (isOffline()) {
    return items.map((item) => ({
      id: item.id,
      status: 'error',
      message: 'Device offline',
    }));
  }

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

    const responseText = await res.text();
    let json: SyncApiResponse | null = null;
    try {
      json = responseText ? JSON.parse(responseText) as SyncApiResponse : null;
    } catch {
      return items.map((item) => ({
        id: item.id,
        status: 'error',
        message: buildHttpErrorMessage(res, undefined, responseText || 'Invalid JSON response'),
      }));
    }

    if (!res.ok) {
      const message = buildHttpErrorMessage(res, json?.message, responseText);
      return items.map((item) => ({
        id: item.id,
        status: 'error',
        message,
      }));
    }

    if (!json || json.status !== 'success') {
      const message = json?.status === 'unauthorized'
        ? normalizeErrorMessage(json?.message, 'Unauthorized')
        : normalizeErrorMessage(json?.message, 'Sync failed');
      return items.map((item) => ({
        id: item.id,
        status: 'error',
        message,
      }));
    }

    return normalizeResults(items, json.results);
  } catch (error: any) {
    const message = buildFetchDiagnosticMessage(config.apiUrl, error);
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
  if (isOffline()) {
    const offlineResults: SyncResultItem[] = items.map((item) => ({
      id: item.id,
      status: 'error',
      message: 'Device offline',
    }));
    onProgress?.({
      processed: total,
      total,
      failed: offlineResults.length,
    });
    return offlineResults;
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
  if (isOffline()) return [];

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
