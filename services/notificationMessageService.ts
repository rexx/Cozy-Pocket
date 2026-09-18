import type { PullReportStatus, SyncOutcome } from '../types';

// Single source for the wording of operations that write locally and then push
// the result to the cloud: saving sync credentials, CSV import, tag rename and
// merchant rename. Each one has the same three outcomes (offline, partial sync
// failure, full success) and the same split between the short global toast and
// the fuller in-page status card, so the words live here instead of being
// retyped per section. This module only picks the words and the surface; the
// caller still owns rendering and the "查看同步狀態" callback.

// Non-idle status tones a synced operation can produce. `warning` is missing on
// purpose: it belongs to preconditions the user has to fix before the operation
// runs, not to an outcome.
export type OperationStatusType = 'success' | 'error' | 'info' | 'idle';

export interface OperationMessageResult {
  // Set only when the whole outcome fits the global toast, which means nothing
  // is left for the user to read afterwards. Otherwise the status card carries
  // it, so that the two surfaces never describe the same operation at once.
  toastMessage: string | null;
  statusType: OperationStatusType;
  statusMessage: string;
  // The status needs the entry point to 同步狀態 to reach the failed rows.
  showSyncProgressAction: boolean;
}

interface SyncedOperationMessageOptions {
  // Where a fully successful outcome goes. `toast` is the default; `status`
  // suits operations whose result the user wants to keep reading, such as a tag
  // split that lists its successor tags.
  successSurface?: 'toast' | 'status';
}

const OFFLINE_PENDING_LINE = '目前離線，待恢復連線後再同步';

const idleResult = (toastMessage: string | null): OperationMessageResult => ({
  toastMessage,
  statusType: 'idle',
  statusMessage: '',
  showSyncProgressAction: false,
});

/** `已將 A 更名為 B` plus the row count every batch write reports. */
export const describeUpdatedCount = (summary: string, affectedCount: number): string =>
  `${summary}，共更新 ${affectedCount} 筆`;

const describeSyncFailureCount = (outcome: SyncOutcome): string =>
  `同步失敗 ${outcome.failed}/${outcome.total} 筆`;

/**
 * Turn a completed local write plus its sync outcome into one message on one
 * surface. `summary` is the operation's own success sentence, already carrying
 * whatever counts it wants to report.
 */
export const buildSyncedOperationMessage = (
  summary: string,
  outcome: SyncOutcome,
  options: SyncedOperationMessageOptions = {}
): OperationMessageResult => {
  if (outcome.skippedOffline) {
    return {
      toastMessage: null,
      statusType: 'info',
      statusMessage: `${summary}\n${OFFLINE_PENDING_LINE}`,
      showSyncProgressAction: false,
    };
  }

  if (outcome.failed > 0) {
    return {
      toastMessage: null,
      statusType: 'error',
      statusMessage: `${summary}\n${describeSyncFailureCount(outcome)}`,
      showSyncProgressAction: true,
    };
  }

  if (options.successSurface === 'status') {
    return {
      toastMessage: null,
      statusType: 'success',
      statusMessage: summary,
      showSyncProgressAction: false,
    };
  }

  return idleResult(summary);
};

/**
 * Yearly pull reports announce themselves through a toast because opening the
 * report page unmounts the section that would have held a status card.
 */
export const describePullReportOutcome = (year: string, status: PullReportStatus): string => {
  if (status === 'failed') return `${year} 年年度雲端同步失敗`;
  if (status === 'partial') return `已完成 ${year} 年年度雲端同步，但有部分失敗`;
  return `已完成 ${year} 年年度雲端同步`;
};

const SYNC_FAILURE_DETAIL_LIMIT = 3;

/**
 * Per-row detail for the debug error panel, which needs ids and raw messages
 * rather than a count. Long failure lists are capped so one bad sync cannot
 * flood the panel.
 */
export const buildSyncFailureDetail = (
  results: { id: string; status: string; message?: string }[],
  fallbackLabel: string
): string | null => {
  const failed = results.filter((result) => result.status === 'error');
  if (failed.length === 0) return null;

  const details = failed.slice(0, SYNC_FAILURE_DETAIL_LIMIT).map((result) => {
    const message = result.message?.trim() || fallbackLabel;
    return `${result.id}: ${message}`;
  });
  const extraCount = failed.length - details.length;
  return extraCount > 0
    ? `${details.join(' | ')} | 另外 ${extraCount} 筆失敗`
    : details.join(' | ');
};
