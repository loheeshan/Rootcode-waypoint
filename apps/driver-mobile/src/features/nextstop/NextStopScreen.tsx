import { View, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { N } from "../../theme/nextStopColors";
import { NextStopSnapshot } from "./types";
import { NextStopHeader } from "./components/NextStopHeader";
import { StopHeroCard } from "./components/StopHeroCard";
import { TurnByTurnCard } from "./components/TurnByTurnCard";
import { ArrivedBar } from "./components/ArrivedBar";

type Props = {
  data: NextStopSnapshot;
  onNavigate?: () => void;
  onArrived?: () => void;
};

export function NextStopScreen({ data, onNavigate, onArrived }: Props) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <NextStopHeader tripRef={data.tripRef} syncLabel={data.syncLabel} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <StopHeroCard
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

        <TurnByTurnCard
          trafficLabel={data.trafficLabel}
          instruction={data.instruction}
          mapMeta={data.mapMeta}
          gpsLabel={data.gpsLabel}
          kmLeft={data.kmLeft}
          onNavigate={onNavigate}
        />
      </ScrollView>

      <ArrivedBar onPress={onArrived} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: N.bg },
  content: { padding: 16, gap: 16 },
});