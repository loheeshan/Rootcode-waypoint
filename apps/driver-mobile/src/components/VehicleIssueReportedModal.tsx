import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  onReturnToVehicleStatus: () => void;
  onContactDispatch: () => void;
};

export function VehicleIssueReportedModal({
  visible,
  onReturnToVehicleStatus,
  onContactDispatch,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Vehicle issue reported"
      message="Dispatch has the reefer fault and vehicle details. Keep the vehicle at the depot; loading remains on hold."
      confirmLabel="Return to vehicle status"
      cancelLabel="Contact dispatch"
      onConfirm={onReturnToVehicleStatus}
      onCancel={onContactDispatch}
      onClose={onReturnToVehicleStatus}
    />
  );
}