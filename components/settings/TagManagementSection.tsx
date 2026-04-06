import React from 'react';
import { PencilLine, Tags } from 'lucide-react';
import { Transaction } from '../../types';
import { TagRenamePreview, TagUsageSummary } from '../../services/tagService';
import TransactionItem from '../TransactionItem';
import SettingsSection, {
  sectionCyanButtonClassName,
  sectionEmeraldButtonClassName,
  sectionInputClassName,
  sectionLabelClassName,
  sectionPanelClassName,
} from './SettingsSection';

interface TagManagementSectionProps {
  tagSummaries: TagUsageSummary[];
  selectedTagToRename: string;
  renamedTagInput: string;
  tagRenamePreview: TagRenamePreview | null;
  tagTransactions: Transaction[];
  isTagPreviewLoading: boolean;
  isTagRenameSubmitting: boolean;
  isTagTransactionsLoading: boolean;
  onSelectTagToRename: (tag: string) => void;
  onRenamedTagInputChange: (value: string) => void;
  onPreviewTagRename: () => void;
  onRenameTag: () => void;
  onTagTransactionClick: (transaction: Transaction) => void;
}

const TagManagementSection: React.FC<TagManagementSectionProps> = ({
  tagSummaries,
  selectedTagToRename,
  renamedTagInput,
  tagRenamePreview,
  tagTransactions,
  isTagPreviewLoading,
  isTagRenameSubmitting,
  isTagTransactionsLoading,
  onSelectTagToRename,
  onRenamedTagInputChange,
  onPreviewTagRename,
  onRenameTag,
  onTagTransactionClick,
}) => {
  return (
    <SettingsSection
      title="Tag 管理"
      description="更名既有 tag，預覽受影響筆數，並檢查相關交易內容。"
      icon={Tags}
      accentClassName="border-cyan-400/20 bg-cyan-500/12 text-cyan-200"
    >
      {tagSummaries.length === 0 ? (
        <div className={`${sectionPanelClassName} text-sm text-slate-400`}>目前還沒有可管理的 tag。</div>
      ) : (
        <>
          <div className={sectionPanelClassName}>
            <p className={`${sectionLabelClassName} mb-3`}>Select Tag</p>
            <div className="flex flex-wrap gap-2">
              {tagSummaries.map(({ tag, count }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onSelectTagToRename(tag)}
                  className={`rounded-full border px-3 py-2 text-xs font-black transition-colors ${
                    selectedTagToRename === tag
                      ? 'border-cyan-400/25 bg-cyan-500/12 text-cyan-100'
                      : 'border-white/10 bg-[#0f1321] text-slate-300 hover:text-white'
                  }`}
                >
                  #{tag} · {count} 筆
                </button>
              ))}
            </div>
          </div>

          {selectedTagToRename ? (
            <div className={`${sectionPanelClassName} space-y-4`}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className={sectionLabelClassName}>Current Tag</label>
                  <div className="rounded-2xl border border-white/10 bg-[#0f1321] px-3 py-3 text-sm font-bold text-white">
                    #{selectedTagToRename}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={sectionLabelClassName}>New Tag Name</label>
                  <div className="relative">
                    <PencilLine size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={renamedTagInput}
                      onChange={(e) => onRenamedTagInputChange(e.target.value)}
                      placeholder="輸入新的 tag 名稱"
                      className={`${sectionInputClassName} pl-10`}
                      disabled={isTagPreviewLoading || isTagRenameSubmitting}
                    />
                  </div>
                </div>
              </div>

              {tagRenamePreview && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-slate-200">
                  <p className="font-black text-amber-300">更名預覽</p>
                  <p className="mt-1">#{tagRenamePreview.oldTag} → #{tagRenamePreview.newTag}</p>
                  <p className="mt-1 text-emerald-300">預計影響：{tagRenamePreview.affectedCount} 筆交易</p>
                  {tagRenamePreview.conflictsWithExistingTag && (
                    <p className="mt-1 text-amber-200">提醒：新名稱已存在；確認後會合併為同一個 tag，並自動去除重複 tag。</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={onPreviewTagRename}
                  disabled={!renamedTagInput.trim() || isTagPreviewLoading || isTagRenameSubmitting}
                  className={sectionCyanButtonClassName}
                >
                  {isTagPreviewLoading ? '預覽中...' : '預覽影響筆數'}
                </button>
                <button
                  type="button"
                  onClick={onRenameTag}
                  disabled={!tagRenamePreview || tagRenamePreview.affectedCount === 0 || isTagPreviewLoading || isTagRenameSubmitting}
                  className={sectionEmeraldButtonClassName}
                >
                  {isTagRenameSubmitting ? '更名中...' : '確認更名'}
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className={sectionLabelClassName}>Related Transactions</p>
                  <span className="text-xs font-bold text-slate-400">
                    #{selectedTagToRename} · {tagTransactions.length} 筆
                  </span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f1321]">
                  {isTagTransactionsLoading ? (
                    <div className="px-4 py-6 text-center text-sm text-slate-400">載入中...</div>
                  ) : tagTransactions.length > 0 ? (
                    tagTransactions.map((tx) => (
                      <TransactionItem
                        key={tx.id}
                        transaction={tx}
                        onClick={onTagTransactionClick}
                        showDateTime
                      />
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-slate-400">目前沒有符合這個 tag 的交易。</div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </SettingsSection>
  );
};

export default TagManagementSection;
