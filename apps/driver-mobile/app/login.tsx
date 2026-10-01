import { LoginScreen } from "../src/features/login/LoginScreen";

export default function Login() {
  return (
    <LoginScreen
      onSubmit={(driverId, pin, remember) => {
        // TODO(feature/driver-api-integration): call auth API, store token, route to Today's Trips
        console.log("login submit", { driverId, remember });
      }}
      onBiometric={() => console.log("biometric")}
      onNfc={() => console.log("nfc")}
      onForgotPin={() => console.log("forgot pin")}
    />
  );
}