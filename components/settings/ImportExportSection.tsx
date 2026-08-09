import React, { useRef, useState } from 'react';
import { Download, ShieldAlert, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { Transaction } from '../../types';
import { confirmAction } from '../../services/dialogService';
import {
  exportSettingsBackup,
  parseSettingsBackupFile,
  restoreSettingsBackup,
  type SettingsBackupFile,
  type SettingsBackupOptions,
  type SettingsBackupPreview,
} from '../../services/settingsBackupService';
import SettingsSection, {
  sectionLabelClassName,
  sectionPanelClassName,
  sectionSecondaryButtonClassName,
} from './SettingsSection';
import { idleStatus, type SettingsStatus, type SettingsStatusAction } from './settingsStatus';
import { SettingsStatusCard } from './SettingsFeedbackCard';

export interface ImportPreview {
  transactions: Transaction[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateWithExistingCount: number;
  duplicateInFileCount: number;
}

export interface ImportCommitResult {
  skippedOffline: boolean;
  failed: number;
  total: number;
  overwrittenCount: number;
}

// Every option here is opt-in: the two credentials are plaintext in the
// exported file, and pull reports are sync history rather than settings.
const SETTINGS_BACKUP_OPTION_ITEMS: Array<{
  key: keyof SettingsBackupOptions;
  label: string;
  hint: string;
  isSensitive: boolean;
}> = [
  { key: 'includeGeminiApiKey', label: '包含 Gemini API key', hint: '重裝後免重新申請', isSensitive: true },
  { key: 'includeSyncToken', label: '包含同步 token', hint: '重裝後免重新輸入', isSensitive: true },
  { key: 'includePullReports', label: '包含同步紀錄', hint: '歷次雲端同步的稽核報告', isSensitive: false },
];

const DEFAULT_SETTINGS_BACKUP_OPTIONS: SettingsBackupOptions = {
  includeGeminiApiKey: false,
  includeSyncToken: false,
  includePullReports: false,
};

const formatBackupTimestamp = (isoValue: string): string => {
  if (!isoValue) return '未知時間';
  const parsed = new Date(isoValue);
  return Number.isNaN(parsed.getTime()) ? '未知時間' : format(parsed, 'yyyy-MM-dd HH:mm');
};

interface ImportExportSectionProps {
  onExportToCsv: () => Promise<void>;
  onParseImportFile: (file: File) => Promise<ImportPreview>;
  onCommitImport: (transactions: Transaction[], mode: 'overwrite' | 'append') => Promise<ImportCommitResult>;
  onOpenSyncProgress: () => void;
  onNotify: (message: string) => void;
}

const ImportExportSection: React.FC<ImportExportSectionProps> = ({
  onExportToCsv,
  onParseImportFile,
  onCommitImport,
  onOpenSyncProgress,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsFileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<SettingsStatus>(idleStatus);
  const [selectedImportFileName, setSelectedImportFileName] = useState('');
  const [isParsingImportFile, setIsParsingImportFile] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [backupOptions, setBackupOptions] = useState<SettingsBackupOptions>(DEFAULT_SETTINGS_BACKUP_OPTIONS);
  const [selectedSettingsFileName, setSelectedSettingsFileName] = useState('');
  const [isParsingSettingsFile, setIsParsingSettingsFile] = useState(false);
  const [settingsBackup, setSettingsBackup] = useState<SettingsBackupFile | null>(null);
  const [settingsPreview, setSettingsPreview] = useState<SettingsBackupPreview | null>(null);
  const openSyncProgressAction: SettingsStatusAction = { label: '查看同步狀態', onClick: onOpenSyncProgress };
  const hasSensitiveBackupOption = backupOptions.includeGeminiApiKey || backupOptions.includeSyncToken;

  const handleExportToCsv = async () => {
    try {
      await onExportToCsv();
      onNotify('匯出成功');
      setStatus(idleStatus);
    } catch (err: any) {
      setStatus({ type: 'error', message: `匯出失敗: ${err.message}` });
    }
  };

  const handleBackupOptionToggle = (key: keyof SettingsBackupOptions) => {
    setBackupOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleExportSettings = async () => {
    try {
      await exportSettingsBackup(backupOptions);
      onNotify(hasSensitiveBackupOption ? '設定已匯出，檔案含金鑰請妥善保管' : '設定已匯出');
      setStatus(idleStatus);
    } catch (err: any) {
      setStatus({ type: 'error', message: `設定匯出失敗: ${err.message}` });
    }
  };

  const resetSettingsFileSelection = () => {
    setSettingsBackup(null);
    setSettingsPreview(null);
    setSelectedSettingsFileName('');
    if (settingsFileInputRef.current) settingsFileInputRef.current.value = '';
  };

  const handleSettingsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setStatus(idleStatus);
    setSettingsBackup(null);
    setSettingsPreview(null);
    setSelectedSettingsFileName(file?.name || '');
    if (!file) return;

    try {
      setIsParsingSettingsFile(true);
      const { backup, preview } = await parseSettingsBackupFile(file);
      setSettingsBackup(backup);
      setSettingsPreview(preview);
    } catch (err: any) {
      setStatus({ type: 'error', message: `設定檔預覽失敗: ${err.message}` });
    } finally {
      setIsParsingSettingsFile(false);
    }
  };

  const handleRestoreSettings = async () => {
    if (!settingsBackup || !settingsPreview) {
      setStatus({ type: 'error', message: '請先選擇設定備份檔並完成預覽' });
      return;
    }

    const confirmLines = [
      `將以 ${formatBackupTimestamp(settingsPreview.exportedAt)} 的備份覆蓋同名設定，檔案內沒有的設定會保持不變。`,
    ];
    if (settingsPreview.includesSyncCredentials) {
      confirmLines.push('此檔含同步設定，還原後本機會改用備份中的雲端端點與 token。');
    }
    const confirmed = await confirmAction({
      title: '還原設定？',
      text: confirmLines.join('\n'),
      confirmButtonText: '確認還原',
      cancelButtonText: '取消',
      tone: settingsPreview.includesSyncCredentials ? 'danger' : 'default',
    });
    if (!confirmed) return;

    try {
      const result = await restoreSettingsBackup(settingsBackup);
      resetSettingsFileSelection();
      const summary = `已還原設定 ${result.settingCount} 項${
        result.pullReportCount > 0 ? `、同步紀錄 ${result.pullReportCount} 筆` : ''
      }`;
      // Preferences are read into React state at app boot, so the running
      // session keeps showing the pre-restore values until a reload.
      const shouldReload = await confirmAction({
        title: '設定已還原',
        text: `${summary}。需要重新載入才會套用。`,
        confirmButtonText: '立即重新載入',
        cancelButtonText: '稍後',
        icon: 'success',
      });
      if (shouldReload) {
        window.location.reload();
        return;
      }
      setStatus({ type: 'success', message: `${summary}\n重新載入 App 後才會套用` });
    } catch (err: any) {
      setStatus({ type: 'error', message: `設定還原失敗: ${err.message}` });
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setStatus(idleStatus);
    setImportPreview(null);
    setSelectedImportFileName(file?.name || '');
    if (!file) return;

    try {
      setIsParsingImportFile(true);
      const preview = await onParseImportFile(file);
      setImportPreview(preview);
      if (preview.validRows === 0) {
        setStatus({ type: 'error', message: '預覽完成，但找不到可匯入的有效交易紀錄' });
      } else {
        setStatus(idleStatus);
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: `檔案預覽失敗: ${err.message}` });
    } finally {
      setIsParsingImportFile(false);
    }
  };

  const handleImportFromPreview = async (mode: 'overwrite' | 'append') => {
    if (!importPreview || importPreview.validRows === 0) {
      setStatus({ type: 'error', message: '請先選擇可匯入的 CSV 檔案並完成預覽' });
      return;
    }

    if (mode === 'overwrite') {
      const firstConfirm = await confirmAction({
        title: '覆蓋匯入資料？',
        text: `將覆蓋目前所有資料，並匯入 ${importPreview.validRows} 筆。確定要繼續嗎？`,
        confirmButtonText: '繼續',
        cancelButtonText: '取消',
        tone: 'danger',
      });
      if (!firstConfirm) return;
      const secondConfirm = await confirmAction({
        title: '再次確認覆蓋匯入',
        text: '此操作會先清空現有資料，且無法復原。確定要「完全覆蓋」嗎？',
        confirmButtonText: '完全覆蓋',
        cancelButtonText: '取消',
        tone: 'danger',
      });
      if (!secondConfirm) return;
    }

    const hasDuplicateOverwriteRisk = (
      (mode === 'append' && importPreview.duplicateWithExistingCount > 0) ||
      importPreview.duplicateInFileCount > 0
    );
    if (hasDuplicateOverwriteRisk) {
      const duplicateConfirm = await confirmAction({
        title: '偵測到重複 ID',
        text: `既有 ${importPreview.duplicateWithExistingCount} 筆、檔案內 ${importPreview.duplicateInFileCount} 筆，這些資料會被覆蓋。確定要匯入嗎？`,
        confirmButtonText: '仍要匯入',
        cancelButtonText: '取消',
      });
      if (!duplicateConfirm) return;
    }
    const finalConfirm = await confirmAction({
      title: mode === 'overwrite' ? '執行覆寫匯入？' : '執行附加匯入？',
      text: mode === 'overwrite'
        ? `即將覆寫匯入 ${importPreview.validRows} 筆，確定執行？`
        : `即將附加匯入 ${importPreview.validRows} 筆，確定執行？`,
      confirmButtonText: '確認匯入',
      cancelButtonText: '取消',
      tone: mode === 'overwrite' ? 'danger' : 'default',
    });
    if (!finalConfirm) return;

    try {
      const { skippedOffline, failed, total, overwrittenCount } = await onCommitImport(importPreview.transactions, mode);
      const importBaseMessage = (mode === 'append' && overwrittenCount > 0)
        ? `匯入成功 (${importPreview.validRows} 筆)，其中 ${overwrittenCount} 筆同 ID 已覆蓋`
        : `匯入成功 (${importPreview.validRows} 筆)`;
      if (skippedOffline) {
        setStatus({
          type: 'success',
          message: `${importBaseMessage}\n目前離線，待恢復連線後再同步`,
        });
      } else if (failed > 0) {
        setStatus({
          type: 'error',
          message: `${importBaseMessage}\n同步失敗 ${failed}/${total} 筆`,
          action: openSyncProgressAction,
        });
      } else {
        onNotify(importBaseMessage);
        setStatus(idleStatus);
      }
      setImportPreview(null);
      setSelectedImportFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setStatus({ type: 'error', message: `匯入失敗: ${err.message}` });
    }
  };

  return (
    <SettingsSection>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={`${sectionPanelClassName} flex h-full flex-col`}>
          <div className="mb-4 space-y-1">
            <p className={sectionLabelClassName}>Export Backup</p>
            <p className="text-sm text-slate-300">將目前所有記帳紀錄匯出為 CSV。</p>
          </div>
          <div className="mt-auto">
            <button type="button" onClick={() => void handleExportToCsv()} className={`${sectionSecondaryButtonClassName} w-full`}>
              <Download size={16} />
              匯出 CSV
            </button>
          </div>
        </div>

        <div className={`${sectionPanelClassName} flex h-full flex-col space-y-4`}>
          <div className="space-y-1">
            <p className={sectionLabelClassName}>Import From CSV</p>
            <p className="text-sm text-slate-300">選擇備份檔，先看預覽再決定如何匯入。</p>
          </div>

          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => void handleImportFileChange(e)} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${sectionSecondaryButtonClassName} w-full justify-center`}
          >
            <Upload size={16} />
            {selectedImportFileName || '匯入 CSV'}
          </button>

          {isParsingImportFile && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
              解析檔案中，正在建立匯入預覽...
            </div>
          )}

          {importPreview && (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-slate-200">
              <p className="font-black text-amber-300">匯入預覽</p>
              <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                <p>資料列：{importPreview.totalRows} 行</p>
                <p className="text-emerald-300">可匯入：{importPreview.validRows} 筆</p>
                <p className="text-amber-200">重複 ID（既有資料）：{importPreview.duplicateWithExistingCount} 筆</p>
                <p className="text-amber-200">重複 ID（檔案內）：{importPreview.duplicateInFileCount} 筆</p>
              </div>
              {importPreview.invalidRows > 0 && (
                <p className="mt-1 text-red-300">略過無效資料：{importPreview.invalidRows} 筆</p>
              )}
            </div>
          )}

          {importPreview && importPreview.validRows > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleImportFromPreview('append')}
                className={sectionSecondaryButtonClassName}
              >
                <Upload size={16} />
                附加匯入
              </button>
              <button
                type="button"
                onClick={() => void handleImportFromPreview('overwrite')}
                className={sectionSecondaryButtonClassName}
              >
                <Upload size={16} />
                覆寫匯入
              </button>
            </div>
          )}
        </div>

        <div className={`${sectionPanelClassName} flex h-full flex-col space-y-4`}>
          <div className="space-y-1">
            <p className={sectionLabelClassName}>Export Settings</p>
            <p className="text-sm text-slate-300">把偏好設定匯出為 JSON，重裝 App 後可一次還原。</p>
          </div>

          <div className="space-y-2">
            {SETTINGS_BACKUP_OPTION_ITEMS.map((option) => {
              const checked = backupOptions[option.key];
              return (
                <label
                  key={option.key}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-bold transition-colors ${
                    checked
                      ? 'border-cyan-400/25 bg-cyan-500/12 text-white'
                      : 'border-white/10 bg-[#0f1321] text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleBackupOptionToggle(option.key)}
                    className="h-4 w-4 accent-cyan-400"
                  />
                  <span className="min-w-0">
                    {option.label}
                    <span className="ml-2 text-xs font-medium text-slate-500">{option.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {hasSensitiveBackupOption && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <p>匯出的檔案會含明文金鑰，請勿分享或上傳到公開空間。</p>
            </div>
          )}

          <div className="mt-auto">
            <button type="button" onClick={() => void handleExportSettings()} className={`${sectionSecondaryButtonClassName} w-full`}>
              <Download size={16} />
              匯出設定 JSON
            </button>
          </div>
        </div>

        <div className={`${sectionPanelClassName} flex h-full flex-col space-y-4`}>
          <div className="space-y-1">
            <p className={sectionLabelClassName}>Restore Settings</p>
            <p className="text-sm text-slate-300">選擇設定備份檔，先看預覽再決定是否還原。</p>
          </div>

          <input
            ref={settingsFileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleSettingsFileChange(e)}
          />
          <button
            type="button"
            onClick={() => settingsFileInputRef.current?.click()}
            className={`${sectionSecondaryButtonClassName} w-full justify-center`}
          >
            <Upload size={16} />
            {selectedSettingsFileName || '選擇設定 JSON'}
          </button>

          {isParsingSettingsFile && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
              解析檔案中，正在建立還原預覽...
            </div>
          )}

          {settingsPreview && (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-slate-200">
              <p className="font-black text-amber-300">還原預覽</p>
              <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                <p>匯出時間：{formatBackupTimestamp(settingsPreview.exportedAt)}</p>
                <p className="text-emerald-300">設定項目：{settingsPreview.settingKeys.length} 項</p>
                <p>同步紀錄：{settingsPreview.pullReportCount} 筆</p>
                <p className={settingsPreview.includesGeminiApiKey ? 'text-amber-200' : ''}>
                  Gemini API key：{settingsPreview.includesGeminiApiKey ? '包含' : '未包含'}
                </p>
                <p className={settingsPreview.includesSyncCredentials ? 'text-amber-200' : ''}>
                  同步設定：{settingsPreview.includesSyncCredentials ? '包含' : '未包含'}
                </p>
              </div>
              {settingsPreview.skippedEntryCount > 0 && (
                <p className="mt-1 text-red-300">略過無效項目：{settingsPreview.skippedEntryCount} 項</p>
              )}
            </div>
          )}

          {settingsPreview && (
            <button
              type="button"
              onClick={() => void handleRestoreSettings()}
              className={`${sectionSecondaryButtonClassName} w-full justify-center`}
            >
              <Upload size={16} />
              還原設定
            </button>
          )}
        </div>
      </div>

      <SettingsStatusCard status={status} />
    </SettingsSection>
  );
};

export default ImportExportSection;
