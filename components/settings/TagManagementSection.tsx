import React, { useEffect, useState } from 'react';
import { CheckCircle2, CloudUpload, Eye, LoaderCircle, PencilLine } from 'lucide-react';
import { PaymentMethodDisplayMode, Transaction } from '../../types';
import { TagRenamePreview, TagUsageSummary, normalizeTag } from '../../services/tagService';
import TransactionItem from '../TransactionItem';
import SettingsSection, {
  sectionCyanButtonClassName,
  sectionEmeraldButtonClassName,
  sectionInputClassName,
  sectionLabelClassName,
  sectionPanelClassName,
} from './SettingsSection';
import { idleStatus, type SettingsStatus, type SettingsStatusAction } from './settingsStatus';

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
  tagSummaries: TagUsageSummary[];
  paymentMethodDisplayMode: PaymentMethodDisplayMode;
  onPreviewTagRename: (oldTag: string, newTag: string) => Promise<TagRenamePreview>;
  onRenameTag: (oldTag: string, newTag: string) => Promise<TagRenamePreview & { skippedOffline: boolean; syncResult?: { total: number; failed: number; skippedOffline: boolean } }>;
  onGetTagTransactions: (tag: string) => Promise<Transaction[]>;
  onTagTransactionClick: (transaction: Transaction) => void;
  onDataChange: () => void;
  onOpenSyncProgress: () => void;
}

const TagManagementSection: React.FC<TagManagementSectionProps> = ({
  tagSummaries,
  paymentMethodDisplayMode,
  onPreviewTagRename,
  onRenameTag,
  onGetTagTransactions,
  onTagTransactionClick,
  onDataChange,
  onOpenSyncProgress,
}) => {
  const [status, setStatus] = useState<SettingsStatus>(idleStatus);
  const [selectedTagToRename, setSelectedTagToRename] = useState('');
  const [renamedTagInput, setRenamedTagInput] = useState('');
  const [tagRenamePreview, setTagRenamePreview] = useState<TagRenamePreview | null>(null);
  const [isTagPreviewLoading, setIsTagPreviewLoading] = useState(false);
  const [isTagRenameSubmitting, setIsTagRenameSubmitting] = useState(false);
  const [tagTransactions, setTagTransactions] = useState<Transaction[]>([]);
  const [isTagTransactionsLoading, setIsTagTransactionsLoading] = useState(false);
  const openSyncProgressAction: SettingsStatusAction = { label: '查看同步狀態', onClick: onOpenSyncProgress };
  const isPreviewDisabled = !renamedTagInput.trim() || isTagPreviewLoading || isTagRenameSubmitting;

  useEffect(() => {
    if (!selectedTagToRename) return;
    const normalizedSelectedTag = normalizeTag(selectedTagToRename);
    const hasSelectedTag = tagSummaries.some(({ tag }) => tag === normalizedSelectedTag);
    if (!hasSelectedTag) {
      setSelectedTagToRename('');
      setRenamedTagInput('');
      setTagRenamePreview(null);
      setTagTransactions([]);
    }
  }, [selectedTagToRename, tagSummaries]);

  useEffect(() => {
    if (!selectedTagToRename) {
      setTagTransactions([]);
      setIsTagTransactionsLoading(false);
      return;
    }

    let isMounted = true;

    const loadTagTransactions = async () => {
      try {
        setIsTagTransactionsLoading(true);
        const results = await onGetTagTransactions(selectedTagToRename);
        if (!isMounted) return;
        setTagTransactions(results);
      } catch (err: any) {
        if (!isMounted) return;
        setTagTransactions([]);
        setStatus({ type: 'error', message: err.message || '讀取 tag 項目失敗' });
      } finally {
        if (isMounted) {
          setIsTagTransactionsLoading(false);
        }
      }
    };

    void loadTagTransactions();

    return () => {
      isMounted = false;
    };
  }, [onGetTagTransactions, selectedTagToRename]);

  const resetTagRenameState = (nextSelectedTag = '') => {
    const currentTagKey = normalizeTag(selectedTagToRename);
    const nextTagKey = normalizeTag(nextSelectedTag);
    const willSwitchTag = currentTagKey !== nextTagKey;

    setSelectedTagToRename(nextSelectedTag);
    setRenamedTagInput('');
    setTagRenamePreview(null);
    setIsTagPreviewLoading(false);
    setIsTagRenameSubmitting(false);
    if (!nextSelectedTag || willSwitchTag) {
      setTagTransactions([]);
      setIsTagTransactionsLoading(Boolean(nextSelectedTag));
    }
  };

  const handleSelectTagToRename = (tag: string) => {
    setStatus({ type: 'idle', message: '' });
    resetTagRenameState(tag);
  };

  const handleRenamedTagInputChange = (value: string) => {
    setRenamedTagInput(value);
    setTagRenamePreview(null);
  };

  const handlePreviewTagRename = async () => {
    try {
      setIsTagPreviewLoading(true);
      setStatus({ type: 'idle', message: '' });
      const preview = await onPreviewTagRename(selectedTagToRename, renamedTagInput);
      setTagRenamePreview(preview);
      if (preview.affectedCount === 0) {
        setStatus({ type: 'error', message: '預覽結果為 0 筆，無法執行更名' });
      } else if (preview.conflictsWithExistingTag) {
        setStatus({ type: 'success', message: `提醒：#${preview.newTag} 已存在，執行後會合併 tag 並自動去重` });
      }
    } catch (err: any) {
      setTagRenamePreview(null);
      setStatus({ type: 'error', message: err.message || 'Tag 預覽失敗' });
    } finally {
      setIsTagPreviewLoading(false);
    }
  };

  const handleRenameTag = async () => {
    if (!tagRenamePreview || tagRenamePreview.affectedCount === 0) {
      setStatus({ type: 'error', message: '請先預覽受影響筆數後再執行更名' });
      return;
    }

    try {
      setIsTagRenameSubmitting(true);
      setStatus({ type: 'idle', message: '' });
      const result = await onRenameTag(selectedTagToRename, renamedTagInput);
      await onDataChange();
      resetTagRenameState(result.newTag);
      const renameSummary = `已將 #${result.oldTag} 更名為 #${result.newTag}`;

      if (result.skippedOffline) {
        setStatus({
          type: 'success',
          message: `${renameSummary}，共更新 ${result.affectedCount} 筆\n目前離線，待恢復連線後同步`,
        });
        return;
      }

      if (result.syncResult && result.syncResult.failed > 0) {
        setStatus({
          type: 'error',
          message: `${renameSummary}，共更新 ${result.affectedCount} 筆\n同步失敗 ${result.syncResult.failed}/${result.syncResult.total} 筆`,
          action: openSyncProgressAction,
        });
        return;
      }

      setStatus({
        type: 'success',
        message: `${renameSummary}，共更新 ${result.affectedCount} 筆`,
      });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Tag 更名失敗' });
    } finally {
      setIsTagRenameSubmitting(false);
    }
  };

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
                  onClick={() => handleSelectTagToRename(tag)}
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
                      onChange={(e) => handleRenamedTagInputChange(e.target.value)}
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
                  onClick={() => void handlePreviewTagRename()}
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
                    onClick={() => void handleRenameTag()}
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
