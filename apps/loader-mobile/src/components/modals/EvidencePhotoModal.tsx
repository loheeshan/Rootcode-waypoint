import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  onTakeSamplePhoto: () => void;
  onPermissionDenied: () => void;
  onClose: () => void;
};

export function EvidencePhotoModal({
  visible,
  onTakeSamplePhoto,
  onPermissionDenied,
  onClose,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Add evidence photo"
      message="Use a photo of the affected cartons or staging label. Photo capture is simulated here."
      confirmLabel="Take sample photo"
      cancelLabel="Camera permission denied"
      onConfirm={onTakeSamplePhoto}
      onCancel={onPermissionDenied}
      onClose={onClose}
    />
  );
}