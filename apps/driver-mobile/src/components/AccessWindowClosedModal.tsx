import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  opensAt: string; // e.g. "09:00"
  onReturnToStop: () => void;
  onContactDispatch: () => void;
};

export function AccessWindowClosedModal({
  visible,
  opensAt,
  onReturnToStop,
  onContactDispatch,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Access window closed"
      message={`The loading bay opens at ${opensAt}. Wait safely or ask dispatch to reschedule this stop.`}
      confirmLabel="Return to stop"
      cancelLabel="Contact dispatch"
      onConfirm={onReturnToStop}
      onCancel={onContactDispatch}
      onClose={onReturnToStop}
    />
  );
}