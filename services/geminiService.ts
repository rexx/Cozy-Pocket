
import { GoogleGenAI, Type } from "@google/genai";

const transactionSchema = {
  type: Type.OBJECT,
  properties: {
    amount: { type: Type.NUMBER, description: "The cost/amount of the transaction" },
    type: { type: Type.STRING, description: "Either '支出' (expense) or '收入' (income)" },
    merchant: { type: Type.STRING, description: "Where the purchase was made" },
    note: { type: Type.STRING, description: "Detailed description or items bought" },
    categoryId: { 
      type: Type.STRING, 
      description: "For '支出': fixed, food, transport, daily, medical, kids, entertainment, shopping, social, other. For '收入': salary, bonus, overtime, side_hustle, investment, rent, subsidy, tax_refund, red_envelope, other_income" 
    },
    paymentMethod: { 
      type: Type.STRING, 
      description: "One of: 現金, 信用卡, 電子支付, 轉帳" 
    },
    date: { type: Type.STRING, description: "The date of transaction if found (YYYY-MM-DD), else null" }
  },
  required: ["amount", "type", "categoryId", "paymentMethod"]
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
        systemInstruction: "You are a specialized accountant. Extract transaction details. Income categories mapping: 薪資 -> salary, 獎金 -> bonus, 加班費 -> overtime, 副業 -> side_hustle, 投資 -> investment, 租金 -> rent, 補助 -> subsidy, 退稅 -> tax_refund, 紅包 -> red_envelope, 其他 -> other_income. Expense categories map to standard keys like food, transport etc.",
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
