// Inline feedback tones for settings subpages. `idle` renders nothing; the
// remaining types map one-to-one onto SettingsFeedbackCard tones.
export type SettingsStatusType = 'success' | 'error' | 'warning' | 'info' | 'idle';

export interface SettingsStatusAction {
  label: string;
  onClick: () => void;
}

export interface SettingsStatus {
  type: SettingsStatusType;
  message: string;
  action?: SettingsStatusAction;
}

export const idleStatus: SettingsStatus = { type: 'idle', message: '' };
