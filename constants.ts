
// Add missing import for format
import { format } from 'date-fns';
import { Category, Transaction } from './types';

export const EXPENSE_CATEGORIES: Category[] = [
  { 
    id: 'fixed', name: '固定支出', icon: 'CalendarCheck', color: '#4A90E2',
    subcategories: [
      { id: 'rent', name: '房租', icon: 'Home' },
      { id: 'mortgage', name: '房貸', icon: 'Building' },
      { id: 'management', name: '管理費', icon: 'Key' },
      { id: 'water', name: '水費', icon: 'Droplets' },
      { id: 'electricity', name: '電費', icon: 'Zap' },
      { id: 'gas', name: '瓦斯費', icon: 'Flame' },
      { id: 'telecom', name: '電信費', icon: 'Wifi' },
      { id: 'insurance', name: '保險', icon: 'ShieldCheck' },
      { id: 'monthly_parking', name: '月租停車', icon: 'CircleParking' },
      { id: 'other_fixed', name: '其他固定', icon: 'PlusSquare' }
    ]
  },
  { 
    id: 'food', name: '飲食', icon: 'Utensils', color: '#eecf8e',
    subcategories: [
      { id: 'breakfast', name: '早餐', icon: 'Coffee' },
      { id: 'lunch', name: '午餐', icon: 'Sandwich' },
      { id: 'dinner', name: '晚餐', icon: 'Beef' },
      { id: 'snack', name: '點心', icon: 'Cookie' },
      { id: 'drink', name: '飲料', icon: 'CupSoda' },
      { id: 'alcohol', name: '酒', icon: 'Wine' },
      { id: 'fruit', name: '水果', icon: 'Apple' },
      { id: 'ingredients', name: '食材', icon: 'Carrot' },
      { id: 'party', name: '聚餐', icon: 'Users' },
      { id: 'other_food', name: '其他飲食', icon: 'Utensils' }
    ]
  },
  { 
    id: 'transport', name: '交通', icon: 'Car', color: '#5e8fd9',
    subcategories: [
      { id: 'bus', name: '公車', icon: 'Bus' },
      { id: 'train', name: '火車', icon: 'TrainFront' },
      { id: 'mrt', name: '捷運', icon: 'TramFront' },
      { id: 'taxi', name: '計程車', icon: 'Taxi' },
      { id: 'parking_fee', name: '停車費', icon: 'CircleP' },
      { id: 'toll', name: '過路費', icon: 'Road' },
      { id: 'maintenance', name: '維修保養', icon: 'Wrench' },
      { id: 'car_exp', name: '汽車', icon: 'Car' },
      { id: 'scooter_exp', name: '機車', icon: 'Bike' },
      { id: 'bike_exp', name: '單車', icon: 'Bike' },
      { id: 'flight', name: '機票', icon: 'Plane' },
      { id: 'ship', name: '船票', icon: 'Ship' },
      { id: 'other_transport', name: '其他交通', icon: 'Navigation' }
    ]
  },
  { 
    id: 'daily', name: '生活日用品', icon: 'ShoppingBasket', color: '#8fb37a',
    subcategories: [
      { id: 'consumables', name: '日用品', icon: 'SprayCan' },
      { id: 'home_supplies', name: '居家用品', icon: 'Bed' },
      { id: 'appliances', name: '家電', icon: 'Tv' },
      { id: '3c', name: '3C', icon: 'Smartphone' },
      { id: 'furniture', name: '家具', icon: 'Lamp' },
      { id: 'other_daily', name: '其他用品', icon: 'Box' }
    ]
  },
  { 
    id: 'medical', name: '醫療保健', icon: 'Hospital', color: '#d9534f',
    subcategories: [
      { id: 'clinic', name: '看診', icon: 'Stethoscope' },
      { id: 'medicine', name: '藥品', icon: 'Pill' },
      { id: 'dentist', name: '牙醫', icon: 'Dna' },
      { id: 'checkup', name: '健康檢查', icon: 'Activity' },
      { id: 'supplements', name: '保健食品', icon: 'HeartPulse' },
      { id: 'other_medical', name: '其他醫療', icon: 'PlusSquare' }
    ]
  },
  { 
    id: 'kids', name: '小孩', icon: 'Baby', color: '#d9a7c7',
    subcategories: [
      { id: 'tuition', name: '托育學費', icon: 'School' },
      { id: 'cram_school', name: '才藝補習', icon: 'Palette' },
      { id: 'toys', name: '玩具', icon: 'Gamepad' },
      { id: 'books', name: '書籍', icon: 'BookOpen' },
      { id: 'baby_supplies', name: '尿布奶粉', icon: 'Milk' },
      { id: 'kids_medical', name: '小孩醫療', icon: 'Baby' },
      { id: 'other_kids', name: '其他小孩', icon: 'Heart' }
    ]
  },
  { 
    id: 'entertainment', name: '娛樂休閒', icon: 'Gamepad2', color: '#9b6cc3',
    subcategories: [
      { id: 'movie', name: '電影', icon: 'Film' },
      { id: 'streaming', name: '串流訂閱', icon: 'Music' },
      { id: 'game', name: '遊戲', icon: 'Joystick' },
      { id: 'exhibition', name: '展覽', icon: 'Ticket' },
      { id: 'attractions', name: '門票景點', icon: 'MapPin' },
      { id: 'lodging', name: '旅遊住宿', icon: 'Hotel' },
      { id: 'souvenirs', name: '伴手禮', icon: 'Gift' },
      { id: 'other_entertainment', name: '其他娛樂', icon: 'Compass' }
    ]
  },
  { 
    id: 'shopping', name: '購物', icon: 'ShoppingBag', color: '#c9707e',
    subcategories: [
      { id: 'clothes', name: '衣服', icon: 'Shirt' },
      { id: 'shoes', name: '鞋子', icon: 'Footprints' },
      { id: 'accessories', name: '配件', icon: 'Watch' },
      { id: 'makeup', name: '美妝', icon: 'Brush' },
      { id: 'skincare', name: '保養', icon: 'Sparkles' },
      { id: 'other_shopping', name: '其他購物', icon: 'ShoppingBag' }
    ]
  },
  { 
    id: 'social', name: '社交人情', icon: 'Users', color: '#4a6fa5',
    subcategories: [
      { id: 'gift_money', name: '禮金', icon: 'Envelopes' },
      { id: 'red_envelope_exp', name: '紅包', icon: 'Mail' },
      { id: 'treating', name: '請客', icon: 'UserPlus' },
      { id: 'donation', name: '捐款', icon: 'HeartHandshake' },
      { id: 'other_social', name: '其他社交', icon: 'Users' }
    ]
  },
  { 
    id: 'finance', name: '理財與其他', icon: 'MoreHorizontal', color: '#ABB2BF',
    subcategories: [
      { id: 'investment_exp', name: '投資', icon: 'TrendingUp' },
      { id: 'trading_fee', name: '手續費', icon: 'Receipt' },
      { id: 'bank_fee', name: '銀行手續費', icon: 'CreditCard' },
      { id: 'tax', name: '稅金', icon: 'Landmark' },
      { id: 'fine', name: '罰款', icon: 'AlertTriangle' },
      { id: 'other_finance', name: '其他理財', icon: 'Coins' },
      { id: 'misc', name: '其他支出', icon: 'HelpCircle' }
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
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '12:30',
    paymentMethod: '電子支付',
    tags: '午餐'
  }
];
