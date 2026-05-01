
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

export type PullReportStatus = 'success' | 'partial' | 'failed';
export type PullReportEntryAction =
  | 'insertedFromCloud'
  | 'updatedFromCloud'
  | 'pushedLocalUpdateToCloud'
  | 'insertedLocalOnlyToCloud'
  | 'pushedBackToCloud'
  | 'unchanged'
  | 'failed';
export type PullReportEntryReason =
  | 'cloud_only'
  | 'cloud_newer_version'
  | 'cloud_newer_updatedAt'
  | 'local_only'
  | 'local_newer_version'
  | 'local_newer_updatedAt'
  | 'identical'
  | 'invalid_cloud_item'
  | 'local_write_failed'
  | 'push_back_failed';

export interface PullReportTransactionSnapshot {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  categoryId: string;
  subCategoryId?: string;
  name: string;
  note?: string;
  timestamp: number;
  readableDateTime?: string;
  paymentMethod: string;
  merchant?: string;
  tags?: string;
  updatedAt?: number;
  version?: number;
  syncStatus?: Transaction['syncStatus'];
  lastSyncError?: string;
}

export interface PullReportSummary {
  fetched: number;
  insertedFromCloud: number;
  updatedFromCloud: number;
  pushedLocalUpdateToCloud: number;
  insertedLocalOnlyToCloud: number;
  pushedBackToCloud?: number;
  unchanged: number;
  failed: number;
}

export interface PullReportEntry {
  transactionId: string;
  action: PullReportEntryAction;
  reason: PullReportEntryReason;
  before?: PullReportTransactionSnapshot;
  after?: PullReportTransactionSnapshot;
  errorMessage?: string;
}

export interface PullReport {
  id: string;
  createdAt: number;
  year: string;
  status: PullReportStatus;
  summary: PullReportSummary;
  runError?: string;
  entries: PullReportEntry[];
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
