import React from 'react';
import { ConfirmModal } from './ConfirmModal';

export type NotificationPreference = 'in-app-alerts' | 'sound-off';

type Props = {
  visible: boolean;
  onSelectPreference: (preference: NotificationPreference) => void;
  /** Closes without changing anything (the × button). */
  onClose: () => void;
};

export function NotificationPreferencesModal({
  visible,
  onSelectPreference,
  onClose,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Notification preferences"
      message="Critical loading changes remain visible in the app."
      confirmLabel="In-app alerts on"
      cancelLabel="Sound off for this device"
      onConfirm={() => onSelectPreference('in-app-alerts')}
      onCancel={() => onSelectPreference('sound-off')}
      onClose={onClose}
    />
  );
}