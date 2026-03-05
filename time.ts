import { format } from 'date-fns';

const EPOCH_MS_THRESHOLD = 1_000_000_000_000;

export const toEpochSeconds = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return value >= EPOCH_MS_THRESHOLD ? Math.floor(value / 1000) : Math.floor(value);
};

export const toEpochMillis = (value: number): number => toEpochSeconds(value) * 1000;

export const formatReadableDateTime = (epochValue: number): string =>
  format(new Date(toEpochMillis(epochValue)), 'yyyy-MM-dd HH:mm');
