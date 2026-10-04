import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ReportReeferFaultModal } from '../src/components/ReportReeferFaultModal';
import { colors } from '../src/theme/tokens';

export default function ReportReeferFaultScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  // TODO: replace with the vehicle of the current trip from Expo SQLite.
  const vehicleId = 'VEH018';

  const leave = () => {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  };

  const handleSendIssue = () => {
    // Offline rule from Driver-architecture.md:
    // 1. save to SQLite  2. update UI  3. queue outbox event  4. sync later
    // TODO(feature/driver-sqlite, feature/driver-sync):
    //   await outbox.enqueue({ type: 'REEFER_FAULT_REPORTED', vehicleId, reportedAt: new Date().toISOString() });
    setVisible(false);
    router.replace('/vehicle-issue-reported');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.overlay }}>
      <ReportReeferFaultModal
        visible={visible}
        vehicleId={vehicleId}
        onSendIssue={handleSendIssue}
        onCancel={leave}
      />
    </View>
  );
}
