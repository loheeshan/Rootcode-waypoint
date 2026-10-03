import { useState } from "react";
import { LoginConflictScreen } from "../src/features/loginconflict/LoginConflictScreen";
import { mockLoginConflict } from "../src/features/loginconflict/mockData";
import { ContactDispatchModal } from "../src/features/contactdispatch/ContactDispatchModal";
import { mockDispatchDesk } from "../src/features/contactdispatch/mockData";

export default function LoginConflict() {
  const [dispatchOpen, setDispatchOpen] = useState(false);

  return (
    <>
      <LoginConflictScreen
        data={mockLoginConflict}
        onContactDispatch={() => setDispatchOpen(true)}
        onForgotPin={() => console.log("forgot pin")}
        onSubmit={(payload) => {
          // TODO(feature/driver-api-integration): sign in with the chosen unit, then go to /(tabs)/today
          console.log("start shift", payload);
        }}
      />

      <ContactDispatchModal
        visible={dispatchOpen}
        desk={mockDispatchDesk.desk}
        extension={mockDispatchDesk.extension}
        onShowHandoff={() => {
          // TODO(integration): show the handoff details (vehicle + active stop) or open the dialer
          console.log("show contact handoff");
          setDispatchOpen(false);
        }}
        onClose={() => setDispatchOpen(false)}
      />
    </>
  );
}