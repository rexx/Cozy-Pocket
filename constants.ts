
import { Category, Transaction } from './types';

export const EXPENSE_CATEGORIES: Category[] = [
  { 
    id: 'fixed', name: '固定支出', icon: 'CalendarCheck', color: '#4A90E2',
    subcategories: [
      { id: 'rent', name: '房租' }, { id: 'mortgage', name: '房貸' }, { id: 'management', name: '管理費' },
      { id: 'water', name: '水費' }, { id: 'electricity', name: '電費' }, { id: 'gas', name: '瓦斯費' },
      { id: 'telecom', name: '電信費' }, { id: 'insurance', name: '保險' }, { id: 'monthly_parking', name: '月租停車' },
      { id: 'other_fixed', name: '其他固定' }
    ]
  },
  { 
    id: 'food', name: '飲食', icon: 'Utensils', color: '#eecf8e',
    subcategories: [
      { id: 'breakfast', name: '早餐' }, { id: 'lunch', name: '午餐' }, { id: 'dinner', name: '晚餐' },
      { id: 'snack', name: '點心' }, { id: 'drink', name: '飲料' }, { id: 'alcohol', name: '酒' },
      { id: 'fruit', name: '水果' }, { id: 'ingredients', name: '食材' }, { id: 'party', name: '聚餐' },
      { id: 'other_food', name: '其他飲食' }
    ]
  },
  { 
    id: 'transport', name: '交通', icon: 'Car', color: '#5e8fd9',
    subcategories: [
      { id: 'bus', name: '公車' }, { id: 'train', name: '火車' }, { id: 'mrt', name: '捷運' },
      { id: 'taxi', name: '計程車' }, { id: 'parking_fee', name: '停車費' }, { id: 'toll', name: '過路費' },
      { id: 'maintenance', name: '保養維修' }, { id: 'car_exp', name: '汽車' }, { id: 'scooter_exp', name: '機車' },
      { id: 'bike_exp', name: '單車' }, { id: 'flight', name: '機票' }, { id: 'ship', name: '船票' },
      { id: 'other_transport', name: '其他交通' }
    ]
  },
  { 
    id: 'daily', name: '生活日用品', icon: 'ShoppingBasket', color: '#8fb37a',
    subcategories: [
      { id: 'consumables', name: '日用品' }, { id: 'home_supplies', name: '居家用品' }, { id: 'appliances', name: '家電' },
      { id: '3c', name: '3C' }, { id: 'furniture', name: '家具' }, { id: 'other_daily', name: '其他用品' }
    ]
  },
  { 
    id: 'medical', name: '醫療保健', icon: 'Hospital', color: '#d9534f',
    subcategories: [
      { id: 'clinic', name: '看診' }, { id: 'medicine', name: '藥品' }, { id: 'dentist', name: '牙醫' },
      { id: 'checkup', name: '健檢' }, { id: 'supplements', name: '保健食品' }, { id: 'other_medical', name: '其他醫療' }
    ]
  },
  { 
    id: 'kids', name: '小孩', icon: 'Baby', color: '#d9a7c7',
    subcategories: [
      { id: 'tuition', name: '托育學費' }, { id: 'cram_school', name: '才藝補習' }, { id: 'toys', name: '玩具' },
      { id: 'books', name: '書籍' }, { id: 'baby_supplies', name: '尿布奶粉' }, { id: 'kids_medical', name: '小孩醫療' },
      { id: 'other_kids', name: '其他小孩' }
    ]
  },
  { 
    id: 'entertainment', name: '娛樂休閒', icon: 'Gamepad2', color: '#9b6cc3',
    subcategories: [
      { id: 'movie', name: '電影' }, { id: 'streaming', name: '串流訂閱' }, { id: 'game', name: '遊戲' },
      { id: 'exhibition', name: '展覽' }, { id: 'attractions', name: '門票景點' }, { id: 'lodging', name: '住宿' },
      { id: 'souvenirs', name: '伴手禮' }, { id: 'other_entertainment', name: '其他娛樂' }
    ]
  },
  { 
    id: 'shopping', name: '購物', icon: 'ShoppingBag', color: '#c9707e',
    subcategories: [
      { id: 'clothes', name: '衣服' }, { id: 'shoes', name: '鞋子' }, { id: 'accessories', name: '配件' },
      { id: 'makeup', name: '美妝' }, { id: 'skincare', name: '保養' }, { id: 'other_shopping', name: '其他購物' }
    ]
  },
  { 
    id: 'social', name: '社交人情', icon: 'Users', color: '#4a6fa5',
    subcategories: [
      { id: 'gift_money', name: '禮金' }, { id: 'red_envelope_exp', name: '紅包' }, { id: 'treating', name: '請客' },
      { id: 'donation', name: '捐款' }, { id: 'other_social', name: '其他社交' }
    ]
  },
  { 
    id: 'finance', name: '理財與其他', icon: 'MoreHorizontal', color: '#ABB2BF',
    subcategories: [
      { id: 'investment_exp', name: '投資' }, { id: 'trading_fee', name: '手續費' }, { id: 'bank_fee', name: '銀行手續' },
      { id: 'tax', name: '稅金' }, { id: 'fine', name: '罰款' }, { id: 'other_finance', name: '其他理財' },
      { id: 'misc', name: '其他支出' }
    ]
  },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: 'salary', name: '薪資', icon: 'Banknote', color: '#F472B6' },
  { id: 'bonus', name: '獎金', icon: 'Trophy', color: '#FB7185' },
  { id: 'overtime', name: '加班費', icon: 'Timer', color: '#FDA4AF' },
  { id: 'side_hustle', name: '副業收入', icon: 'Laptop', color: '#E879F9' },
  { id: 'investment', name: '投資收入', icon: 'TrendingUp', color: '#C084FC' },
  { id: 'rent_income', name: '租金收入', icon: 'Home', color: '#A78BFA' },
  { id: 'subsidy', name: '補助津貼', icon: 'HeartHandshake', color: '#818CF8' },
  { id: 'tax_refund', name: '退稅', icon: 'FileDigit', color: '#6366F1' },
  { id: 'red_envelope', name: '紅包收入', icon: 'Mail', color: '#F43F5E' },
  { id: 'other_income', name: '其他收入', icon: 'MoreHorizontal', color: '#94A3B8' },
];

export const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: '支出',
    amount: 458,
    categoryId: 'food',
    subCategoryId: 'lunch',
    name: '午餐 PIZZA',
    note: '雙拼口味',
    merchant: 'LOPIA',
    date: '2026-01-17',
    time: '12:30',
    paymentMethod: '電子支付',
    tags: '午餐'
  }
];
