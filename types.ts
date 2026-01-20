
export type PaymentMethod = '現金' | '信用卡' | '電子支付' | '轉帳';

export interface Category {
  id: string;
  name: string;
  icon: any; 
  color: string;
}

export interface Transaction {
  id: string;
  amount: number;
  categoryId: string;
  name: string; // The primary item name (Big text)
  note?: string; // Additional notes (Small text)
  date: string; 
  time: string; 
  paymentMethod: string;
  merchant?: string;
  projectName?: string;
  tags?: string;
}

export interface MonthlyStats {
  total: number;
  budget: number;
}
