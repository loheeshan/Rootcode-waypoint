import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  /** Shown in the message as the demo PIN hint. Prototype only. */
  demoPin: string;
  onTryAgain: () => void;
  onGetHelp: () => void;
};

export function PinNotRecognisedModal({
  visible,
  demoPin,
  onTryAgain,
  onGetHelp,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="PIN not recognised"
      message={`Try the demo PIN ${demoPin} or contact your bay lead.`}
      confirmLabel="Try again"
      cancelLabel="Get sign-in help"
      onConfirm={onTryAgain}
      onCancel={onGetHelp}
      onClose={onTryAgain}
    />
  );
}