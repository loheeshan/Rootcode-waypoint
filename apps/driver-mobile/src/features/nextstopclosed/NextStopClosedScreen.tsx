import { View, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { X } from "../../theme/closedColors";
import { NextStopClosedSnapshot } from "./types";
import { ClosedHeader } from "./components/ClosedHeader";
import { ClosedHeroCard } from "./components/ClosedHeroCard";
import { AccessClosedCard } from "./components/AccessClosedCard";
import { TurnPreviewCard } from "./components/TurnPreviewCard";

type Props = {
  data: NextStopClosedSnapshot;
  onCallReceiver?: () => void;
};

export function NextStopClosedScreen({ data, onCallReceiver }: Props) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ClosedHeader
        initials={data.initials}
        tripRef={data.tripRef}
        syncLabel={data.syncLabel}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <ClosedHeroCard
          stopNo={data.stopNo}
          stopTotal={data.stopTotal}
          outletCode={data.outletCode}
          outletName={data.outletName}
          address={data.address}
          windowStart={data.windowStart}
          windowEnd={data.windowEnd}
          eta={data.eta}
          completedStops={data.completedStops}
        />

        <AccessClosedCard
          access={data.access}
          windowStart={data.windowStart}
          windowEnd={data.windowEnd}
          onCallReceiver={onCallReceiver}
        />

        <TurnPreviewCard
          trafficLabel={data.trafficLabel}
          instruction={data.instruction}
          mapMeta={data.mapMeta}
          gpsLabel={data.gpsLabel}
          kmLeft={data.kmLeft}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: X.bg },
  content: { padding: 16, gap: 16, paddingBottom: 28 },
});