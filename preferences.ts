import { type PaymentMethodDisplayMode } from './types';

export const PAYMENT_METHOD_DISPLAY_MODE_SETTING_KEY = 'paymentMethodDisplayMode';
export const DEFAULT_PAYMENT_METHOD_DISPLAY_MODE: PaymentMethodDisplayMode = 'text';
export const GEMINI_API_KEY_SETTING_KEY = 'geminiApiKey';

export const getPaymentMethodDisplayMode = (value: unknown): PaymentMethodDisplayMode => (
  value === 'text' || value === 'icon'
    ? value
    : DEFAULT_PAYMENT_METHOD_DISPLAY_MODE
);

export const getGeminiApiKey = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);
