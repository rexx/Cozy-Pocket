import { GoogleGenAI, Type } from '@google/genai';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, SUPPORTED_CURRENCIES } from '../constants';
import { isOffline } from './networkService';

export interface ParsedTransactionResult {
  amount?: number;
  currency?: string;
  type?: string;
  name?: string;
  merchant?: string;
  note?: string;
  categoryId?: string;
  subCategoryId?: string;
  paymentMethod?: string;
}

const PAYMENT_METHOD_VALUES = ['現金', '信用卡', '電子支付', '轉帳'] as const;
const CATEGORY_ID_VALUES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((category) => category.id);
const SUB_CATEGORY_ID_VALUES = EXPENSE_CATEGORIES.flatMap((category) => (
  category.subcategories?.map((subCategory) => subCategory.id) || []
));

const buildCategoryReference = () => {
  const expenseLines = EXPENSE_CATEGORIES.map((category) => {
    const subCategories = category.subcategories?.map((subCategory) => (
      `${subCategory.id} (${subCategory.name})`
    )).join(', ');
    return `- ${category.id} (${category.name}): ${subCategories || 'no subcategories'}`;
  });
  const incomeLines = INCOME_CATEGORIES.map((category) => (
    `- ${category.id} (${category.name})`
  ));

  return [
    'Expense categoryId and allowed subCategoryId values:',
    ...expenseLines,
    'Income categoryId values. Do not set subCategoryId for income:',
    ...incomeLines,
  ].join('\n');
};

const CATEGORY_REFERENCE = buildCategoryReference();

const transactionSchema = {
  type: Type.OBJECT,
  properties: {
    amount: { type: Type.NUMBER, description: 'The cost or amount of the transaction.' },
    currency: { type: Type.STRING, enum: [...SUPPORTED_CURRENCIES], description: 'Currency code. Default to TWD if not specified.' },
    type: { type: Type.STRING, enum: ['支出', '收入'], description: "Either '支出' for expense or '收入' for income." },
    name: { type: Type.STRING, description: 'Short transaction name, usually the item or service.' },
    merchant: { type: Type.STRING, description: 'Where the purchase was made or who paid the income.' },
    note: { type: Type.STRING, description: 'Detailed description or items bought.' },
    categoryId: {
      type: Type.STRING,
      enum: CATEGORY_ID_VALUES,
      description: 'Use only one categoryId from the provided category reference.',
    },
    subCategoryId: {
      type: Type.STRING,
      enum: SUB_CATEGORY_ID_VALUES,
      description: 'For expenses, use only a subCategoryId allowed by the selected categoryId. Leave empty for income.',
    },
    paymentMethod: {
      type: Type.STRING,
      enum: [...PAYMENT_METHOD_VALUES],
      description: 'Use only one of the supported payment methods.',
    },
  },
  required: ['amount', 'type', 'categoryId', 'paymentMethod', 'currency'],
};

const asObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI_INVALID_RESPONSE');
  }
  return value as Record<string, unknown>;
};

const readString = (source: Record<string, unknown>, key: keyof ParsedTransactionResult): string | undefined => {
  const value = source[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const normalizeParsedTransaction = (value: unknown): ParsedTransactionResult => {
  const source = asObject(value);
  const result: ParsedTransactionResult = {};
  const amount = Number(source.amount);

  if (Number.isFinite(amount)) {
    result.amount = amount;
  }

  result.currency = readString(source, 'currency')?.toUpperCase();
  result.type = readString(source, 'type');
  result.name = readString(source, 'name');
  result.merchant = readString(source, 'merchant');
  result.note = readString(source, 'note');
  result.categoryId = readString(source, 'categoryId');
  result.subCategoryId = readString(source, 'subCategoryId');
  result.paymentMethod = readString(source, 'paymentMethod');

  return result;
};

const getGeminiErrorMessage = (error: unknown): string => {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const message = rawMessage.toLowerCase();

  if (rawMessage === 'AI_EMPTY_RESPONSE') {
    return 'AI 沒有回傳可用內容，請換個說法再試一次';
  }
  if (rawMessage === 'AI_INVALID_RESPONSE' || rawMessage === 'AI_JSON_PARSE_FAILED') {
    return 'AI 回傳格式不正確，請換個說法再試一次';
  }
  if (message.includes('api key') || message.includes('apikey') || message.includes('permission') || message.includes('unauthorized') || message.includes('401') || message.includes('403')) {
    return 'Gemini API key 無法使用，請確認設定頁中的 key 是否正確';
  }
  if (message.includes('quota') || message.includes('rate') || message.includes('429')) {
    return 'Gemini 目前用量受限，請稍後再試';
  }
  if (message.includes('fetch') || message.includes('network') || message.includes('failed to fetch')) {
    return 'AI 解析連線失敗，請確認網路後再試';
  }
  if (message.includes('model') || message.includes('404')) {
    return 'Gemini 模型暫時不可用，請稍後再試';
  }

  return 'AI 解析失敗，請稍後再試';
};

export async function parseTransactionWithAI(text: string, apiKey: string): Promise<ParsedTransactionResult> {
  const trimmedText = text.trim();
  const trimmedApiKey = apiKey.trim();

  if (!trimmedText) {
    throw new Error('請先輸入要解析的內容');
  }
  if (!trimmedApiKey) {
    throw new Error('請先在資料與設定儲存 Gemini API key');
  }
  if (isOffline()) {
    throw new Error('目前離線，AI 解析需要網路連線');
  }

  try {
    const ai = new GoogleGenAI({ apiKey: trimmedApiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Parse this record into structured transaction data: "${trimmedText}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: transactionSchema,
        systemInstruction: [
          'You are a specialized accountant for a Taiwan household bookkeeping app.',
          'Correctly map the user input to type, categoryId, subCategoryId, currency, amount, merchant, name, note, and paymentMethod.',
          'Use only the exact categoryId and subCategoryId values listed below. Do not invent IDs and do not translate IDs.',
          'For expenses, choose subCategoryId only from the selected categoryId line. For income, do not set subCategoryId.',
          `Supported paymentMethod values: ${PAYMENT_METHOD_VALUES.join(', ')}.`,
          `Supported currency values: ${SUPPORTED_CURRENCIES.join(', ')}.`,
          CATEGORY_REFERENCE,
          "Examples: '吃午餐 100' -> currency: TWD, amount: 100, type: 支出, categoryId: food, subCategoryId: lunch. 'Ramen 1500yen cash' -> currency: JPY, amount: 1500, paymentMethod: 現金. '泰奶 120 baht 電子支付' -> currency: THB, amount: 120, paymentMethod: 電子支付.",
        ].join('\n'),
      },
    });

    const textResponse = response.text?.trim();
    if (!textResponse) {
      throw new Error('AI_EMPTY_RESPONSE');
    }

    try {
      return normalizeParsedTransaction(JSON.parse(textResponse));
    } catch (error) {
      if (error instanceof Error && error.message === 'AI_INVALID_RESPONSE') {
        throw error;
      }
      throw new Error('AI_JSON_PARSE_FAILED');
    }
  } catch (error) {
    console.error('AI Parsing Error:', error);
    throw new Error(getGeminiErrorMessage(error));
  }
}
