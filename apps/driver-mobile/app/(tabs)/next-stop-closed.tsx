import { NextStopClosedScreen } from "../../src/features/nextstopclosed/NextStopClosedScreen";
import { mockNextStopClosed } from "../../src/features/nextstopclosed/mockData";

export default function NextStopClosed() {
  return (
    <NextStopClosedScreen
      data={mockNextStopClosed}
      onCallReceiver={() => {
        // TODO(integration): open the dialer with the receiver's number
        console.log("call receiver");
      }}
    />
  );
}