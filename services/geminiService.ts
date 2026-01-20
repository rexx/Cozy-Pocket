
import { GoogleGenAI, Type } from "@google/genai";

const transactionSchema = {
  type: Type.OBJECT,
  properties: {
    amount: { type: Type.NUMBER, description: "The cost/amount of the transaction" },
    merchant: { type: Type.STRING, description: "Where the purchase was made" },
    note: { type: Type.STRING, description: "Detailed description or items bought" },
    categoryId: { 
      type: Type.STRING, 
      description: "Map to one of: food, shopping, transport, entertainment, medical, housing, clothing, other" 
    },
    paymentMethod: { 
      type: Type.STRING, 
      description: "One of: 現金, 信用卡, 電子支付, 轉帳" 
    },
    date: { type: Type.STRING, description: "The date of transaction if found, else null" }
  },
  required: ["amount", "categoryId", "paymentMethod"]
};

export async function parseTransactionWithAI(text: string) {
  try {
    // ALWAYS use the API key directly from process.env.API_KEY as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse this spending record into structured data: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: transactionSchema,
        systemInstruction: "You are a specialized accountant. Extract transaction details from user input. Be precise with categories. If unknown, use 'other'.",
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
