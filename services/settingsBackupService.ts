import { format } from 'date-fns';
import { db, type AppSetting } from '../db';
import { PullReport } from '../types';
import { GEMINI_API_KEY_SETTING_KEY } from '../preferences';

export const SETTINGS_BACKUP_SCHEMA_VERSION = 1;

export const SYNC_TOKEN_SETTING_KEY = 'syncToken';
export const SYNC_API_URL_SETTING_KEY = 'syncApiUrl';

export interface SettingsBackupOptions {
  includeGeminiApiKey: boolean;
  includeSyncToken: boolean;
  includePullReports: boolean;
}

export interface SettingsBackupFile {
  schemaVersion: number;
  exportedAt: string;
  dbVersion: number;
  settings: AppSetting[];
  pullReports?: PullReport[];
}

export interface SettingsBackupPreview {
  exportedAt: string;
  schemaVersion: number;
  settingKeys: string[];
  pullReportCount: number;
  includesGeminiApiKey: boolean;
  includesSyncCredentials: boolean;
  skippedEntryCount: number;
}

export interface SettingsBackupRestoreResult {
  settingCount: number;
  pullReportCount: number;
}

const downloadJsonFile = (fileName: string, content: string): void => {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const buildSettingsBackup = async (
  options: SettingsBackupOptions
): Promise<SettingsBackupFile> => {
  const storedSettings = await db.settings.toArray();
  const excludedKeys = new Set<string>();
  if (!options.includeGeminiApiKey) excludedKeys.add(GEMINI_API_KEY_SETTING_KEY);
  if (!options.includeSyncToken) excludedKeys.add(SYNC_TOKEN_SETTING_KEY);

  // The whole settings table is dumped rather than a key allowlist, so a
  // preference added later is backed up without anyone remembering to update
  // this file.
  const backup: SettingsBackupFile = {
    schemaVersion: SETTINGS_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    dbVersion: db.verno,
    settings: storedSettings.filter((setting) => !excludedKeys.has(setting.key)),
  };

  if (options.includePullReports) {
    backup.pullReports = await db.pullReports.toArray();
  }

  return backup;
};

export const exportSettingsBackup = async (options: SettingsBackupOptions): Promise<void> => {
  const backup = await buildSettingsBackup(options);
  const fileName = `cozy_pocket_settings_${format(new Date(), 'yyyyMMdd')}.json`;
  downloadJsonFile(fileName, JSON.stringify(backup, null, 2));
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const sanitizeSettings = (raw: unknown): { settings: AppSetting[]; skipped: number } => {
  if (!Array.isArray(raw)) return { settings: [], skipped: 0 };
  const settings: AppSetting[] = [];
  let skipped = 0;
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.key !== 'string' || !entry.key.trim() || !('value' in entry)) {
      skipped++;
      continue;
    }
    settings.push({ key: entry.key, value: entry.value });
  }
  return { settings, skipped };
};

const sanitizePullReports = (raw: unknown): { reports: PullReport[]; skipped: number } => {
  if (raw === undefined) return { reports: [], skipped: 0 };
  if (!Array.isArray(raw)) return { reports: [], skipped: 0 };
  const reports: PullReport[] = [];
  let skipped = 0;
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim()) {
      skipped++;
      continue;
    }
    reports.push(entry as unknown as PullReport);
  }
  return { reports, skipped };
};

export const parseSettingsBackup = (
  raw: unknown
): { backup: SettingsBackupFile; preview: SettingsBackupPreview } => {
  if (!isRecord(raw) || typeof raw.schemaVersion !== 'number') {
    throw new Error('這不是 Cozy Pocket 的設定備份檔');
  }
  if (raw.schemaVersion > SETTINGS_BACKUP_SCHEMA_VERSION) {
    throw new Error(`備份檔版本 (${raw.schemaVersion}) 比目前 App 支援的版本 (${SETTINGS_BACKUP_SCHEMA_VERSION}) 新，請先更新 App`);
  }

  const { settings, skipped: skippedSettings } = sanitizeSettings(raw.settings);
  const { reports, skipped: skippedReports } = sanitizePullReports(raw.pullReports);

  if (settings.length === 0 && reports.length === 0) {
    throw new Error('備份檔內沒有可還原的設定');
  }

  const settingKeys = settings.map((setting) => setting.key);
  const backup: SettingsBackupFile = {
    schemaVersion: raw.schemaVersion,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    dbVersion: typeof raw.dbVersion === 'number' ? raw.dbVersion : 0,
    settings,
    ...(reports.length > 0 ? { pullReports: reports } : {}),
  };

  const preview: SettingsBackupPreview = {
    exportedAt: backup.exportedAt,
    schemaVersion: backup.schemaVersion,
    settingKeys,
    pullReportCount: reports.length,
    includesGeminiApiKey: settingKeys.includes(GEMINI_API_KEY_SETTING_KEY),
    includesSyncCredentials: settingKeys.includes(SYNC_TOKEN_SETTING_KEY) || settingKeys.includes(SYNC_API_URL_SETTING_KEY),
    skippedEntryCount: skippedSettings + skippedReports,
  };

  return { backup, preview };
};

export const parseSettingsBackupFile = async (
  file: File
): Promise<{ backup: SettingsBackupFile; preview: SettingsBackupPreview }> => {
  const text = await file.text();
  if (!text.trim()) throw new Error('檔案內容為空');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('檔案不是有效的 JSON');
  }
  return parseSettingsBackup(raw);
};

// Restore merges rather than replaces: keys absent from the file keep their
// current values, so a backup exported without the API key cannot silently
// wipe the key already set on this install.
export const restoreSettingsBackup = async (
  backup: SettingsBackupFile
): Promise<SettingsBackupRestoreResult> => {
  if (backup.settings.length > 0) {
    await db.settings.bulkPut(backup.settings);
  }

  const pullReports = backup.pullReports ?? [];
  if (pullReports.length > 0) {
    await db.pullReports.bulkPut(pullReports);
  }

  return {
    settingCount: backup.settings.length,
    pullReportCount: pullReports.length,
  };
};
