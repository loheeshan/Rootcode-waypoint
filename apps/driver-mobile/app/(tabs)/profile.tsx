import { useState } from "react";
import { useRouter } from "expo-router";
import { ProfileScreen } from "../../src/features/profile/ProfileScreen";
import { mockProfile } from "../../src/features/profile/mockData";
import { ContactDispatchModal } from "../../src/features/contactdispatch/ContactDispatchModal";
import { mockDispatchDesk } from "../../src/features/contactdispatch/mockData";
import { DispatchHandoffModal } from "../../src/features/dispatchhandoff/DispatchHandoffModal";
import { mockDispatchHandoff } from "../../src/features/dispatchhandoff/mockData";

export default function Profile() {
  const router = useRouter();
  const [contactOpen, setContactOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);

  return (
    <>
      <ProfileScreen
        data={mockProfile}
        onSettings={() => console.log("settings")}
        onNotifications={() => console.log("notifications")}
        onVehicleDetails={() => console.log("vehicle and shift details")}
        onHelp={() => setContactOpen(true)}
        onEndShift={() => {
          // TODO(feature/driver-api-integration): confirm, check the outbox is empty, then clear the session
          console.log("end shift");
        }}
      />

      <ContactDispatchModal
        visible={contactOpen}
        desk={mockDispatchDesk.desk}
        extension={mockDispatchDesk.extension}
        onShowHandoff={() => {
          setContactOpen(false);
          setHandoffOpen(true);
        }}
        onClose={() => setContactOpen(false)}
      />

      <DispatchHandoffModal
        visible={handoffOpen}
        desk={mockDispatchHandoff.desk}
        extension={mockDispatchHandoff.extension}
        vehicle={mockDispatchHandoff.vehicle}
        onReturn={() => setHandoffOpen(false)}
        onViewTrip={() => {
          setHandoffOpen(false);
          router.navigate("/stops");
        }}
      />
    </>
  );
}