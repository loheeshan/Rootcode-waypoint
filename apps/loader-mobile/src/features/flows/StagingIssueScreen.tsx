import { useRouter } from 'expo-router';

import { ActionButton, InfoCard, Notice, Screen } from '../../components/ui/ScreenKit';
import { useDialog } from '../dialogs/DialogProvider';

export default function StagingIssueScreen() {
  const router = useRouter();
  const { openDialog } = useDialog();

  return (
    <Screen title="VEH031 · Staging issue">
      <Notice tone="amber" title="2 items missing">
        Stop 2 · staging zone C-12 · Tech trip departs 05:00
      </Notice>
      <InfoCard
        title="Recheck staging"
        lines={['Check adjacent cage labels and the dispatch manifest before reporting the available quantity.']}
      />
      <ActionButton label="Found both items" onPress={() => openDialog('shortageResolved')} />
      <ActionButton
        variant="secondary"
        label="Still missing · notify dispatcher"
        onPress={() => openDialog('dispatcherNotified')}
      />
      <ActionButton
        variant="secondary"
        label="Back to Tech trips"
        onPress={() => router.navigate('/tabs/today?filter=Tech' as never)}
      />
    </Screen>
  );
}