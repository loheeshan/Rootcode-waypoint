import { TripRecordsScreen } from "../../src/features/triprecords/TripRecordsScreen";
import { mockTripRecords } from "../../src/features/triprecords/mockData";

export default function TripRecords() {
  return <TripRecordsScreen data={mockTripRecords} />;
}