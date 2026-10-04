import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';

import { ActionButton, Notice, Screen } from '../../components/ui/ScreenKit';
import { useDialog } from '../dialogs/DialogProvider';

export default function NoPlanScreen() {
  const router = useRouter();
  const { openDialog, closeDialog } = useDialog();

  const retry = async () => {
    openDialog('downloadingPlan');
    const state = await NetInfo.fetch();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    closeDialog();
    if (state.isConnected && state.isInternetReachable !== false) {
      router.navigate('/tabs/today' as never);
    }
  };

  return (
    <Screen title="No saved plan available">
      <Notice tone="amber" title="Connect before loading">
        This device has no downloaded plan for this depot. Loading checks are unavailable until the current plan is
        received.
      </Notice>
      <ActionButton label="Retry connection" onPress={retry} />
      <ActionButton variant="secondary" label="Choose depot" onPress={() => router.navigate('/start-shift' as never)} />
    </Screen>
  );
}