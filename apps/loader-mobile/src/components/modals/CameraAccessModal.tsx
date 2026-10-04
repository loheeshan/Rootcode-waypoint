import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  onAllowCamera: () => void;
  onContinueWithoutCamera: () => void;
};

export function CameraAccessModal({
  visible,
  onAllowCamera,
  onContinueWithoutCamera,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Camera access"
      message="Device permission handoff is simulated. Loading and issue notes remain available if access is denied."
      confirmLabel="Allow camera in demo"
      cancelLabel="Continue without camera"
      onConfirm={onAllowCamera}
      onCancel={onContinueWithoutCamera}
    />
  );
}