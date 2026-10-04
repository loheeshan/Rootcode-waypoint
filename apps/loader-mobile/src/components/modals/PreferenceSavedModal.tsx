import React from 'react';
import { NoticeModal } from './NoticeModal';

type Props = {
  visible: boolean;
  onBackToSettings: () => void;
};

export function PreferenceSavedModal({ visible, onBackToSettings }: Props) {
  return (
    <NoticeModal
      visible={visible}
      title="Preference saved"
      message="The selected preference has been recorded for this prototype session."
      buttonLabel="Back to settings"
      onDismiss={onBackToSettings}
    />
  );
}