import { View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { ActionButton, InfoCard, Screen } from '../../components/ui/ScreenKit';
import { t } from '../../theme/loaderTokens';
import { useDialog } from '../dialogs/DialogProvider';

export default function StartShiftScreen() {
  const { openDialog } = useDialog();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <AppHeader role="LOADER" location="Peliyagoda · Route Colombo" hasAlerts />
      <Screen title="Start your loading shift">
        <InfoCard
          title="Peliyagoda Central Depot"
          lines={['Shared dock device · Bay B-04', 'Select your bay-lead account to continue.']}
        />
        <ActionButton label="K. Bandara · Bay lead #04" onPress={() => openDialog('pin')} />
        <ActionButton variant="secondary" label="Choose another depot" onPress={() => {}} />
        <ActionButton variant="secondary" label="Can’t sign in?" onPress={() => {}} />
      </Screen>
    </View>
  );
}