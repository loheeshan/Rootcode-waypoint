import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  /** Shown as the blue (primary) button. */
  primaryDepot: string;
  /** Shown as the outlined (secondary) button. */
  secondaryDepot: string;
  onSelectDepot: (depot: string) => void;
  /** Closes without choosing a depot (the × button). */
  onClose: () => void;
};

export function ChooseDepotModal({
  visible,
  primaryDepot,
  secondaryDepot,
  onSelectDepot,
  onClose,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Choose loading depot"
      message="Confirm the depot for this shared device before opening a loading plan."
      confirmLabel={primaryDepot}
      cancelLabel={secondaryDepot}
      onConfirm={() => onSelectDepot(primaryDepot)}
      onCancel={() => onSelectDepot(secondaryDepot)}
      onClose={onClose}
    />
  );
}
