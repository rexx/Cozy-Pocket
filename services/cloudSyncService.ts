import { db } from '../db';
import {
  PullReport,
  PullReportEntry,
  PullReportEntryReason,
  PullReportSummary,
  SyncPayloadItem,
  Transaction,
} from '../types';
import { formatReadableDateTime, toEpochMillis, toEpochSeconds } from '../time';
import { isOffline } from './networkService';

type ResultStatus = 'success' | 'skipped' | 'error';
type PullApiItem = Record<string, unknown>;

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

export interface PullTransactionsResult {
  report: PullReport;
}

type SyncProgressCallback = (progress: SyncProgress) => void;

interface SyncApiResponse {
  status: 'success' | 'error' | 'unauthorized';
  message?: string;
  results?: SyncResultItem[];
}

interface PullApiResponse {
  status: 'success' | 'error' | 'unauthorized';
  message?: string;
  year?: string;
  items?: PullApiItem[];
}

interface SyncConfig {
  apiUrl: string;
  token: string;
}

const BATCH_SIZE = 50;
const MOCK_SYNC_API_URL = 'mock://cloud-sync';
const MOCK_SYNC_STORAGE_KEY = 'cozy-pocket.mock-cloud-sync.v1';
const MOCK_DEMO_ID_PREFIX = 'mock-demo';

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

const createEmptyPullSummary = (): PullReportSummary => ({
  fetched: 0,
  insertedFromCloud: 0,
  updatedFromCloud: 0,
  pushedLocalUpdateToCloud: 0,
  insertedLocalOnlyToCloud: 0,
  unchanged: 0,
  failed: 0,
});

const cloneTransactionSnapshot = (tx: Transaction): Transaction => ({
  id: tx.id,
  type: tx.type,
  amount: tx.amount,
  currency: tx.currency,
  categoryId: tx.categoryId,
  subCategoryId: tx.subCategoryId,
  name: tx.name,
  note: tx.note,
  timestamp: toEpochSeconds(tx.timestamp),
  readableDateTime: tx.readableDateTime || formatReadableDateTime(tx.timestamp),
  paymentMethod: tx.paymentMethod,
  merchant: tx.merchant,
  tags: tx.tags,
  updatedAt: tx.updatedAt,
  version: tx.version,
  syncStatus: tx.syncStatus,
  lastSyncError: tx.lastSyncError,
});

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

