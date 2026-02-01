import { Dexie, type Table } from 'dexie';
import { Transaction } from './types';

// Use named import for Dexie to ensure TypeScript correctly recognizes the class and its inherited methods like .version()
export class CozyPocketDB extends Dexie {
  transactions!: Table<Transaction>;

  constructor() {
    super('CozyPocketDB');
    this.version(1).stores({
      transactions: '++id, date, categoryId, type' // Primary key and indexes
    });
  }
}

export const db = new CozyPocketDB();