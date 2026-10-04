import { useRouter } from "expo-router";
import { LoginScreen } from "../src/features/login/components/LoginScreen";

export default function Login() {
  const router = useRouter();

  return (
    <LoginScreen
      onSubmit={(driverId, pin, remember) => {
        // TODO(feature/driver-api-integration): call auth API, store token, route to Today's Trips
        console.log("login submit", { driverId, remember });
        router.push('/sign-in-error');
      }}
      onBiometric={() => router.push("/biometric-sign-in")}      
      onNfc={() => console.log("nfc")}
      onForgotPin={() => router.push("/reset-pin")}
    />
  );
}