import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  vehicleId: string;    // e.g. "VEH025"
  vehicleType: string;  // e.g. "chilled van"
  depotName: string;    // e.g. "Colombo hub"
  onRequest: () => void;
  onCancel: () => void;
};

export function ChangeVehicleModal({
  visible,
  vehicleId,
  vehicleType,
  depotName,
  onRequest,
  onCancel,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Change assigned vehicle"
      message={`${vehicleId} · ${vehicleType} · ${depotName}\nReady for a verified driver assignment.`}
      confirmLabel={`Request ${vehicleId} assignment`}
      onConfirm={onRequest}
      onCancel={onCancel}
    />
  );
}
