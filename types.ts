
export type PaymentMethod = '現金' | '信用卡' | '電子支付' | '轉帳';
export type PaymentMethodDisplayMode = 'text' | 'icon';
export type TransactionType = '支出' | '收入';
export type CalendarViewMode = 'week' | 'month';

export interface SubCategory {
  id: string;
  name: string;
  icon: string;
}

export interface Category {
  id: string;
  name: string;
  icon: any; 
  color: string;
  subcategories?: SubCategory[];
}

export interface Transaction {
  id: string; // generated from Date.now(), millisecond-based string ID
  type: TransactionType;
  amount: number;
  currency: string; // New field
  categoryId: string;
  subCategoryId?: string; 
  name: string;
  note?: string;
  timestamp: number; // transaction time in epoch seconds
  readableDateTime?: string;
  paymentMethod: string;
  merchant?: string;
  tags?: string;
  updatedAt?: number; // last update time in epoch milliseconds
  version?: number;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error';
  lastSyncError?: string;
}

export interface SuggestionItem {
  value: string;
  count: number;
  lastUsedAt: number;
  categoryIds: string[];
  subCategoryIds: string[];
}

export interface SuggestionIndex {
  merchants: SuggestionItem[];
  names: SuggestionItem[];
  tags: SuggestionItem[];
}

export interface MonthlyStats {
  totalIncome: number;
  totalExpense: number;
  budget: number;
}
