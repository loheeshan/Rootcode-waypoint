import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ActionButton, InfoCard, Notice, Screen } from '../../components/ui/ScreenKit';
import { useDialog } from './DialogProvider';
import type { DialogId } from './dialogs';

type Status = 'unchecked' | 'passed' | 'failed';

const gates: { key: string; label: string; dialog: DialogId }[] = [
  { key: 'cargo', label: 'Cargo locked & strapped', dialog: 'cargoSecured' },
  { key: 'reefer', label: 'Reefer set-point verified', dialog: 'chilledSetpoint' },
  { key: 'seal', label: 'Rear shutter seal recorded', dialog: 'shutterSeal' },
];

const lineFor: Record<Status, string> = {
  unchecked: '○ Not checked · tap to inspect',
  passed: '✓ Passed · tap to re-inspect',
  failed: '✕ Failed · vehicle on hold · tap to re-inspect',
};

export default function DepartureChecksScreen() {
  const router = useRouter();
  const { openDialog } = useDialog();
  const [status, setStatus] = useState<Record<string, Status>>({
    cargo: 'unchecked',
    reefer: 'unchecked',
    seal: 'unchecked',
  });

  const allPassed = gates.every((g) => status[g.key] === 'passed');

  const inspect = (g: (typeof gates)[number]) =>
    openDialog(g.dialog, (key) => {
      if (key === 'passed') setStatus((s) => ({ ...s, [g.key]: 'passed' }));
      if (key === 'failed') setStatus((s) => ({ ...s, [g.key]: 'failed' }));
    });

  return (
    <Screen title="Departure checks">
      <Notice tone="blue" title="Finish the loading check">
        Verify the physical checks at the bay before final sign-off.
      </Notice>

      {gates.map((g) => (
        <InfoCard
          key={g.key}
          compact
          title={g.label}
          linesTone={status[g.key] === 'passed' ? 'success' : status[g.key] === 'failed' ? 'dark' : 'muted'}
          lines={[lineFor[status[g.key]]]}
          onPress={() => inspect(g)}
        />
      ))}

      <ActionButton
        label="Review readiness"
        onPress={() => (allPassed ? router.navigate('/tabs/depart' as never) : openDialog('inspectionRequired'))}
      />
      <ActionButton
        variant="secondary"
        label="Report an inspection failure"
        onPress={() => openDialog('reportVehicleIssue')}
      />
    </Screen>
  );
}