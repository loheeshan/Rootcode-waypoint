import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  outletName: string;
  accessNote: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function NavigateOutletModal({
  visible,
  outletName,
  accessNote,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Navigate to this outlet"
      message={`${outletName} · ${accessNote}. The route is available on this phone. Use navigation only when safely stopped.`}
      confirmLabel="Open navigation preview"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}