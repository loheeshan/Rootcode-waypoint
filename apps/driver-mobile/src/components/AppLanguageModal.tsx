import React from 'react';
import { NoticeModal } from './NoticeModal';

type Props = {
  visible: boolean;
  /** e.g. "English" */
  languageName: string;
  onKeep: () => void;
};

export function AppLanguageModal({ visible, languageName, onKeep }: Props) {
  return (
    <NoticeModal
      visible={visible}
      title="App language"
      message={`${languageName} is selected for this Driver demonstration.`}
      buttonLabel={`Keep ${languageName}`}
      onDismiss={onKeep}
    />
  );
}