import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, LoaderCircle, PencilLine, Trash2 } from 'lucide-react';
import { PaymentMethodDisplayMode, Transaction } from '../../types';
import { TagReplacementPreview, TagUsageSummary, normalizeTag, splitTags } from '../../services/tagService';
import TransactionItem from '../TransactionItem';
import SettingsSection, {
  sectionCyanButtonClassName,
  sectionEmeraldButtonClassName,
  sectionInputClassName,
  sectionLabelClassName,
  sectionPanelClassName,
  sectionRedButtonClassName,
} from './SettingsSection';
import { idleStatus, type SettingsStatus, type SettingsStatusAction } from './settingsStatus';
import SettingsFeedbackCard, { SettingsStatusCard } from './SettingsFeedbackCard';

type TagReplacementResult = TagReplacementPreview & {
  skippedOffline: boolean;
  syncResult?: { total: number; failed: number; skippedOffline: boolean };
};

interface TagManagementSectionProps {
  tagSummaries: TagUsageSummary[];
  paymentMethodDisplayMode: PaymentMethodDisplayMode;
  onPreviewTagReplacement: (oldTag: string, replacementTags: string[]) => Promise<TagReplacementPreview>;
  onReplaceTag: (oldTag: string, replacementTags: string[]) => Promise<TagReplacementResult>;
  onGetTagTransactions: (tag: string) => Promise<Transaction[]>;
  onTagTransactionClick: (transaction: Transaction) => void;
  onDataChange: () => void;
  onOpenSyncProgress: () => void;
  onNotify: (message: string) => void;
}

const describeReplacement = (preview: TagReplacementPreview) => {
  if (preview.operation === 'remove') {
    return `已移除 #${preview.oldTag}`;
  }
  if (preview.operation === 'rename') {
    return `已將 #${preview.oldTag} 更名為 #${preview.replacementTags[0]}`;
  }
  return `已將 #${preview.oldTag} 拆分為 ${preview.replacementTags.map((tag) => `#${tag}`).join('、')}`;
};

const previewTitle: Record<TagReplacementPreview['operation'], string> = {
  remove: '移除預覽',
  rename: '更名預覽',
  split: '拆分預覽',
};

const confirmLabel: Record<TagReplacementPreview['operation'], string> = {
  remove: '確認移除',
  rename: '確認更名',
  split: '確認拆分',
};

const submittingLabel: Record<TagReplacementPreview['operation'], string> = {
  remove: '移除中...',
  rename: '更名中...',
  split: '拆分中...',
};

const TagChipList: React.FC<{ tags: string[] }> = ({ tags }) => (
  <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
    {tags.map((tag) => (
      <span
        key={tag}
        className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-black text-white"
      >
        #{tag}
      </span>
    ))}
  </span>
);

