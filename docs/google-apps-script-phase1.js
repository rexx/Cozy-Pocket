/**
 * Cozy Pocket - Google Apps Script (Phase 1)
 * - action: "create"
 * - payload: { token, action, items: Transaction[] }
 * - response: 200-wrapping JSON with per-item results
 *
 * Setup:
 * 1) Open your Google Sheet -> Extensions -> Apps Script
 * 2) Paste this file content
 * 3) Set Script Property: SYNC_TOKEN = <your token>
 * 4) Deploy Web App (Execute as: Me, Who has access: Anyone)
 */

const TOKEN_PROPERTY_KEY = 'SYNC_TOKEN';
const SHEET_HEADERS = [
  'id',
  'type',
  'amount',
  'currency',
  'categoryId',
  'subCategoryId',
  'name',
  'merchant',
  'note',
  'timestamp',
  'paymentMethod',
  'tags',
  'projectName',
];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ status: 'error', message: 'Missing request body' });
    }

    const body = JSON.parse(e.postData.contents);
    const token = String(body.token || '').trim();
    const expectedToken = String(PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY_KEY) || '').trim();

    if (!expectedToken || !token || token !== expectedToken) {
      return json({ status: 'unauthorized' });
    }

    if (body.action !== 'create') {
      return json({ status: 'error', message: 'Invalid action. Phase 1 supports only action=create.' });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return json({ status: 'error', message: 'items is required and must be a non-empty array' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const results = processCreateItems(ss, items);
    return json({ status: 'success', results: results });
  } catch (err) {
    return json({ status: 'error', message: String(err && err.message ? err.message : err) });
  }
}

function processCreateItems(ss, items) {
  const results = [];
  const yearState = {};

  for (let i = 0; i < items.length; i++) {
    const item = items[i] || {};
    const id = String(item.id || '').trim();
    if (!id) {
      results.push({ id: '', status: 'error', message: 'Missing id' });
      continue;
    }

    try {
      const year = deriveYear(item);
      if (!yearState[year]) {
        const sheet = getOrCreateYearSheet(ss, year);
        yearState[year] = {
          sheet: sheet,
          idSet: loadIdSet(sheet),
          rowsToAppend: [],
        };
      }

      const state = yearState[year];
      if (state.idSet[id]) {
        results.push({ id: id, status: 'skipped', message: 'Duplicate ID' });
        continue;
      }

      const row = [
        id,
        String(item.type || ''),
        Number(item.amount || 0),
        String(item.currency || ''),
        String(item.categoryId || ''),
        String(item.subCategoryId || ''),
        String(item.name || ''),
        String(item.merchant || ''),
        String(item.note || ''),
        Number(item.timestamp || 0),
        String(item.paymentMethod || ''),
        String(item.tags || ''),
        String(item.projectName || ''),
      ];

      state.rowsToAppend.push(row);
      state.idSet[id] = true;
      results.push({ id: id, status: 'success' });
    } catch (err) {
      results.push({
        id: id,
        status: 'error',
        message: String(err && err.message ? err.message : err),
      });
    }
  }

  // Bulk append per year tab to reduce API calls.
  Object.keys(yearState).forEach(function (year) {
    const state = yearState[year];
    if (!state.rowsToAppend.length) return;

    const startRow = state.sheet.getLastRow() + 1;
    const range = state.sheet.getRange(startRow, 1, state.rowsToAppend.length, SHEET_HEADERS.length);
    range.setValues(state.rowsToAppend);
  });

  return results;
}

function deriveYear(item) {
  const ts = Number(item.timestamp || 0);
  if (ts > 0 && isFinite(ts)) {
    return String(new Date(ts).getFullYear());
  }
  return String(new Date().getFullYear());
}

function getOrCreateYearSheet(ss, year) {
  let sheet = ss.getSheetByName(year);
  if (!sheet) {
    sheet = ss.insertSheet(year);
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
  }
  return sheet;
}

function loadIdSet(sheet) {
  const set = {};
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return set;

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    const id = String(values[i][0] || '').trim();
    if (id) set[id] = true;
  }
  return set;
}

function json(obj) {
  // 200-wrapping: always return HTTP 200 with status in JSON body.
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

