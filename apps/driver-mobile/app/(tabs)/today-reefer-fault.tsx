import { ReeferFaultScreen } from "../../src/features/reeferfault/ReeferFaultScreen";
import { mockReeferFault } from "../../src/features/reeferfault/mockData";

export default function TodayReeferFault() {
  return (
    <ReeferFaultScreen
      data={mockReeferFault}
      onReportIssue={() => {
        // TODO: open the vehicle issue report screen once it is designed
        console.log("report vehicle issue");
      }}
    />
  );
}