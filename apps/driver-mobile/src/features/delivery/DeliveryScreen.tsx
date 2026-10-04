import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { D } from "../../theme/deliveryColor";
import {
  DeliveryOutcome,
  DeliveryPayload,
  ExceptionCode,
  StopDeliverySnapshot,
} from "./types";
import { DeliveryHeader } from "./components/DeliveryHeader";
import { TelemetryCard } from "./components/TelementryCard";
import { OutcomeToggle } from "./components/OutcomeToggle";
import { ManifestChecklist } from "./components/ManifestChecklist";
import { CompleteBar } from "./components/CompleteBar";

type Props = {
  data: StopDeliverySnapshot;
  onComplete?: (payload: DeliveryPayload) => void;
  onCantDeliver?: () => void;
};

export function DeliveryScreen({ data, onComplete, onCantDeliver }: Props) {
  const [outcome, setOutcome] = useState<DeliveryOutcome>("delivered");
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(data.items.map((i) => [i.id, i.expected]))
  );
  const [exceptions, setExceptions] = useState<Record<string, ExceptionCode>>(() =>
    Object.fromEntries(data.items.map((i) => [i.id, "none" as ExceptionCode]))
  );

  function chooseOutcome(next: DeliveryOutcome) {
    setOutcome(next);
    if (next === "delivered") {
      // Full delivery means every carton is verified again
      setQuantities(Object.fromEntries(data.items.map((i) => [i.id, i.expected])));
    }
  }

  function changeQty(id: string, n: number) {
    const next = { ...quantities, [id]: n };
    setQuantities(next);
    const allFull = data.items.every((i) => next[i.id] === i.expected);
    setOutcome(allFull ? "delivered" : "partial");
  }

  function changeException(id: string, code: ExceptionCode) {
    setExceptions((prev) => ({ ...prev, [id]: code }));
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <DeliveryHeader
        vehicle={data.vehicle}
        routeName={data.routeName}
        offlineSaved={data.offlineSaved}
        stopNo={data.stopNo}
        stopTotal={data.stopTotal}
        outlet={data.outlet}
        dock={data.dock}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <TelemetryCard
          arrival={data.arrival}
          completion={data.completion}
          dwell={data.dwell}
        />
        <OutcomeToggle
          value={outcome}
          onChange={chooseOutcome}
          onCantDeliver={onCantDeliver}
        />
        <ManifestChecklist
          items={data.items}
          outcome={outcome}
          quantities={quantities}
          exceptions={exceptions}
          onQtyChange={changeQty}
          onExceptionChange={changeException}
        />
      </ScrollView>

      <CompleteBar onPress={() => onComplete?.({ outcome, quantities, exceptions })} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  content: { padding: 16, gap: 18 },
});