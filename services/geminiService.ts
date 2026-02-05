
import { GoogleGenAI, Type } from "@google/genai";

const transactionSchema = {
  type: Type.OBJECT,
  properties: {
    amount: { type: Type.NUMBER, description: "The cost/amount of the transaction" },
    currency: { type: Type.STRING, description: "The currency code, e.g., TWD, USD, JPY, EUR, HKD, CNY. Default to TWD if not specified." },
    type: { type: Type.STRING, description: "Either '支出' (expense) or '收入' (income)" },
    merchant: { type: Type.STRING, description: "Where the purchase was made" },
    note: { type: Type.STRING, description: "Detailed description or items bought" },
    categoryId: { 
      type: Type.STRING, 
      description: "Expense: food, transport, daily, medical, kids, fixed, entertainment, shopping, social, finance. Income: salary, bonus, overtime, side_hustle, investment, rent_income, subsidy, tax_refund, red_envelope, other_income" 
    },
    subCategoryId: {
      type: Type.STRING,
      description: "Detailed subcategory ID from the mapping list if it is an expense."
    },
    paymentMethod: { 
      type: Type.STRING, 
      description: "One of: 現金, 信用卡, 電子支付, 轉帳" 
    }
  },
  required: ["amount", "type", "categoryId", "paymentMethod", "currency"]
};

export async function parseTransactionWithAI(text: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse this record into structured data: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: transactionSchema,
        systemInstruction: "You are a specialized accountant. Correctly map the user's input to Category, SubCategory and Currency. Example: '吃午餐 100' -> currency: TWD, amount: 100. 'Ramen 1500yen' -> currency: JPY, amount: 1500.",
      },
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
  } catch (error) {
    console.error("AI Parsing Error:", error);
    return null;
  }
}
