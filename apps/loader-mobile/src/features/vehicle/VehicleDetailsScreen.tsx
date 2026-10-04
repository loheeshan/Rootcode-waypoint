import { useRouter } from 'expo-router';

import { ActionButton, InfoCard, Notice, Screen } from '../../components/ui/ScreenKit';
import { useDialog } from '../dialogs/DialogProvider';

export default function VehicleDetailsScreen() {
  const router = useRouter();
  const { openDialog } = useDialog();

  return (
    <Screen title="Vehicle & dock details">
      <InfoCard
        title="VEH018 · Reefer truck"
        lines={['Trip 1 · Colombo Fresh', 'Bay B-04 · departure 03:30', '1,820 kg / 14.4 m³', 'Driver: Sunil Perera']}
      />
      <Notice tone="blue" title="Cold-chain check">
        This trip’s chilled set-point is +4°C. Verify the load’s handling label and logger.
      </Notice>
      <ActionButton label="Scan vehicle / order" onPress={() => openDialog('scan')} />
      <ActionButton
        variant="secondary"
        label="Open load checklist"
        onPress={() => router.navigate('/tabs/checklist' as never)}
      />
      <ActionButton variant="secondary" label="Report vehicle problem" onPress={() => openDialog('reportVehicleIssue')} />
    </Screen>
  );
}