export const SETTINGS_SECTION_COPY = {
  preferences: {
    title: '偏好設定',
    description: '調整預設幣別、可用幣別與交易列表支付方式顯示。',
  },
  ai: {
    title: 'AI 設定',
    description: '設定 Gemini API key，讓新增交易可使用 AI 快速填寫。',
  },
  sync: {
    title: '同步設定',
    description: '設定雲端同步，並查看同步狀態。',
  },
  tags: {
    title: 'Tag 管理',
    description: '整理 tag 名稱，並查看相關交易。',
  },
  merchant: {
    title: '商家管理',
    description: '整理商家名稱，並查看相關交易。',
  },
  'import-export': {
    title: '匯入匯出',
    description: '匯入匯出交易與設定的備份檔。',
  },
  danger: {
    title: '危險操作',
    description: '重置本機資料，或加入範例資料。',
  },
} as const;
