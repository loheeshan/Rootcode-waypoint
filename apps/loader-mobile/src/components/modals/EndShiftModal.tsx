import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  onSignOut: () => void;
  onKeepWorking: () => void;
  /** Changes for this account still waiting to sync. */
  unsent?: number;
};

export function EndShiftModal({ visible, onSignOut, onKeepWorking, unsent = 0 }: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="End this shift?"
      message={unsent
        ? `${unsent} change${unsent === 1 ? ' is' : 's are'} not yet synced. They stay on this phone and are sent the next time you sign in with this account; other accounts cannot see or send them.`
        : 'All your changes are synced. Synced work stays on the manifest.'}
      confirmLabel="Sign out of this device"
      cancelLabel="Keep working"
      onConfirm={onSignOut}
      onCancel={onKeepWorking}
    />
  );
}