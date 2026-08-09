import { db, type AppSetting } from './db';
import { type CalendarViewMode, type PaymentMethodDisplayMode } from './types';

export const PAYMENT_METHOD_DISPLAY_MODE_SETTING_KEY = 'paymentMethodDisplayMode';
export const DEFAULT_PAYMENT_METHOD_DISPLAY_MODE: PaymentMethodDisplayMode = 'text';
export const GEMINI_API_KEY_SETTING_KEY = 'geminiApiKey';

export const HOME_NAV_ARROWS_VISIBLE_SETTING_KEY = 'homeNavArrowsVisible';
export const DEFAULT_HOME_NAV_ARROWS_VISIBLE = true;

export const ERROR_BANNER_VISIBLE_SETTING_KEY = 'errorBannerVisible';
export const DEFAULT_ERROR_BANNER_VISIBLE = false;

export const STATS_EXCLUDED_SUBCATEGORY_KEYS_SETTING_KEY = 'statsExcludedSubCategoryKeys';

export const HOME_CALENDAR_VIEW_MODE_SETTING_KEY = 'homeCalendarViewMode';
export const DEFAULT_HOME_CALENDAR_VIEW_MODE: CalendarViewMode = 'month';

// Both preferences used to live in localStorage, keyed as below. Installs that
// predate the move still hold their values there, so boot migrates them into
// the settings table once and drops the originals.
const LEGACY_STATS_EXCLUDED_SUBCATEGORY_KEYS_STORAGE_KEY = 'statsExcludedSubCategoryKeys';
const LEGACY_HOME_CALENDAR_VIEW_MODE_STORAGE_KEY = 'home-calendar-view-mode';

export const getPaymentMethodDisplayMode = (value: unknown): PaymentMethodDisplayMode => (
  value === 'text' || value === 'icon'
    ? value
    : DEFAULT_PAYMENT_METHOD_DISPLAY_MODE
);

export const getGeminiApiKey = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

// Only an explicit stored `false` hides the arrows; anything else (unset,
// legacy values) keeps them visible so the default stays "show".
export const getHomeNavArrowsVisible = (value: unknown): boolean => (
  value === false ? false : DEFAULT_HOME_NAV_ARROWS_VISIBLE
);

// Only an explicit stored `true` shows the debug error banner; anything else
// (unset, legacy values) keeps it hidden so the default stays "off".
export const getErrorBannerVisible = (value: unknown): boolean => (
  value === true ? true : DEFAULT_ERROR_BANNER_VISIBLE
);

const sanitizeSubCategoryExclusionKey = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Keys are stored as `categoryId:subCategoryId`; require the separator so
  // malformed entries (e.g. lone IDs) cannot accidentally match every tx.
  if (!trimmed.includes(':')) return null;
  return trimmed;
};

const dedupeKeys = (keys: string[]): string[] => Array.from(new Set(keys));

export const parseExcludedSubCategoryKeys = (raw: unknown): string[] => {
  if (typeof raw === 'string') {
    try {
      return parseExcludedSubCategoryKeys(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const normalized = raw
    .map(sanitizeSubCategoryExclusionKey)
    .filter((key): key is string => key !== null);
  return dedupeKeys(normalized);
};

export const getHomeCalendarViewMode = (value: unknown): CalendarViewMode => (
  value === 'week' || value === 'month' ? value : DEFAULT_HOME_CALENDAR_VIEW_MODE
);

const readLegacyLocalStorageValue = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const removeLegacyLocalStorageValue = (key: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // A failed cleanup is harmless: the settings table already won the read.
  }
};

// Runs before the boot settings read so a migrated value is what that read
// sees. Existing settings rows always win, which keeps this idempotent and
// stops a stale localStorage leftover from overwriting a newer preference.
export const migrateLegacyLocalStoragePreferences = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  const [storedCalendarViewMode, storedExcludedKeys] = await Promise.all([
    db.settings.get(HOME_CALENDAR_VIEW_MODE_SETTING_KEY),
    db.settings.get(STATS_EXCLUDED_SUBCATEGORY_KEYS_SETTING_KEY),
  ]);

  const pending: AppSetting[] = [];

  const legacyCalendarViewMode = readLegacyLocalStorageValue(LEGACY_HOME_CALENDAR_VIEW_MODE_STORAGE_KEY);
  if (!storedCalendarViewMode && (legacyCalendarViewMode === 'week' || legacyCalendarViewMode === 'month')) {
    pending.push({ key: HOME_CALENDAR_VIEW_MODE_SETTING_KEY, value: legacyCalendarViewMode });
  }

  const legacyExcludedKeys = readLegacyLocalStorageValue(LEGACY_STATS_EXCLUDED_SUBCATEGORY_KEYS_STORAGE_KEY);
  if (!storedExcludedKeys && legacyExcludedKeys !== null) {
    const normalized = parseExcludedSubCategoryKeys(legacyExcludedKeys);
    if (normalized.length > 0) {
      pending.push({ key: STATS_EXCLUDED_SUBCATEGORY_KEYS_SETTING_KEY, value: normalized });
    }
  }

  if (pending.length > 0) {
    await db.settings.bulkPut(pending);
  }

  removeLegacyLocalStorageValue(LEGACY_HOME_CALENDAR_VIEW_MODE_STORAGE_KEY);
  removeLegacyLocalStorageValue(LEGACY_STATS_EXCLUDED_SUBCATEGORY_KEYS_STORAGE_KEY);
};

export const buildSubCategoryExclusionKey = (
  categoryId: string,
  subCategoryId: string
): string => `${categoryId || ''}:${subCategoryId || ''}`;
