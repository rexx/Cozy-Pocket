// Pure string-level CSV handling shared by the import and export paths.
// No db and no DOM access lives here.

export const CSV_HEADERS = ["id", "type", "amount", "currency", "categoryId", "subCategoryId", "name", "merchant", "note", "timestamp", "readableDateTime", "paymentMethod", "tags", "updatedAt", "version"];

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
