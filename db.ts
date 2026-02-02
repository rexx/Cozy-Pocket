

import { Dexie } from 'dexie';
import type { Table } from 'dexie';
import { Transaction } from './types';

// Use named import for Dexie to ensure the class methods like version() are correctly inherited and recognized by TypeScript
export class CozyPocketDB extends Dexie {
  transactions!: Table<Transaction>;

  constructor() {
    super('CozyPocketDB');
    // Initialize the database version and define the schema for the transactions table
    // Fix: Accessing version method from the Dexie base class
    this.version(1).stores({
      transactions: '++id, date, categoryId, type' // Primary key and indexes
    });
  }
}

export const db = new CozyPocketDB();