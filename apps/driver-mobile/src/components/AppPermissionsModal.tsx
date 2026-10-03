import React from 'react';
import { NoticeModal } from './NoticeModal';

type Props = {
  visible: boolean;
  onReturn: () => void;
};

export function AppPermissionsModal({ visible, onReturn }: Props) {
  return (
    <NoticeModal
      visible={visible}
      title="App permissions"
      message={
        'Camera: requested when adding a photo.\n' +
        'Location: used for arrival and navigation.\n' +
        'Your saved delivery records remain available.'
      }
      buttonLabel="Return to app"
      onDismiss={onReturn}
    />
  );
}