const toPayloadItem = (tx: Transaction): SyncPayloadItem => ({
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

// readableDateTime is a display-only field derived from timestamp. It is
// timezone-dependent and the Sheets backend coerces it into a different string
// on round-trip, so comparing it would flag unchanged records as conflicting.
// Conflict detection stays driven by timestamp, which already encodes the datetime.
const toComparablePayload = (tx: Transaction): Omit<SyncPayloadItem, 'readableDateTime'> => {
  const { readableDateTime, ...rest } = toPayloadItem(tx);
  return rest;
};

const hasSamePersistedPayload = (local: Transaction, cloud: Transaction): boolean => {
  return JSON.stringify(toComparablePayload(local)) === JSON.stringify(toComparablePayload(cloud));
};

interface MockCloudState {
  items: Record<string, SyncPayloadItem>;
}

const isMockSyncConfig = (config: SyncConfig) => config.apiUrl === MOCK_SYNC_API_URL;

const getItemYear = (item: Pick<SyncPayloadItem, 'timestamp'>): string => {
  return String(new Date(toEpochMillis(Number(item.timestamp))).getFullYear());
};

const isMockDemoTransactionId = (id: string, year?: string) => {
  const prefix = year ? `${MOCK_DEMO_ID_PREFIX}-${year}-` : `${MOCK_DEMO_ID_PREFIX}-`;
  return id.startsWith(prefix);
};

const shouldSimulateMockLocalWriteFailure = (config: SyncConfig, transactionId: string): boolean => {
  return isMockSyncConfig(config) && transactionId.includes('local-write-fail');
};

const buildMockTransaction = (
  year: string,
  idSuffix: string,
  overrides: Partial<Transaction>
): Transaction => {
  const baseTimestamp = toEpochSeconds(new Date(Number(year), 0, 12, 12, 30).getTime());
  const timestamp = toEpochSeconds(Number(overrides.timestamp || baseTimestamp));

  return {
    id: `${MOCK_DEMO_ID_PREFIX}-${year}-${idSuffix}`,
    type: '支出',
    amount: -120,
    currency: 'TWD',
    categoryId: 'food',
    subCategoryId: 'lunch',
    name: `Mock ${idSuffix}`,
    merchant: 'Mock Shop',
    note: 'Mock year sync fixture',
    timestamp,
    readableDateTime: formatReadableDateTime(timestamp),
    paymentMethod: '現金',
    tags: 'mock sync',
    updatedAt: toEpochMillis(timestamp),
    version: 1,
    syncStatus: 'synced',
    ...overrides,
  };
};

const buildMockSeedItems = (): SyncPayloadItem[] => {
  const now = Date.now();
  const currentYear = new Date(now).getFullYear();
  const baseTimestamp = toEpochSeconds(new Date(currentYear, 0, 8, 10, 30).getTime());
  const seedTransactions: Transaction[] = [
    {
      id: `mock-cloud-${currentYear}-coffee`,
      type: '支出',
      amount: -95,
      currency: 'TWD',
      categoryId: 'food',
      subCategoryId: 'drink',
      name: 'Mock cloud coffee',
      merchant: 'Cloud Cafe',
      note: 'Seeded from mock API',
      timestamp: baseTimestamp,
      readableDateTime: formatReadableDateTime(baseTimestamp),
      paymentMethod: '電子支付',
      tags: 'mock cloud',
      updatedAt: now - 2_000,
      version: 1,
      syncStatus: 'synced',
    },
    {
      id: `mock-cloud-${currentYear}-train`,
      type: '支出',
      amount: -42,
      currency: 'TWD',
      categoryId: 'transport',
      subCategoryId: 'mrt',
      name: 'Mock cloud transit',
      merchant: 'Metro',
      timestamp: baseTimestamp + 3600,
      readableDateTime: formatReadableDateTime(baseTimestamp + 3600),
      paymentMethod: '電子支付',
      tags: 'mock transit',
      updatedAt: now - 1_000,
      version: 1,
      syncStatus: 'synced',
    },
  ];

  return seedTransactions.map(toPayloadItem);
};

const readMockCloudState = (): MockCloudState => {
  if (typeof localStorage === 'undefined') {
    return { items: {} };
  }

  const raw = localStorage.getItem(MOCK_SYNC_STORAGE_KEY);
  if (!raw) {
    const seeded = buildMockSeedItems();
    const state = {
      items: Object.fromEntries(seeded.map((item) => [item.id, item])),
    };
    localStorage.setItem(MOCK_SYNC_STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  try {
    const parsed = JSON.parse(raw) as MockCloudState;
    return parsed && parsed.items && typeof parsed.items === 'object'
      ? parsed
      : { items: {} };
  } catch {
    return { items: {} };
  }
};

const writeMockCloudState = (state: MockCloudState) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(MOCK_SYNC_STORAGE_KEY, JSON.stringify(state));
};

const resolveMockSyncDecision = (
  existing: SyncPayloadItem,
  incoming: SyncPayloadItem
): 'update' | 'conflict' | 'skip' => {
  if (incoming.version > existing.version) return 'update';
  if (incoming.version < existing.version) return 'conflict';
  if (incoming.updatedAt > existing.updatedAt) return 'update';
  if (incoming.updatedAt < existing.updatedAt) return 'conflict';
  return 'skip';
};

const syncCreateItemsToMock = (items: Transaction[]): SyncResultItem[] => {
  const state = readMockCloudState();
  const results = items.map((item) => {
    const incoming = toPayloadItem(item);
    if (incoming.id.includes('push-fail')) {
      return {
        id: incoming.id,
        status: 'error' as const,
        message: 'Mock push back failed for UI preview',
      };
    }
    const existing = state.items[incoming.id];

    if (!existing) {
      state.items[incoming.id] = incoming;
      return { id: incoming.id, status: 'success' as const, message: 'Mock inserted' };
    }

    const decision = resolveMockSyncDecision(existing, incoming);
    if (decision === 'update') {
      state.items[incoming.id] = incoming;
      return { id: incoming.id, status: 'success' as const, message: 'Mock updated' };
    }
    if (decision === 'skip') {
      return { id: incoming.id, status: 'skipped' as const, message: 'Mock already up-to-date' };
    }
    return { id: incoming.id, status: 'error' as const, message: 'Mock conflict: stale version' };
  });
  writeMockCloudState(state);
  return results;
};

const prepareMockPullFixture = async (year: string): Promise<PullApiItem[]> => {
  const state = readMockCloudState();
  const timestamp = toEpochSeconds(new Date(Number(year), 0, 12, 12, 30).getTime());
  const updatedAtBase = toEpochMillis(timestamp);

  Object.keys(state.items).forEach((id) => {
    if (isMockDemoTransactionId(id, year)) {
      delete state.items[id];
    }
  });

  const cloudOnlyItems = [
    buildMockTransaction(year, 'cloud-only-lunch', {
      name: 'Mock cloud only lunch',
      merchant: 'Cloud Bistro',
      amount: -180,
      timestamp,
      updatedAt: updatedAtBase + 1_000,
      version: 1,
    }),
    buildMockTransaction(year, 'cloud-only-drink', {
      name: 'Mock cloud only drink',
      merchant: 'Cloud Tea',
      amount: -75,
      timestamp: timestamp + 600,
      updatedAt: updatedAtBase + 2_000,
      version: 1,
    }),
    buildMockTransaction(year, 'cloud-only-local-write-fail', {
      name: 'Mock cloud only local write fail',
      merchant: 'Cloud Write Fail',
      amount: -45,
      timestamp: timestamp + 900,
      updatedAt: updatedAtBase + 3_000,
      version: 1,
    }),
  ];
  const cloudNewerPairs = [
    {
      cloud: buildMockTransaction(year, 'cloud-newer-market', {
        name: 'Mock cloud newer market',
        merchant: 'Cloud Market',
        amount: -260,
        timestamp: timestamp + 1_200,
        updatedAt: updatedAtBase + 20_000,
        version: 3,
      }),
      local: buildMockTransaction(year, 'cloud-newer-market', {
        name: 'Mock local stale market',
        merchant: 'Local Market',
        amount: -200,
        timestamp: timestamp + 1_200,
        updatedAt: updatedAtBase + 10_000,
        version: 1,
        syncStatus: 'synced',
      }),
    },
    {
      cloud: buildMockTransaction(year, 'cloud-newer-taxi', {
        name: 'Mock cloud newer taxi',
        merchant: 'Cloud Taxi',
        amount: -320,
        categoryId: 'transport',
        subCategoryId: 'taxi',
        timestamp: timestamp + 1_800,
        updatedAt: updatedAtBase + 22_000,
        version: 4,
      }),
      local: buildMockTransaction(year, 'cloud-newer-taxi', {
        name: 'Mock local stale taxi',
        merchant: 'Local Taxi',
        amount: -280,
        categoryId: 'transport',
        subCategoryId: 'taxi',
        timestamp: timestamp + 1_800,
        updatedAt: updatedAtBase + 12_000,
        version: 2,
        syncStatus: 'synced',
      }),
    },
    {
      cloud: buildMockTransaction(year, 'cloud-updatedAt-newer-pharmacy', {
        name: 'Mock cloud updatedAt newer pharmacy',
        merchant: 'Cloud Pharmacy',
        amount: -390,
        timestamp: timestamp + 2_100,
        updatedAt: updatedAtBase + 24_000,
        version: 2,
      }),
      local: buildMockTransaction(year, 'cloud-updatedAt-newer-pharmacy', {
        name: 'Mock local stale pharmacy',
        merchant: 'Local Pharmacy',
        amount: -350,
        timestamp: timestamp + 2_100,
        updatedAt: updatedAtBase + 14_000,
        version: 2,
        syncStatus: 'synced',
      }),
    },
    {
      cloud: buildMockTransaction(year, 'cloud-newer-local-write-fail', {
        name: 'Mock cloud newer local write fail',
        merchant: 'Cloud Update Fail',
        amount: -610,
        timestamp: timestamp + 2_250,
        updatedAt: updatedAtBase + 25_000,
        version: 3,
      }),
      local: buildMockTransaction(year, 'cloud-newer-local-write-fail', {
        name: 'Mock local write fail target',
        merchant: 'Local Update Fail',
        amount: -560,
        timestamp: timestamp + 2_250,
        updatedAt: updatedAtBase + 15_000,
        version: 1,
        syncStatus: 'synced',
      }),
    },
  ];
  const localNewerPairs = [
    {
      cloud: buildMockTransaction(year, 'local-newer-shop', {
        name: 'Mock cloud older shop',
        merchant: 'Old Cloud Shop',
        amount: -88,
        timestamp: timestamp + 2_400,
        updatedAt: updatedAtBase + 30_000,
        version: 1,
      }),
      local: buildMockTransaction(year, 'local-newer-shop', {
        name: 'Mock local newer shop',
        merchant: 'Fresh Local Shop',
        amount: -168,
        timestamp: timestamp + 2_400,
        updatedAt: updatedAtBase + 40_000,
        version: 4,
        syncStatus: 'synced',
      }),
    },
    {
      cloud: buildMockTransaction(year, 'local-newer-dinner', {
        name: 'Mock cloud older dinner',
        merchant: 'Old Dinner',
        amount: -420,
        subCategoryId: 'dinner',
        timestamp: timestamp + 3_000,
        updatedAt: updatedAtBase + 31_000,
        version: 2,
      }),
      local: buildMockTransaction(year, 'local-newer-dinner', {
        name: 'Mock local newer dinner',
        merchant: 'Fresh Dinner',
        amount: -520,
        subCategoryId: 'dinner',
        timestamp: timestamp + 3_000,
        updatedAt: updatedAtBase + 41_000,
        version: 5,
        syncStatus: 'synced',
      }),
    },
    {
      cloud: buildMockTransaction(year, 'local-updatedAt-newer-cinema', {
        name: 'Mock cloud stale cinema',
        merchant: 'Old Cinema',
        amount: -260,
        categoryId: 'entertainment',
        subCategoryId: 'other_entertainment',
        timestamp: timestamp + 3_150,
        updatedAt: updatedAtBase + 31_500,
        version: 3,
      }),
      local: buildMockTransaction(year, 'local-updatedAt-newer-cinema', {
        name: 'Mock local updatedAt newer cinema',
        merchant: 'Fresh Cinema',
        amount: -360,
        categoryId: 'entertainment',
        subCategoryId: 'other_entertainment',
        timestamp: timestamp + 3_150,
        updatedAt: updatedAtBase + 41_500,
        version: 3,
        syncStatus: 'synced',
      }),
    },
    {
      cloud: buildMockTransaction(year, 'local-newer-push-fail', {
        name: 'Mock cloud older push fail',
        merchant: 'Old Cloud Fail',
        amount: -210,
        timestamp: timestamp + 3_300,
        updatedAt: updatedAtBase + 32_000,
        version: 1,
      }),
      local: buildMockTransaction(year, 'local-newer-push-fail', {
        name: 'Mock local newer push fail',
        merchant: 'Fresh Local Fail',
        amount: -310,
        timestamp: timestamp + 3_300,
        updatedAt: updatedAtBase + 42_000,
        version: 4,
        syncStatus: 'synced',
      }),
    },
  ];
  const unchangedItems = [
    buildMockTransaction(year, 'unchanged-lunch', {
      name: 'Mock unchanged lunch',
      merchant: 'Same Store',
      amount: -99,
      timestamp: timestamp + 3_600,
      updatedAt: updatedAtBase + 50_000,
      version: 2,
    }),
    buildMockTransaction(year, 'unchanged-snack', {
      name: 'Mock unchanged snack',
      merchant: 'Same Snack',
      amount: -65,
      subCategoryId: 'snack',
      timestamp: timestamp + 4_200,
      updatedAt: updatedAtBase + 51_000,
      version: 3,
    }),
  ];
  const sameRevisionMismatchPairs = [
    {
      cloud: buildMockTransaction(year, 'same-revision-cloud-source', {
        name: 'Mock cloud source amount',
        merchant: 'Cloud Source Store',
        amount: -480,
        timestamp: timestamp + 4_500,
        updatedAt: updatedAtBase + 55_000,
        version: 2,
      }),
      local: buildMockTransaction(year, 'same-revision-cloud-source', {
        name: 'Mock local cache drift amount',
        merchant: 'Local Cache Store',
        amount: -999,
        timestamp: timestamp + 4_500,
        updatedAt: updatedAtBase + 55_000,
        version: 2,
        syncStatus: 'synced',
      }),
    },
  ];
  const localOnlyItems = [
    buildMockTransaction(year, 'local-only-breakfast', {
      name: 'Mock local only breakfast',
      merchant: 'Local Only Cafe',
      amount: -150,
      subCategoryId: 'breakfast',
      timestamp: timestamp + 4_800,
      updatedAt: updatedAtBase + 60_000,
      version: 2,
      syncStatus: 'synced',
    }),
    buildMockTransaction(year, 'local-only-parking', {
      name: 'Mock local only parking',
      merchant: 'Local Parking',
      amount: -80,
      categoryId: 'transport',
      subCategoryId: 'parking_fee',
      timestamp: timestamp + 5_400,
      updatedAt: updatedAtBase + 61_000,
      version: 1,
      syncStatus: 'synced',
    }),
    buildMockTransaction(year, 'local-only-push-fail', {
      name: 'Mock local only push fail',
      merchant: 'Local Fail Store',
      amount: -115,
      timestamp: timestamp + 6_000,
      updatedAt: updatedAtBase + 62_000,
      version: 1,
      syncStatus: 'synced',
    }),
  ];
  const invalidItems: PullApiItem[] = [
    {
      id: `${MOCK_DEMO_ID_PREFIX}-${year}-invalid-missing-category`,
      type: '支出',
      amount: -1,
      currency: 'TWD',
      categoryId: '',
      name: 'Mock invalid missing category',
      timestamp,
      paymentMethod: '現金',
      updatedAt: updatedAtBase + 70_000,
      version: 1,
    },
    {
      id: `${MOCK_DEMO_ID_PREFIX}-${year}-invalid-missing-payment`,
      type: '支出',
      amount: -2,
      currency: 'TWD',
      categoryId: 'food',
      name: 'Mock invalid missing payment',
      timestamp: timestamp + 600,
      paymentMethod: '',
      updatedAt: updatedAtBase + 71_000,
      version: 1,
    },
  ];

  [
    ...cloudOnlyItems,
    ...cloudNewerPairs.map((pair) => pair.cloud),
    ...localNewerPairs.map((pair) => pair.cloud),
    ...unchangedItems,
    ...sameRevisionMismatchPairs.map((pair) => pair.cloud),
  ].forEach((tx) => {
    state.items[tx.id] = toPayloadItem(tx);
  });
  writeMockCloudState(state);

  await db.transactions.bulkPut([
    ...cloudNewerPairs.map((pair) => pair.local),
    ...localNewerPairs.map((pair) => pair.local),
    ...unchangedItems,
    ...sameRevisionMismatchPairs.map((pair) => pair.local),
    ...localOnlyItems,
  ]);
  await Promise.all([
    ...cloudOnlyItems.map((tx) => db.transactions.delete(tx.id)),
    ...invalidItems.map((item) => db.transactions.delete(String(item.id))),
  ]);

  return [
    ...cloudOnlyItems.map(toPayloadItem),
    ...cloudNewerPairs.map((pair) => toPayloadItem(pair.cloud)),
    ...localNewerPairs.map((pair) => toPayloadItem(pair.cloud)),
    ...unchangedItems.map(toPayloadItem),
    ...sameRevisionMismatchPairs.map((pair) => toPayloadItem(pair.cloud)),
    ...invalidItems,
  ];
};

const fetchPullItemsFromMock = async (year: string): Promise<{ year: string; items: PullApiItem[] }> => {
  const fixtureItems = await prepareMockPullFixture(year);
  return {
    year,
    items: fixtureItems,
  };
};

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
  if (isMockSyncConfig(config)) {
    return syncCreateItemsToMock(items);
  }
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
  } catch (error: unknown) {
    const message = buildFetchDiagnosticMessage(config.apiUrl, error);
    return items.map((item) => ({
      id: item.id,
      status: 'error',
      message,
    }));
  }
};

const fetchPullItemsWithConfig = async (
  config: SyncConfig,
  year: string
): Promise<{ year: string; items?: PullApiItem[]; error?: string }> => {
  if (isMockSyncConfig(config)) {
    return await fetchPullItemsFromMock(year);
  }

  try {
    const payload = JSON.stringify({
      token: config.token,
      action: 'get',
      year,
    });

    const res = await fetch(config.apiUrl, {
      method: 'POST',
      body: new URLSearchParams({ payload }),
    });

    const responseText = await res.text();
    let json: PullApiResponse | null = null;

    try {
      json = responseText ? JSON.parse(responseText) as PullApiResponse : null;
    } catch {
      return {
        year,
        error: buildHttpErrorMessage(res, undefined, responseText || 'Invalid JSON response'),
      };
    }

    if (!res.ok) {
      return {
        year,
        error: buildHttpErrorMessage(res, json?.message, responseText),
      };
    }

    if (!json || json.status !== 'success') {
      return {
        year,
        error: json?.status === 'unauthorized'
          ? normalizeErrorMessage(json?.message, 'Unauthorized')
          : normalizeErrorMessage(json?.message, 'Year sync fetch failed'),
      };
    }

    if (!Array.isArray(json.items)) {
      return {
        year,
        error: 'Missing items array in sync response',
      };
    }

    return {
      year: String(json.year || year),
      items: json.items,
    };
  } catch (error: unknown) {
    return {
      year,
      error: buildFetchDiagnosticMessage(config.apiUrl, error),
    };
  }
};

const normalizePullItem = (item: PullApiItem): Transaction => {
  const id = typeof item.id === 'string' ? item.id.trim() : String(item.id || '').trim();
  if (!id) {
    throw new Error('Missing id');
  }

  const type = item.type === '收入' ? '收入' : item.type === '支出' ? '支出' : null;
  if (!type) {
    throw new Error('Invalid type');
  }

  const amount = Number(item.amount);
  const timestamp = toEpochSeconds(Number(item.timestamp));
  const paymentMethod = typeof item.paymentMethod === 'string' ? item.paymentMethod.trim() : '';
  const currency = typeof item.currency === 'string' && item.currency.trim() ? item.currency.trim() : 'TWD';
  const categoryId = typeof item.categoryId === 'string' ? item.categoryId.trim() : '';
  const name = typeof item.name === 'string' ? item.name : '';

  if (!Number.isFinite(amount)) {
    throw new Error('Invalid amount');
  }
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error('Invalid timestamp');
  }
  if (!paymentMethod) {
    throw new Error('Missing paymentMethod');
  }
  if (!categoryId) {
    throw new Error('Missing categoryId');
  }

  const updatedAtRaw = Number(item.updatedAt);
  const versionRaw = Number(item.version);

  return {
    id,
    type,
    amount,
    currency,
    categoryId,
    subCategoryId: typeof item.subCategoryId === 'string' && item.subCategoryId.trim() ? item.subCategoryId.trim() : undefined,
    name,
    merchant: typeof item.merchant === 'string' && item.merchant.trim() ? item.merchant : undefined,
    note: typeof item.note === 'string' && item.note.trim() ? item.note : undefined,
    timestamp,
    // Always re-derive from timestamp; the cloud value is coerced by Sheets into
    // a non-canonical date string and must not be persisted locally.
    readableDateTime: formatReadableDateTime(timestamp),
    paymentMethod,
    tags: typeof item.tags === 'string' && item.tags.trim() ? item.tags : undefined,
    updatedAt: Number.isFinite(updatedAtRaw) ? updatedAtRaw : toEpochMillis(timestamp),
    version: Number.isFinite(versionRaw) ? versionRaw : 1,
    syncStatus: 'synced',
    lastSyncError: undefined,
  };
};

