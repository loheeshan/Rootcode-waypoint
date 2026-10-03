import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  onShowCallHandoff: () => void;
  onClose: () => void;
};

export function ContactBayLeadModal({ visible, onShowCallHandoff, onClose }: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Contact bay lead"
      message="A phone handoff would open the device dialler. This prototype does not place a real call."
      confirmLabel="Show call handoff"
      cancelLabel="Close"
      onConfirm={onShowCallHandoff}
      onCancel={onClose}
    />
  );
}
