export type SettingsStatusType = 'success' | 'error' | 'idle';

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
