import { LoginConflictScreen } from "../src/features/loginconflict/LoginConflictScreen";
import { mockLoginConflict } from "../src/features/loginconflict/mockData";

export default function LoginConflict() {
  return (
    <LoginConflictScreen
      data={mockLoginConflict}
      onContactDispatch={() => {
        // TODO(integration): open the dialer with the dispatch number
        console.log("contact dispatch");
      }}
      onForgotPin={() => console.log("forgot pin")}
      onSubmit={(payload) => {
        // TODO(feature/driver-api-integration): sign in with the chosen unit, then go to /(tabs)/today
        console.log("start shift", payload);
      }}
    />
  );
}