const getTransactionYear = (tx: Transaction): string => {
  return String(new Date(toEpochMillis(tx.timestamp)).getFullYear());
};

const compareLocalAndCloud = (local: Transaction, cloud: Transaction): 'cloud' | 'local' | 'same' => {
  const localVersion = Number(local.version || 0);
  const cloudVersion = Number(cloud.version || 0);
  if (localVersion !== cloudVersion) {
    return localVersion > cloudVersion ? 'local' : 'cloud';
  }

  const localUpdatedAt = Number(local.updatedAt || 0);
  const cloudUpdatedAt = Number(cloud.updatedAt || 0);
  if (localUpdatedAt !== cloudUpdatedAt) {
    return localUpdatedAt > cloudUpdatedAt ? 'local' : 'cloud';
  }

  return hasSamePersistedPayload(local, cloud) ? 'same' : 'cloud';
};

const createPullReportRecord = (
  year: string,
  summary: PullReportSummary,
  entries: PullReportEntry[],
  runError?: string
): PullReport => {
  const failedEntries = entries.filter((entry) => entry.action === 'failed').length;
  const status = runError
    ? 'failed'
    : failedEntries > 0
      ? 'partial'
      : 'success';

  return {
    id: `pull-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    year,
    status,
    summary,
    runError,
    entries,
  };
};

const persistPullReport = async (report: PullReport): Promise<PullReport> => {
  await db.pullReports.put(report);
  return report;
};

const markFailedEntry = (
  entries: PullReportEntry[],
  summary: PullReportSummary,
  transactionId: string,
  reason: PullReportEntryReason,
  errorMessage: string,
  before?: Transaction,
  after?: Transaction
) => {
  entries.push({
    transactionId,
    action: 'failed',
    reason,
    before: before ? cloneTransactionSnapshot(before) : undefined,
    after: after ? cloneTransactionSnapshot(after) : undefined,
    errorMessage,
  });
  summary.failed += 1;
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

export const pullTransactionsFromCloud = async (year: string): Promise<PullTransactionsResult> => {
  const normalizedYear = year.trim();
  const summary = createEmptyPullSummary();
  const entries: PullReportEntry[] = [];

  if (!normalizedYear) {
    return {
      report: await persistPullReport(
        createPullReportRecord(year, summary, entries, 'Sync year is required')
      ),
    };
  }

  const config = await getSyncConfig();
  if (!config) {
    return {
      report: await persistPullReport(
        createPullReportRecord(normalizedYear, summary, entries, 'Sync config missing')
      ),
    };
  }

  if (isOffline()) {
    return {
      report: await persistPullReport(
        createPullReportRecord(normalizedYear, summary, entries, 'Device offline')
      ),
    };
  }

  const pullResponse = await fetchPullItemsWithConfig(config, normalizedYear);
  if (pullResponse.error) {
    return {
      report: await persistPullReport(
        createPullReportRecord(normalizedYear, summary, entries, pullResponse.error)
      ),
    };
  }

  const allLocalTransactions = (await db.transactions.toArray()).filter((tx) => getTransactionYear(tx) === normalizedYear);
  const localTransactions = isMockSyncConfig(config)
    ? allLocalTransactions.filter((tx) => isMockDemoTransactionId(tx.id, normalizedYear))
    : allLocalTransactions;
  const localById = new Map(localTransactions.map((tx) => [tx.id, tx]));
  const cloudById = new Map<string, Transaction>();
  const pushBackItems: Transaction[] = [];

  for (const rawItem of pullResponse.items || []) {
    summary.fetched += 1;

    try {
      const cloudTx = normalizePullItem(rawItem);
      cloudById.set(cloudTx.id, cloudTx);
    } catch (error: unknown) {
      const transactionId = typeof rawItem.id === 'string' ? rawItem.id : String(rawItem.id || '');
      markFailedEntry(
        entries,
        summary,
        transactionId || '(unknown)',
        'invalid_cloud_item',
        normalizeErrorMessage(error, 'Invalid cloud item')
      );
    }
  }

  for (const [transactionId, cloudTx] of cloudById.entries()) {
    const localTx = localById.get(transactionId);

    if (!localTx) {
      const nextTx: Transaction = {
        ...cloudTx,
        syncStatus: 'synced',
        lastSyncError: undefined,
      };
      try {
        if (shouldSimulateMockLocalWriteFailure(config, transactionId)) {
          throw new Error('Mock local write failure');
        }
        await db.transactions.put(nextTx);
        entries.push({
          transactionId,
          action: 'insertedFromCloud',
          reason: 'cloud_only',
          after: cloneTransactionSnapshot(nextTx),
        });
        summary.insertedFromCloud += 1;
      } catch (error: unknown) {
        markFailedEntry(
          entries,
          summary,
          transactionId,
          'local_write_failed',
          normalizeErrorMessage(error, 'Failed to write cloud transaction'),
          undefined,
          nextTx
        );
      }
      continue;
    }

    const comparison = compareLocalAndCloud(localTx, cloudTx);
    if (comparison === 'same') {
      entries.push({
        transactionId,
        action: 'unchanged',
        reason: 'identical',
      });
      summary.unchanged += 1;
      continue;
    }

    if (comparison === 'cloud') {
      const reason = Number(localTx.version || 0) !== Number(cloudTx.version || 0)
        ? 'cloud_newer_version'
        : Number(localTx.updatedAt || 0) !== Number(cloudTx.updatedAt || 0)
          ? 'cloud_newer_updatedAt'
          : 'content_mismatch';
      const nextTx: Transaction = {
        ...cloudTx,
        syncStatus: 'synced',
        lastSyncError: undefined,
      };
      try {
        if (shouldSimulateMockLocalWriteFailure(config, transactionId)) {
          throw new Error('Mock local write failure');
        }
        await db.transactions.put(nextTx);
        entries.push({
          transactionId,
          action: 'updatedFromCloud',
          reason,
          before: cloneTransactionSnapshot(localTx),
          after: cloneTransactionSnapshot(nextTx),
        });
        summary.updatedFromCloud += 1;
      } catch (error: unknown) {
        markFailedEntry(
          entries,
          summary,
          transactionId,
          'local_write_failed',
          normalizeErrorMessage(error, 'Failed to update local transaction from cloud'),
          localTx,
          nextTx
        );
      }
      continue;
    }

    const reason = Number(localTx.version || 0) !== Number(cloudTx.version || 0)
      ? 'local_newer_version'
      : 'local_newer_updatedAt';
    const pushBackTx: Transaction = {
      ...localTx,
      syncStatus: 'pending',
      lastSyncError: undefined,
    };
    try {
      if (shouldSimulateMockLocalWriteFailure(config, transactionId)) {
        throw new Error('Mock local write failure');
      }
      await db.transactions.put(pushBackTx);
      pushBackItems.push(pushBackTx);
      entries.push({
        transactionId,
        action: 'pushedLocalUpdateToCloud',
        reason,
        before: cloneTransactionSnapshot(cloudTx),
        after: cloneTransactionSnapshot(pushBackTx),
      });
      summary.pushedLocalUpdateToCloud += 1;
    } catch (error: unknown) {
      markFailedEntry(
        entries,
        summary,
        transactionId,
        'local_write_failed',
        normalizeErrorMessage(error, 'Failed to prepare local transaction for push back'),
        cloudTx,
        pushBackTx
      );
    }
  }

  for (const localTx of localTransactions) {
    if (cloudById.has(localTx.id)) continue;
    const pushBackTx: Transaction = {
      ...localTx,
      syncStatus: 'pending',
      lastSyncError: undefined,
    };
    try {
      if (shouldSimulateMockLocalWriteFailure(config, localTx.id)) {
        throw new Error('Mock local write failure');
      }
      await db.transactions.put(pushBackTx);
      pushBackItems.push(pushBackTx);
      entries.push({
        transactionId: localTx.id,
        action: 'insertedLocalOnlyToCloud',
        reason: 'local_only',
        after: cloneTransactionSnapshot(pushBackTx),
      });
      summary.insertedLocalOnlyToCloud += 1;
    } catch (error: unknown) {
      markFailedEntry(
        entries,
        summary,
        localTx.id,
        'local_write_failed',
        normalizeErrorMessage(error, 'Failed to prepare local-only transaction for push back'),
        localTx,
        pushBackTx
      );
    }
  }

  if (pushBackItems.length > 0) {
    const uniquePushBackItems = Array.from(new Map(pushBackItems.map((item) => [item.id, item])).values());
    const pushResults = await syncCreateItemsWithConfig(config, uniquePushBackItems);
    await applyResultsToLocal(pushResults);

    const pushResultMap = new Map(pushResults.map((result) => [result.id, result]));
    for (const entry of entries) {
      if (entry.action !== 'pushedLocalUpdateToCloud' && entry.action !== 'insertedLocalOnlyToCloud') continue;
      const result = pushResultMap.get(entry.transactionId);
      if (!result || result.status === 'error') {
        if (entry.action === 'pushedLocalUpdateToCloud') {
          summary.pushedLocalUpdateToCloud -= 1;
        } else {
          summary.insertedLocalOnlyToCloud -= 1;
        }
        entry.action = 'failed';
        entry.errorMessage = result?.message || 'Push back failed';
        entry.reason = 'push_back_failed';
        summary.failed += 1;
      } else if (entry.after) {
        entry.after = {
          ...entry.after,
          syncStatus: 'synced',
          lastSyncError: undefined,
        };
      }
    }
  }

  const report = createPullReportRecord(normalizedYear, summary, entries);
  return {
    report: await persistPullReport(report),
  };
};
