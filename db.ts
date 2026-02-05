
import Dexie from 'dexie';
import type { Table } from 'dexie';
import { Transaction } from './types';

export interface AppSetting {
  key: string;
  value: any;
}

export class CozyPocketDB extends Dexie {
  transactions!: Table<Transaction>;
  settings!: Table<AppSetting>;

  constructor() {
    super('CozyPocketDB');
    this.version(1).stores({
      transactions: '++id, timestamp, categoryId, type, currency',
      settings: 'key'
    });
  }
}

export const db = new CozyPocketDB();
