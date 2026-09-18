import type { OperationMessageResult } from '../../services/notificationMessageService';

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

// Route one notification onto the two surfaces a settings subpage owns: the
// global toast and its own status card. Exactly one of them speaks per
// operation, so the same outcome is never described twice.
export const applyOperationMessage = (
  result: OperationMessageResult,
  surfaces: {
    notify: (message: string) => void;
    setStatus: (status: SettingsStatus) => void;
    syncProgressAction: SettingsStatusAction;
  }
): void => {
  if (result.toastMessage !== null) {
    surfaces.notify(result.toastMessage);
    surfaces.setStatus(idleStatus);
    return;
  }

  surfaces.setStatus({
    type: result.statusType,
    message: result.statusMessage,
    ...(result.showSyncProgressAction ? { action: surfaces.syncProgressAction } : {}),
  });
};
