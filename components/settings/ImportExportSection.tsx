import React from 'react';
import { ArrowUpDown, Database, Download, Upload } from 'lucide-react';
import { Transaction } from '../../types';
import SettingsSection, {
  sectionAmberButtonClassName,
  sectionCyanButtonClassName,
  sectionLabelClassName,
  sectionPanelClassName,
  sectionRedButtonClassName,
  sectionSecondaryButtonClassName,
} from './SettingsSection';

interface ImportPreview {
  transactions: Transaction[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateWithExistingCount: number;
  duplicateInFileCount: number;
}

interface ImportExportSectionProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  selectedImportFileName: string;
  isParsingImportFile: boolean;
  importPreview: ImportPreview | null;
  onExportToCsv: () => void;
  onImportFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportFromPreview: (mode: 'overwrite' | 'append') => void;
}

const ImportExportSection: React.FC<ImportExportSectionProps> = ({
  fileInputRef,
  selectedImportFileName,
  isParsingImportFile,
  importPreview,
  onExportToCsv,
  onImportFileChange,
  onImportFromPreview,
}) => {
  return (
    <SettingsSection
      title="匯入匯出"
      description="匯出完整備份，或從 CSV 預覽後再附加或覆寫匯入。"
      icon={ArrowUpDown}
      accentClassName="border-amber-400/20 bg-amber-500/12 text-amber-200"
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={`${sectionPanelClassName} flex h-full flex-col`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/12 text-cyan-200">
              <Upload size={18} />
            </div>
            <div>
              <p className={sectionLabelClassName}>Export Backup</p>
              <p className="text-sm text-slate-300">將目前所有記帳紀錄匯出為 CSV。</p>
            </div>
          </div>
          <div className="mt-auto">
            <button type="button" onClick={onExportToCsv} className={`${sectionCyanButtonClassName} w-full`}>
              <Download size={16} />
              立即匯出 CSV
            </button>
          </div>
        </div>

        <div className={`${sectionPanelClassName} flex h-full flex-col space-y-4`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/12 text-amber-200">
              <Download size={18} />
            </div>
            <div>
              <p className={sectionLabelClassName}>Import From CSV</p>
              <p className="text-sm text-slate-300">選擇備份檔，先看預覽再決定如何匯入。</p>
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onImportFileChange} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${sectionSecondaryButtonClassName} w-full justify-center`}
          >
            <Database size={16} />
            {selectedImportFileName || '選擇 CSV 檔案'}
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
                onClick={() => onImportFromPreview('append')}
                className={sectionAmberButtonClassName}
              >
                附加匯入
              </button>
              <button
                type="button"
                onClick={() => onImportFromPreview('overwrite')}
                className={sectionRedButtonClassName}
              >
                覆寫匯入
              </button>
            </div>
          )}
        </div>
      </div>
    </SettingsSection>
  );
};

export default ImportExportSection;
