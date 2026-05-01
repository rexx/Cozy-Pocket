
import Dexie from 'dexie';
import type { Table } from 'dexie';
import { PullReport, Transaction } from './types';

export interface AppSetting {
  key: string;
  value: any;
}

export class CozyPocketDB extends Dexie {
  transactions!: Table<Transaction>;
  settings!: Table<AppSetting>;
  pullReports!: Table<PullReport>;

  constructor() {
    super('CozyPocketDB');
    this.version(1).stores({
      transactions: '++id, timestamp, categoryId, type, currency',
      settings: 'key'
    });
    this.version(2).stores({
      transactions: '++id, timestamp, categoryId, type, currency',
      settings: 'key',
      pullReports: 'id, createdAt, year, status',
    });
  }
}

export const db = new CozyPocketDB();
