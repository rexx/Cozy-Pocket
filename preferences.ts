import { type PaymentMethodDisplayMode } from './types';

export const PAYMENT_METHOD_DISPLAY_MODE_SETTING_KEY = 'paymentMethodDisplayMode';
export const DEFAULT_PAYMENT_METHOD_DISPLAY_MODE: PaymentMethodDisplayMode = 'text';
export const GEMINI_API_KEY_SETTING_KEY = 'geminiApiKey';

export const STATS_EXCLUDED_SUBCATEGORY_KEYS_STORAGE_KEY = 'statsExcludedSubCategoryKeys';

export const getPaymentMethodDisplayMode = (value: unknown): PaymentMethodDisplayMode => (
  value === 'text' || value === 'icon'
    ? value
    : DEFAULT_PAYMENT_METHOD_DISPLAY_MODE
);

export const getGeminiApiKey = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
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

export const readExcludedSubCategoryKeys = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STATS_EXCLUDED_SUBCATEGORY_KEYS_STORAGE_KEY);
    if (raw === null) return [];
    return parseExcludedSubCategoryKeys(raw);
  } catch {
    return [];
  }
};

export const writeExcludedSubCategoryKeys = (keys: string[]): void => {
  if (typeof window === 'undefined') return;
  try {
    const normalized = parseExcludedSubCategoryKeys(keys);
    window.localStorage.setItem(
      STATS_EXCLUDED_SUBCATEGORY_KEYS_STORAGE_KEY,
      JSON.stringify(normalized)
    );
  } catch {
    // Swallow quota / serialization failures; statistics still work in memory.
  }
};

export const buildSubCategoryExclusionKey = (
  categoryId: string,
  subCategoryId: string
): string => `${categoryId || ''}:${subCategoryId || ''}`;
