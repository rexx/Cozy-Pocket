import React from 'react';
import { CheckCircle2, CloudUpload, Eye, LoaderCircle, PencilLine } from 'lucide-react';
import { PaymentMethodDisplayMode, Transaction } from '../../types';
import { TagRenamePreview, TagUsageSummary } from '../../services/tagService';
import TransactionItem from '../TransactionItem';
import SettingsSection, {
  sectionCyanButtonClassName,
  sectionEmeraldButtonClassName,
  sectionInputClassName,
  sectionLabelClassName,
  sectionPanelClassName,
} from './SettingsSection';
import type { SettingsStatus, SettingsStatusAction } from './settingsStatus';

type TagFeedbackTone = 'error' | 'success' | 'warning';

const tagFeedbackCardClassName: Record<TagFeedbackTone, string> = {
  error: 'border-red-500/20 bg-red-500/10 text-red-200',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-400/20 bg-amber-500/10 text-slate-200',
};

const tagFeedbackTitleClassName: Record<TagFeedbackTone, string> = {
  error: 'text-red-200',
  success: 'text-emerald-200',
  warning: 'text-amber-300',
};

const tagFeedbackActionClassName: Record<TagFeedbackTone, string> = {
  error: 'border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/25',
  success: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25',
  warning: 'border-amber-400/30 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25',
};

const TagFeedbackCard: React.FC<{
  children: React.ReactNode;
  title?: string;
  tone: TagFeedbackTone;
  action?: SettingsStatusAction;
}> = ({ children, title, tone, action }) => (
  <div className={`rounded-2xl border px-4 py-3 text-xs ${tagFeedbackCardClassName[tone]}`}>
    {title && <p className={`font-black ${tagFeedbackTitleClassName[tone]}`}>{title}</p>}
    <div className={title ? 'mt-1 space-y-1' : 'space-y-1'}>
      {children}
    </div>
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-xs font-black transition-colors sm:w-auto ${tagFeedbackActionClassName[tone]}`}
      >
        <CloudUpload size={14} />
        {action.label}
      </button>
    )}
  </div>
);

interface TagManagementSectionProps {
  status: SettingsStatus;
  tagSummaries: TagUsageSummary[];
  selectedTagToRename: string;
  renamedTagInput: string;
  tagRenamePreview: TagRenamePreview | null;
  tagTransactions: Transaction[];
  paymentMethodDisplayMode: PaymentMethodDisplayMode;
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
  status,
  tagSummaries,
  selectedTagToRename,
  renamedTagInput,
  tagRenamePreview,
  tagTransactions,
  paymentMethodDisplayMode,
  isTagPreviewLoading,
  isTagRenameSubmitting,
  isTagTransactionsLoading,
  onSelectTagToRename,
  onRenamedTagInputChange,
  onPreviewTagRename,
  onRenameTag,
  onTagTransactionClick,
}) => {
  const isPreviewDisabled = !renamedTagInput.trim() || isTagPreviewLoading || isTagRenameSubmitting;

  const statusMessage = status.type !== 'idle' ? (
    <TagFeedbackCard tone={status.type} action={status.action}>
      <p className="text-sm font-bold whitespace-pre-line">{status.message}</p>
    </TagFeedbackCard>
  ) : null;
  const renameFeedbackMessage = !tagRenamePreview && status.type !== 'idle' ? statusMessage : null;
  const resultStatusMessage = !selectedTagToRename && status.type !== 'idle' ? statusMessage : null;

  return (
    <SettingsSection>
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

          {resultStatusMessage}

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

              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={onPreviewTagRename}
                  disabled={isPreviewDisabled}
                  className={sectionCyanButtonClassName}
                >
                  <Eye size={16} />
                  {isTagPreviewLoading ? '預覽中...' : '預覽影響筆數'}
                </button>
              </div>

              {tagRenamePreview && (
                <TagFeedbackCard title="更名預覽" tone="warning">
                  <p>#{tagRenamePreview.oldTag} → #{tagRenamePreview.newTag}</p>
                  <p className="text-emerald-300">預計影響：{tagRenamePreview.affectedCount} 筆交易</p>
                  {tagRenamePreview.conflictsWithExistingTag && (
                    <p className="text-amber-200">
                      提醒：#{tagRenamePreview.newTag} 已存在；確認後會合併為同一個 tag，並自動去除重複 tag。
                    </p>
                  )}
                </TagFeedbackCard>
              )}
              {renameFeedbackMessage}

              {tagRenamePreview && (
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={onRenameTag}
                    disabled={tagRenamePreview.affectedCount === 0 || isTagPreviewLoading || isTagRenameSubmitting}
                    className={sectionEmeraldButtonClassName}
                  >
                    {isTagRenameSubmitting ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    {isTagRenameSubmitting ? '更名中...' : '確認更名'}
                  </button>
                </div>
              )}

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
                        paymentMethodDisplayMode={paymentMethodDisplayMode}
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
