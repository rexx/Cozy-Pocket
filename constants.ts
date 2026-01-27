
import { Category, Transaction } from './types';

export const EXPENSE_CATEGORIES: Category[] = [
  { id: 'fixed', name: '固定支出', icon: 'CalendarCheck', color: '#4A90E2' },
  { id: 'food', name: '飲食', icon: 'Utensils', color: '#E5C07B' },
  { id: 'transport', name: '交通', icon: 'Car', color: '#56B6C2' },
  { id: 'daily', name: '生活用品', icon: 'ShoppingBasket', color: '#98C379' },
  { id: 'medical', name: '醫療保健', icon: 'Hospital', color: '#E06C75' },
  { id: 'kids', name: '小孩', icon: 'Baby', color: '#D19A66' },
  { id: 'entertainment', name: '休閒娛樂', icon: 'Gamepad2', color: '#C678DD' },
  { id: 'shopping', name: '購物', icon: 'ShoppingBag', color: '#BC4A4A' },
  { id: 'social', name: '社交', icon: 'Users', color: '#61AFEF' },
  { id: 'other', name: '其他', icon: 'MoreHorizontal', color: '#ABB2BF' },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: 'salary', name: '薪資', icon: 'Banknote', color: '#F472B6' },
  { id: 'bonus', name: '獎金', icon: 'Trophy', color: '#FB7185' },
  { id: 'overtime', name: '加班費', icon: 'Timer', color: '#FDA4AF' },
  { id: 'side_hustle', name: '副業收入', icon: 'Laptop', color: '#E879F9' },
  { id: 'investment', name: '投資收入', icon: 'TrendingUp', color: '#C084FC' },
  { id: 'rent', name: '租金收入', icon: 'Home', color: '#A78BFA' },
  { id: 'subsidy', name: '補助／津貼', icon: 'HeartHandshake', color: '#818CF8' },
  { id: 'tax_refund', name: '退稅', icon: 'FileDigit', color: '#6366F1' },
  { id: 'red_envelope', name: '紅包收入', icon: 'Mail', color: '#F43F5E' },
  { id: 'other_income', name: '其他收入', icon: 'MoreHorizontal', color: '#94A3B8' },
];

// For backwards compatibility and easier lookup
export const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: '支出',
    amount: 458,
    categoryId: 'food',
    name: 'PIZZA',
    note: '雙拼口味',
    merchant: 'LOPIA',
    date: '2026-01-17',
    time: '12:30',
    paymentMethod: '電子支付',
    tags: '午餐'
  },
  {
    id: '2',
    type: '支出',
    amount: 318,
    categoryId: 'food',
    name: '炸雞',
    note: '無骨大份',
    merchant: 'LOPIA',
    date: '2026-01-17',
    time: '18:15',
    paymentMethod: '電子支付',
    tags: '晚餐'
  }
];
