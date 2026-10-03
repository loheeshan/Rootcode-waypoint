import { View, Text, ScrollView, Platform, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { O } from "../../theme/offlineLaunchColors";
import { OfflineLaunchSnapshot } from "./types";
import { BrandHero } from "./components/BrandHero";
import { ConnectionCard } from "./components/ConnectionCard";
import { HandshakeStatus } from "./components/HandshakeStatus";

type Props = {
  data: OfflineLaunchSnapshot;
  retrying?: boolean;
  onRetry?: () => void;
};

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function OfflineLaunchScreen({ data, retrying = false, onRetry }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Text style={styles.coords}>{data.coords}</Text>

        <View style={{ marginTop: 28 }}>
          <BrandHero
            appName={data.appName}
            subtitle={data.subtitle}
            tagline={data.tagline}
          />
        </View>

        <View style={{ marginTop: 30 }}>
          <ConnectionCard
            title={data.cardTitle}
            body={data.cardBody}
            footnote={data.footnote}
            retrying={retrying}
            onRetry={onRetry}
          />
        </View>

        <View style={{ flex: 1, minHeight: 28 }} />

        <HandshakeStatus
          statusText={data.statusText}
          progressPct={data.progressPct}
          cacheLeft={data.cacheLeft}
          cacheRight={data.cacheRight}
          network={data.network}
          version={data.version}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: O.bg, overflow: "hidden" },
  content: { flexGrow: 1, paddingHorizontal: 20 },
  coords: {
    alignSelf: "flex-end",
    color: O.faint,
    fontSize: 10,
    fontFamily: MONO,
    letterSpacing: 0.4,
  },
});