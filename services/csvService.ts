// CSV handling shared by the import and export paths: row splitting, the
// row <-> Transaction mapping, and the export download.
// No db access lives here; matching ids against the stored table stays with
// the caller.

import { Transaction } from '../types';
import { formatReadableDateTime, toEpochSeconds } from '../time';

export const CSV_HEADERS = ["id", "type", "amount", "currency", "categoryId", "subCategoryId", "name", "merchant", "note", "timestamp", "readableDateTime", "paymentMethod", "tags", "updatedAt", "version"];

// What the import flow shows the user before committing. Everything except
// duplicateWithExistingCount comes straight out of parseTransactionsFromCSV.
export interface ImportPreview {
  transactions: Transaction[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateWithExistingCount: number;
  duplicateInFileCount: number;
}

export interface ParsedTransactionsCSV {
  transactions: Transaction[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateInFileCount: number;
  // Every id in the file, collapsed to one entry each, for the caller's
  // lookup against the stored table.
  uniqueIds: string[];
}

// Splits on newlines that sit outside a quoted cell, so a cell may contain
// its own line breaks. Blank rows are dropped.
export const splitCSVIntoRows = (text: string) => {
  const rows: string[] = [];
  let currentRow = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') { currentRow += '""'; i++; }
      else { inQuotes = !inQuotes; currentRow += '"'; }
    } else if (!inQuotes && (char === '\n' || char === '\r')) {
      if (currentRow.trim().length > 0) rows.push(currentRow);
      currentRow = '';
      if (char === '\r' && nextChar === '\n') i++;
    } else { currentRow += char; }
  }
  if (currentRow.trim().length > 0) rows.push(currentRow);
  return rows;
};

// Splits one row into cells, unescaping doubled quotes and stripping the
// surrounding quotes.
export const parseCSVLine = (line: string) => {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) { result.push(cur); cur = ''; }
    else { cur += char; }
  }
  result.push(cur);
  return result;
};

// Maps data rows onto Transaction objects, using the file's own header row
// when it has one. Rows whose amount or timestamp do not survive the
// conversion are dropped and only counted.
export const parseTransactionsFromCSV = (text: string): ParsedTransactionsCSV => {
  if (!text) throw new Error('檔案內容為空');
  const lines = splitCSVIntoRows(text);
  if (lines.length < 2) throw new Error('檔案格式不正確或無資料');

  const parsedHeader = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
  const headers = parsedHeader.length > 0 ? parsedHeader : CSV_HEADERS;
  const dataRows = lines.slice(1);
  const transactions: Transaction[] = dataRows.map(line => {
    const values = parseCSVLine(line);
    const obj: any = {};
    headers.forEach((header, index) => {
      const val = values[index] || '';
      if (header === 'amount') obj[header] = parseFloat(val);
      else if (header === 'timestamp') obj[header] = toEpochSeconds(parseInt(val, 10));
      else if (header === 'updatedAt' || header === 'version') obj[header] = parseInt(val, 10);
      else obj[header] = val;
    });
    if (Number.isNaN(obj.timestamp) && obj.readableDateTime) {
      obj.timestamp = toEpochSeconds(new Date(obj.readableDateTime).getTime());
    }
    if (!obj.readableDateTime && Number.isFinite(obj.timestamp)) {
      obj.readableDateTime = formatReadableDateTime(obj.timestamp);
    }
    if (!obj.currency) obj.currency = 'TWD';
    return obj as Transaction;
  }).filter(t => !isNaN(t.amount) && !isNaN(t.timestamp));

  const idCountMap = new Map<string, number>();
  for (const tx of transactions) {
    const count = idCountMap.get(tx.id) || 0;
    idCountMap.set(tx.id, count + 1);
  }

  return {
    transactions,
    totalRows: dataRows.length,
    validRows: transactions.length,
    invalidRows: dataRows.length - transactions.length,
    duplicateInFileCount: Array.from(idCountMap.values()).filter((count) => count > 1).length,
    uniqueIds: Array.from(idCountMap.keys()),
  };
};

// Quotes every cell so embedded commas, quotes and line breaks survive the
// round trip back through splitCSVIntoRows / parseCSVLine.
export const buildTransactionsCSV = (transactions: Transaction[]): string => [
  CSV_HEADERS.join(','),
  ...transactions.map(t => [
    t.id,
    t.type,
    t.amount,
    t.currency || 'TWD',
    t.categoryId,
    t.subCategoryId || '',
    t.name || '',
    t.merchant || '',
    t.note || '',
    t.timestamp,
    t.readableDateTime || formatReadableDateTime(t.timestamp),
    t.paymentMethod,
    t.tags || '',
    t.updatedAt || '',
    t.version || ''
  ].map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))
].join('\n');

// The BOM keeps Excel from reading the UTF-8 bytes as the local codepage.
export const downloadCSV = (csvContent: string, fileName: string): void => {
  const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
