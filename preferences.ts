import { type PaymentMethodDisplayMode } from './types';

export const PAYMENT_METHOD_DISPLAY_MODE_SETTING_KEY = 'paymentMethodDisplayMode';
export const DEFAULT_PAYMENT_METHOD_DISPLAY_MODE: PaymentMethodDisplayMode = 'text';

export const getPaymentMethodDisplayMode = (value: unknown): PaymentMethodDisplayMode => (
  value === 'text' || value === 'icon'
    ? value
    : DEFAULT_PAYMENT_METHOD_DISPLAY_MODE
);