const TagManagementSection: React.FC<TagManagementSectionProps> = ({
  tagSummaries,
  paymentMethodDisplayMode,
  onPreviewTagReplacement,
  onReplaceTag,
  onGetTagTransactions,
  onTagTransactionClick,
  onDataChange,
  onOpenSyncProgress,
  onNotify,
}) => {
  const [status, setStatus] = useState<SettingsStatus>(idleStatus);
  const [selectedTag, setSelectedTag] = useState('');
  const [replacementInput, setReplacementInput] = useState('');
  const [preview, setPreview] = useState<TagReplacementPreview | null>(null);
  const [previewLoadingFor, setPreviewLoadingFor] = useState<'replacement' | 'removal' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagTransactions, setTagTransactions] = useState<Transaction[]>([]);
  const [isTagTransactionsLoading, setIsTagTransactionsLoading] = useState(false);
  const [scrollResetToken, setScrollResetToken] = useState(0);
  const tagListPanelRef = useRef<HTMLDivElement>(null);
  const openSyncProgressAction: SettingsStatusAction = { label: '查看同步狀態', onClick: onOpenSyncProgress };
  const isBusy = previewLoadingFor !== null || isSubmitting;
  const isReplacementPreviewDisabled = !replacementInput.trim() || isBusy;
  const isRemovePreview = preview?.operation === 'remove';

  useEffect(() => {
    // The local write lands before the sync round trip finishes, which drops
    // the target tag from the summaries mid-operation. Holding the selection
    // until the handler is done keeps the in-progress button on screen instead
    // of unmounting the panel under the user.
    if (!selectedTag || isSubmitting) return;
    const normalizedSelectedTag = normalizeTag(selectedTag);
    const hasSelectedTag = tagSummaries.some(({ tag }) => tag === normalizedSelectedTag);
    if (!hasSelectedTag) {
      setSelectedTag('');
      setReplacementInput('');
      setPreview(null);
      setTagTransactions([]);
    }
  }, [isSubmitting, selectedTag, tagSummaries]);

  useEffect(() => {
    // Same reason as above: reloading against half-applied data would empty the
    // list and collapse the panel while the operation is still running.
    if (isSubmitting) return;

    if (!selectedTag) {
      setTagTransactions([]);
      setIsTagTransactionsLoading(false);
      return;
    }

    let isMounted = true;

    const loadTagTransactions = async () => {
      try {
        setIsTagTransactionsLoading(true);
        const results = await onGetTagTransactions(selectedTag);
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
  }, [isSubmitting, onGetTagTransactions, selectedTag]);

  const findScroller = () => {
    let node = tagListPanelRef.current?.parentElement ?? null;
    while (node) {
      if (/auto|scroll/.test(window.getComputedStyle(node).overflowY)) return node;
      node = node.parentElement;
    }
    return null;
  };

  // Completing an operation collapses the tag detail panel, so a view scrolled
  // deep into the transaction list ends up parked past the shortened content
  // with nothing to scroll back to. Runs as a layout effect so the content has
  // already shrunk, and toggling overflow cancels any in-flight iOS momentum
  // scroll that would otherwise carry the view straight back out of bounds.
  useLayoutEffect(() => {
    if (scrollResetToken === 0) return;

    const scroller = findScroller();
    if (!scroller) {
      window.scrollTo(0, 0);
      return;
    }

    const previousOverflowY = scroller.style.overflowY;
    scroller.style.overflowY = 'hidden';
    scroller.scrollTop = 0;

    const frame = requestAnimationFrame(() => {
      scroller.style.overflowY = previousOverflowY;
      scroller.scrollTop = 0;
    });

    return () => {
      cancelAnimationFrame(frame);
      scroller.style.overflowY = previousOverflowY;
    };
  }, [scrollResetToken]);

  const resetTagState = (nextSelectedTag = '') => {
    const currentTagKey = normalizeTag(selectedTag);
    const nextTagKey = normalizeTag(nextSelectedTag);
    const willSwitchTag = currentTagKey !== nextTagKey;

    setSelectedTag(nextSelectedTag);
    setReplacementInput('');
    setPreview(null);
    setPreviewLoadingFor(null);
    setIsSubmitting(false);
    if (!nextSelectedTag || willSwitchTag) {
      setTagTransactions([]);
      setIsTagTransactionsLoading(Boolean(nextSelectedTag));
    }
  };

  const handleSelectTag = (tag: string) => {
    setStatus({ type: 'idle', message: '' });
    resetTagState(tag);
  };

  const handleReplacementInputChange = (value: string) => {
    setReplacementInput(value);
    // The confirm button is shared, so any stale preview has to go: the text
    // on screen must always describe what confirming would actually do.
    setPreview(null);
  };

  const runPreview = async (replacementTags: string[], source: 'replacement' | 'removal') => {
    try {
      setPreviewLoadingFor(source);
      setStatus({ type: 'idle', message: '' });
      setPreview(null);
      const result = await onPreviewTagReplacement(selectedTag, replacementTags);
      setPreview(result);
      if (result.affectedCount === 0) {
        setStatus({ type: 'error', message: '預覽結果為 0 筆，無法執行' });
      }
    } catch (err: any) {
      setPreview(null);
      setStatus({ type: 'error', message: err.message || 'Tag 預覽失敗' });
    } finally {
      setPreviewLoadingFor(null);
    }
  };

  const handlePreviewReplacement = async () => {
    // An empty list is the remove intent, which only the trash control may
    // request. Input that normalizes away has to fail here instead of falling
    // through to a removal preview wearing a rename label.
    const replacementTags = splitTags(replacementInput);
    if (replacementTags.length === 0) {
      setPreview(null);
      setStatus({ type: 'error', message: '請輸入新的 tag 名稱' });
      return;
    }

    await runPreview(replacementTags, 'replacement');
  };

  const handlePreviewRemoval = async () => {
    await runPreview([], 'removal');
  };

  const handleConfirm = async () => {
    if (!preview || preview.affectedCount === 0) {
      setStatus({ type: 'error', message: '請先預覽受影響筆數後再執行' });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: 'idle', message: '' });
      const result = await onReplaceTag(selectedTag, preview.replacementTags);
      await onDataChange();
      // A rename leaves a single successor tag worth keeping selected; a split
      // or a removal has no single target left to point at.
      const isRename = result.operation === 'rename';
      resetTagState(isRename ? result.replacementTags[0] : '');
      // Every completed operation shrinks the panel and puts the result message
      // at the top, so the view goes back there regardless of which one ran.
      setScrollResetToken((token) => token + 1);
      const summary = describeReplacement(result);

      if (result.skippedOffline) {
        setStatus({
          type: 'success',
          message: `${summary}，共更新 ${result.affectedCount} 筆\n目前離線，待恢復連線後同步`,
        });
        return;
      }

      if (result.syncResult && result.syncResult.failed > 0) {
        setStatus({
          type: 'error',
          message: `${summary}，共更新 ${result.affectedCount} 筆\n同步失敗 ${result.syncResult.failed}/${result.syncResult.total} 筆`,
          action: openSyncProgressAction,
        });
        return;
      }

      if (isRename) {
        onNotify(`${summary}，共更新 ${result.affectedCount} 筆`);
        setStatus(idleStatus);
        return;
      }

      setStatus({ type: 'success', message: `${summary}，共更新 ${result.affectedCount} 筆` });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Tag 更新失敗' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusMessage = status.type !== 'idle' ? <SettingsStatusCard status={status} /> : null;
  const inlineFeedbackMessage = !preview && status.type !== 'idle' ? statusMessage : null;
  const resultStatusMessage = !selectedTag && status.type !== 'idle' ? statusMessage : null;

  return (
    <SettingsSection>
      {tagSummaries.length === 0 ? (
        <div className={`${sectionPanelClassName} text-sm text-slate-400`}>目前還沒有可管理的 tag。</div>
      ) : (
        <>
          <div ref={tagListPanelRef} className={sectionPanelClassName}>
            <p className={`${sectionLabelClassName} mb-3`}>Select Tag</p>
            <div className="flex flex-wrap gap-2">
              {tagSummaries.map(({ tag, count }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleSelectTag(tag)}
                  className={`rounded-full border px-3 py-2 text-xs font-black transition-colors ${
                    selectedTag === tag
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

          {selectedTag ? (
            <div className={`${sectionPanelClassName} space-y-4`}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className={sectionLabelClassName}>Current Tag</label>
                  <div className="rounded-2xl border border-white/10 bg-[#0f1321] px-3 py-3 text-sm font-bold text-white">
                    #{selectedTag}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={sectionLabelClassName}>New Tags</label>
                  <div className="relative">
                    <PencilLine size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={replacementInput}
                      onChange={(e) => handleReplacementInputChange(e.target.value)}
                      placeholder="輸入新的 tag，用空白分隔可拆成多個"
                      className={`${sectionInputClassName} pl-10`}
                      disabled={isBusy}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void handlePreviewReplacement()}
                  disabled={isReplacementPreviewDisabled}
                  className={`${sectionCyanButtonClassName} flex-1`}
                >
                  <Eye size={16} />
                  {previewLoadingFor === 'replacement' ? '預覽中...' : '預覽影響筆數'}
                </button>
                <button
                  type="button"
                  onClick={() => void handlePreviewRemoval()}
                  disabled={isBusy}
                  title={`移除 #${selectedTag}`}
                  aria-label={`移除 #${selectedTag}`}
                  className={`${sectionRedButtonClassName} aspect-square shrink-0 px-0`}
                >
                  {previewLoadingFor === 'removal' ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>

              {preview && (
                <SettingsFeedbackCard
                  title={previewTitle[preview.operation]}
                  tone={isRemovePreview ? 'error' : 'warning'}
                >
                  {isRemovePreview ? (
                    <p>#{preview.oldTag} → 從交易上移除</p>
                  ) : (
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span>#{preview.oldTag} →</span>
                      <TagChipList tags={preview.replacementTags} />
                    </p>
                  )}
                  {preview.operation === 'split' && (
                    <p>拆分後為 {preview.replacementTags.length} 個獨立 tag，可各自查詢與彙整。</p>
                  )}
                  <p className={isRemovePreview ? undefined : 'text-emerald-300'}>
                    預計影響：{preview.affectedCount} 筆交易
                  </p>
                  {isRemovePreview && (
                    <>
                      <p>移除後沒有任何 tag：{preview.willBecomeUntaggedCount} 筆</p>
                      <p>只移除 tag，不會刪除交易。</p>
                    </>
                  )}
                  {preview.existingReplacementTags.length > 0 && (
                    <p className="flex flex-wrap items-center gap-1.5 text-amber-200">
                      <span>提醒：</span>
                      <TagChipList tags={preview.existingReplacementTags} />
                      <span>已存在；確認後會合併為同一個 tag，每筆交易會自動去除重複 tag。</span>
                    </p>
                  )}
                </SettingsFeedbackCard>
              )}

              {preview && (
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => void handleConfirm()}
                    disabled={preview.affectedCount === 0 || isBusy}
                    className={isRemovePreview ? sectionRedButtonClassName : sectionEmeraldButtonClassName}
                  >
                    {isSubmitting ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : isRemovePreview ? (
                      <Trash2 size={16} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    {isSubmitting
                      ? submittingLabel[preview.operation]
                      // The target tag stays in the label for the destructive
                      // action, where applying it to the wrong tag costs most.
                      : isRemovePreview
                        ? `${confirmLabel.remove} #${preview.oldTag}`
                        : confirmLabel[preview.operation]}
                  </button>
                </div>
              )}
              {inlineFeedbackMessage}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className={sectionLabelClassName}>Related Transactions</p>
                  <span className="text-xs font-bold text-slate-400">
                    #{selectedTag} · {tagTransactions.length} 筆
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
