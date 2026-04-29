import { ArrowLeftRight, Banknote, CreditCard, SmartphoneNfc, type LucideIcon } from 'lucide-react';
import { type PaymentMethod } from '../types';

export const KNOWN_PAYMENT_METHODS: PaymentMethod[] = ['現金', '信用卡', '電子支付', '轉帳'];

const paymentMethodSet = new Set<string>(KNOWN_PAYMENT_METHODS);

const paymentMethodIconMap: Record<PaymentMethod, LucideIcon> = {
  現金: Banknote,
  信用卡: CreditCard,
  電子支付: SmartphoneNfc,
  轉帳: ArrowLeftRight,
};

export const getPaymentMethodIcon = (method: string): LucideIcon | null => {
  const normalizedMethod = method.trim();
  if (!paymentMethodSet.has(normalizedMethod)) return null;
  return paymentMethodIconMap[normalizedMethod as PaymentMethod];
};

export const getPaymentMethodIconOrFallback = (method: string): LucideIcon => (
  getPaymentMethodIcon(method) ?? Banknote
);
