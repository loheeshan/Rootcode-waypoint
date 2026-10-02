import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  removedStopNumber: number; // e.g. 6
  onContinueTrip: () => void;
  onReviewStopSequence: () => void;
};

export function RouteUpdateAcknowledgedModal({
  visible,
  removedStopNumber,
  onContinueTrip,
  onReviewStopSequence,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Route update acknowledged"
      message={`Stop ${removedStopNumber} was removed. Its goods remain on the vehicle for return to the depot. Continue to the next active stop.`}
      confirmLabel="Continue trip"
      cancelLabel="Review stop sequence"
      onConfirm={onContinueTrip}
      onCancel={onReviewStopSequence}
      onClose={onContinueTrip}
    />
  );
}