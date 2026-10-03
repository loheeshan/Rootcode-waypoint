import { TripReadyScreen } from "../../src/features/tripready/TripReadyScreen";
import { mockTripReady } from "../../src/features/tripready/mockData";

export default function TripReady() {
  return <TripReadyScreen data={mockTripReady} />;
}