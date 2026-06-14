import React from 'react';
import { CloudUpload } from 'lucide-react';
import type { SettingsStatus, SettingsStatusAction } from './settingsStatus';

export type SettingsFeedbackTone = 'error' | 'success' | 'warning';

const feedbackCardClassName: Record<SettingsFeedbackTone, string> = {
  error: 'border-red-500/20 bg-red-500/10 text-red-200',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-400/20 bg-amber-500/10 text-slate-200',
};

const feedbackTitleClassName: Record<SettingsFeedbackTone, string> = {
  error: 'text-red-200',
  success: 'text-emerald-200',
  warning: 'text-amber-300',
};

const feedbackActionClassName: Record<SettingsFeedbackTone, string> = {
  error: 'border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/25',
  success: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25',
  warning: 'border-amber-400/30 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25',
};

const SettingsFeedbackCard: React.FC<{
  children: React.ReactNode;
  title?: string;
  tone: SettingsFeedbackTone;
  action?: SettingsStatusAction;
}> = ({ children, title, tone, action }) => (
  <div className={`rounded-2xl border px-4 py-3 text-xs ${feedbackCardClassName[tone]}`}>
    {title && <p className={`font-black ${feedbackTitleClassName[tone]}`}>{title}</p>}
    <div className={title ? 'mt-1 space-y-1' : 'space-y-1'}>
      {children}
    </div>
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-xs font-black transition-colors sm:w-auto ${feedbackActionClassName[tone]}`}
      >
        <CloudUpload size={14} />
        {action.label}
      </button>
    )}
  </div>
);

// Convenience renderer for a Section's own SettingsStatus: success / error tones
// map straight onto the card, idle renders nothing.
export const SettingsStatusCard: React.FC<{ status: SettingsStatus }> = ({ status }) => {
  if (status.type === 'idle') return null;
  return (
    <SettingsFeedbackCard tone={status.type} action={status.action}>
      <p className="text-sm font-bold whitespace-pre-line">{status.message}</p>
    </SettingsFeedbackCard>
  );
};

export default SettingsFeedbackCard;
