import React from 'react';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  visible: boolean;
  onOpenCachedTrip: () => void;
  onNoCachedCredentials: () => void;
};

export function CachedRouteAccessModal({
  visible,
  onOpenCachedTrip,
  onNoCachedCredentials,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      title="Cached route access"
      message="Offline sign-in is available only after a successful sign-in and route download on this phone."
      confirmLabel="Open cached trip"
      cancelLabel="No cached credentials"
      onConfirm={onOpenCachedTrip}
      onCancel={onNoCachedCredentials}
    />
  );
}