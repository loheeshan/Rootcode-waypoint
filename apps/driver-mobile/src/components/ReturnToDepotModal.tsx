import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  vehicleId: string; // e.g. "VEH018"
  onViewCompletedRoute: () => void;
  onContactDispatch: () => void;
};

export function ReturnToDepotModal({
  visible,
  vehicleId,
  onViewCompletedRoute,
  onContactDispatch,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Return to depot"
      message={`No active delivery stops remain. Keep returned goods on ${vehicleId} and hand them over at the depot.`}
      confirmLabel="View completed route"
      cancelLabel="Contact dispatch"
      onConfirm={onViewCompletedRoute}
      onCancel={onContactDispatch}
      onClose={onViewCompletedRoute}
    />
  );
}