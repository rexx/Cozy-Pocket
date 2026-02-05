
import Dexie from 'dexie';
import type { Table } from 'dexie';
import { Transaction } from './types';

/**
 * 核心規範 (CRITICAL RULE)：
 * 必須使用預設匯入：`import Dexie from 'dexie';`
 * 嚴禁使用具名匯入：`import { Dexie } from 'dexie';`
 * 這是為了確保 CozyPocketDB 能正確繼承 Dexie 的所有原型方法（如 this.version）。
 */
export class CozyPocketDB extends Dexie {
  transactions!: Table<Transaction>;

  constructor() {
    super('CozyPocketDB');
    // 定義資料庫架構
    this.version(1).stores({
      transactions: '++id, timestamp, categoryId, type'
    });
  }
}

export const db = new CozyPocketDB();
