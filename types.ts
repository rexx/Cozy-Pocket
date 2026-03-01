
export type PaymentMethod = '現金' | '信用卡' | '電子支付' | '轉帳';
export type TransactionType = '支出' | '收入';

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
  id: string;
  type: TransactionType;
  amount: number;
  currency: string; // New field
  categoryId: string;
  subCategoryId?: string; 
  name: string;
  note?: string;
  timestamp: number;
  paymentMethod: string;
  merchant?: string;
  projectName?: string;
  tags?: string;
  updatedAt?: number;
  syncStatus?: 'pending' | 'synced' | 'error';
  lastSyncError?: string;
}

export interface MonthlyStats {
  totalIncome: number;
  totalExpense: number;
  budget: number;
}
