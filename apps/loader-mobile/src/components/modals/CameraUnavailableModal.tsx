import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  onContinueWithoutPhoto: () => void;
  onReviewCameraSettings: () => void;
  onClose: () => void;
};

export function CameraUnavailableModal({
  visible,
  onContinueWithoutPhoto,
  onReviewCameraSettings,
  onClose,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Camera access unavailable"
      message="You can still report the issue with a note. Enable camera access on the dock device to add photo evidence."
      confirmLabel="Continue without a photo"
      cancelLabel="Review camera settings"
      onConfirm={onContinueWithoutPhoto}
      onCancel={onReviewCameraSettings}
      onClose={onClose}
    />
  );
}