
import { Dexie } from 'dexie';
import type { Table } from 'dexie';
import { Transaction } from './types';

// Use named import for Dexie to ensure the class methods are correctly inherited and recognized by TypeScript
export class CozyPocketDB extends Dexie {
  transactions!: Table<Transaction>;

  constructor() {
    super('CozyPocketDB');
    // Ensure the database schema is defined using the version method inherited from Dexie
    this.version(1).stores({
      transactions: '++id, date, categoryId, type' // Primary key and indexes
    });
  }
}

export const db = new CozyPocketDB();
