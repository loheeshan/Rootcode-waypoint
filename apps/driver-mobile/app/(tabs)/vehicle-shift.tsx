import { VehicleShiftScreen } from "../../src/features/vehicleshift/VehicleShiftScreen";
import { mockVehicleShift } from "../../src/features/vehicleshift/mockData";

export default function VehicleShift() {
  return (
    <VehicleShiftScreen
      data={mockVehicleShift}
      onReportIssue={() => {
        // TODO: open the vehicle issue report screen once it is designed
        console.log("report vehicle issue");
      }}
      onViewChecklist={() => {
        // TODO: open the departure checklist once it is designed
        console.log("view departure checklist");
      }}
    />
  );
}