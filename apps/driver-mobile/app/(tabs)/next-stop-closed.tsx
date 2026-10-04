import { useState } from "react";
import { NextStopClosedScreen } from "../../src/features/nextstopclosed/NextStopClosedScreen";
import { mockNextStopClosed } from "../../src/features/nextstopclosed/mockData";
import { ReceiverHandoffModal } from "../../src/features/receiverhandoff/ReceiverHandoffModal";
import { mockReceiverHandoff } from "../../src/features/receiverhandoff/mockData";

export default function NextStopClosed() {
  const [handoffOpen, setHandoffOpen] = useState(false);

  return (
    <>
      <NextStopClosedScreen
        data={mockNextStopClosed}
        onCallReceiver={() => setHandoffOpen(true)}
      />

      <ReceiverHandoffModal
        visible={handoffOpen}
        receiver={mockReceiverHandoff.receiver}
        outletCode={mockReceiverHandoff.outletCode}
        gate={mockReceiverHandoff.gate}
        onReturn={() => setHandoffOpen(false)}
      />
    </>
  );
}