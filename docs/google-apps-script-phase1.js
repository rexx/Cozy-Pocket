/**
 * Cozy Pocket - Google Apps Script (Phase 1)
 * - action: "create" (upsert by id)
 * - action: "get" (fetch by year for manual year sync)
 * - payload: { token, action, items?: Transaction[], year?: string }
 * - response: 200-wrapping JSON with per-item results or fetched items
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
  'readableDateTime',
  'paymentMethod',
  'tags',
  'updatedAt',
  'version',
];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ status: 'error', message: 'Missing request body' });
    }

    const body = parseRequestBody(e);
    const token = String(body.token || '').trim();
    const expectedToken = String(PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY_KEY) || '').trim();

    if (!expectedToken || !token || token !== expectedToken) {
      return json({ status: 'unauthorized' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (body.action === 'create') {
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) {
        return json({ status: 'error', message: 'items is required and must be a non-empty array' });
      }

      const results = processCreateItems(ss, items);
      return json({ status: 'success', results: results });
    }

    if (body.action === 'get') {
      const year = String(body.year || '').trim();
      if (!year) {
        return json({ status: 'error', message: 'year is required for action=get' });
      }

      return json({ status: 'success', year: year, items: processGetItems(ss, year) });
    }

    return json({ status: 'error', message: 'Invalid action. Supported actions: create, get.' });
  } catch (err) {
    return json({ status: 'error', message: String(err && err.message ? err.message : err) });
  }
}

function parseRequestBody(e) {
  const raw = String((e && e.postData && e.postData.contents) || '').trim();
  if (!raw) return {};

  // Supports both:
  // 1) application/json raw body
  // 2) application/x-www-form-urlencoded with payload=<json>
  const formPayload = e && e.parameter && typeof e.parameter.payload === 'string'
    ? e.parameter.payload
    : '';

  if (formPayload) {
    return JSON.parse(formPayload);
  }

  return JSON.parse(raw);
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
          recordMap: loadRecordMap(sheet),
          rowsToAppend: [],
          rowsToUpdate: [],
          appendItemIds: [],
          updateItemIds: [],
        };
      }

      const state = yearState[year];
      const incomingTimestamp = normalizeEpochSeconds(item.timestamp);
      const incomingUpdatedAt = toNumber(item.updatedAt, incomingTimestamp > 0 ? incomingTimestamp * 1000 : Date.now());
      const incomingVersion = toNumber(item.version, 1);
      const incomingReadableDateTime = String(item.readableDateTime || formatReadableDateTime(incomingTimestamp));

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
        incomingTimestamp,
        incomingReadableDateTime,
        String(item.paymentMethod || ''),
        String(item.tags || ''),
        incomingUpdatedAt,
        incomingVersion,
      ];

      const existing = state.recordMap[id];
      if (!existing) {
        state.rowsToAppend.push(row);
        state.appendItemIds.push(id);
        state.recordMap[id] = {
          row: -1,
          appendIndex: state.rowsToAppend.length - 1,
          version: incomingVersion,
          updatedAt: incomingUpdatedAt,
        };
        results.push({ id: id, status: 'success', message: 'Inserted' });
        continue;
      }

      const decision = resolveSyncDecision(existing, incomingVersion, incomingUpdatedAt);

      if (decision === 'update') {
        if (existing.row > 1) {
          state.rowsToUpdate.push({ row: existing.row, values: row });
          state.updateItemIds.push(id);
        } else if (typeof existing.appendIndex === 'number') {
          state.rowsToAppend[existing.appendIndex] = row;
        }
        state.recordMap[id] = {
          row: existing.row,
          appendIndex: existing.appendIndex,
          version: incomingVersion,
          updatedAt: incomingUpdatedAt,
        };
        results.push({ id: id, status: 'success', message: 'Updated' });
      } else if (decision === 'conflict') {
        results.push({ id: id, status: 'error', message: 'Conflict: stale version' });
      } else {
        results.push({ id: id, status: 'skipped', message: 'Already up-to-date' });
      }
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

    try {
      state.rowsToUpdate.forEach(function (entry) {
        state.sheet.getRange(entry.row, 1, 1, SHEET_HEADERS.length).setValues([entry.values]);
      });
    } catch (err) {
      markBatchFailure(results, state.updateItemIds, 'Update failed', year, err);
    }

    if (!state.rowsToAppend.length) return;

    try {
      const startRow = state.sheet.getLastRow() + 1;
      const range = state.sheet.getRange(startRow, 1, state.rowsToAppend.length, SHEET_HEADERS.length);
      range.setValues(state.rowsToAppend);
    } catch (err) {
      markBatchFailure(results, state.appendItemIds, 'Append failed', year, err);
    }
  });

  return results;
}

function markBatchFailure(results, ids, action, year, err) {
  const errMessage = String(err && err.message ? err.message : err);
  const message = action + ' for sheet ' + year + ': ' + errMessage;

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    for (let j = results.length - 1; j >= 0; j--) {
      if (results[j].id === id) {
        results[j] = { id: id, status: 'error', message: message };
        break;
      }
    }
  }
}

function deriveYear(item) {
  const ts = normalizeEpochSeconds(item.timestamp);
  if (ts > 0 && isFinite(ts)) {
    return String(new Date(ts * 1000).getFullYear());
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
  } else {
    const headerValues = sheet.getRange(1, 1, 1, SHEET_HEADERS.length).getValues()[0];
    for (let i = 0; i < SHEET_HEADERS.length; i++) {
      if (String(headerValues[i] || '').trim() !== SHEET_HEADERS[i]) {
        sheet.getRange(1, i + 1).setValue(SHEET_HEADERS[i]);
      }
    }
  }
  return sheet;
}

function loadRecordMap(sheet) {
  const map = {};
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return map;

  const values = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length).getValues();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const id = String(row[0] || '').trim();
    if (!id) continue;
    map[id] = {
      row: i + 2,
      appendIndex: -1,
      updatedAt: toNumber(row[13], 0),
      version: toNumber(row[14], 0),
    };
  }
  return map;
}

function processGetItems(ss, year) {
  const sheet = ss.getSheetByName(year);
  if (!sheet || sheet.getLastRow() <= 1) {
    return [];
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, SHEET_HEADERS.length).getValues();
  return values.map(function (row) {
    return {
      id: String(row[0] || '').trim(),
      type: String(row[1] || ''),
      amount: Number(row[2] || 0),
      currency: String(row[3] || ''),
      categoryId: String(row[4] || ''),
      subCategoryId: String(row[5] || ''),
      name: String(row[6] || ''),
      merchant: String(row[7] || ''),
      note: String(row[8] || ''),
      timestamp: toNumber(row[9], 0),
      readableDateTime: String(row[10] || ''),
      paymentMethod: String(row[11] || ''),
      tags: String(row[12] || ''),
      updatedAt: toNumber(row[13], 0),
      version: toNumber(row[14], 1),
    };
  }).filter(function (item) {
    return item.id;
  });
}

function resolveSyncDecision(existing, incomingVersion, incomingUpdatedAt) {
  if (incomingVersion > existing.version) return 'update';
  if (incomingVersion < existing.version) return 'conflict';

  if (incomingUpdatedAt > existing.updatedAt) return 'update';
  if (incomingUpdatedAt < existing.updatedAt) return 'conflict';
  return 'skip';
}

function toNumber(value, fallback) {
  const num = Number(value);
  return isFinite(num) ? num : fallback;
}

function normalizeEpochSeconds(value) {
  const num = Number(value || 0);
  if (!isFinite(num) || num <= 0) return 0;
  return num >= 1000000000000 ? Math.floor(num / 1000) : Math.floor(num);
}

function formatReadableDateTime(epochSeconds) {
  if (!epochSeconds) return '';
  const d = new Date(epochSeconds * 1000);
  return [
    d.getFullYear(),
    '-',
    pad2(d.getMonth() + 1),
    '-',
    pad2(d.getDate()),
    ' ',
    pad2(d.getHours()),
    ':',
    pad2(d.getMinutes()),
  ].join('');
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function json(obj) {
  // 200-wrapping: always return HTTP 200 with status in JSON body.
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
