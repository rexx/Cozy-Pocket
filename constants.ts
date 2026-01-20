
import { Category, Transaction } from './types';

export const CATEGORIES: Category[] = [
  { id: 'food', name: '飲食', icon: 'Utensils', color: '#E5C07B' },
  { id: 'transport', name: '交通', icon: 'Car', color: '#4A90E2' },
  { id: 'medical', name: '醫療', icon: 'Hospital', color: '#D0021B' },
  { id: 'housing_item', name: '家居', icon: 'Home', color: '#4169E1' },
  { id: 'family', name: '家庭', icon: 'Users', color: '#E19ED1' },
  { id: 'personal', name: '個人', icon: 'User', color: '#B8B8B8' },
  { id: 'house', name: '房屋', icon: 'Building', color: '#F5A623' },
  { id: 'shopping', name: '購物', icon: 'Gift', color: '#BC4A4A' },
  { id: 'entertainment', name: '娛樂', icon: 'Mic2', color: '#9013FE' },
  { id: 'living', name: '生活', icon: 'Flower2', color: '#7ED321' },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
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
