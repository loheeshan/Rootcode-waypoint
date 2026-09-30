import { useNetInfo } from '@react-native-community/netinfo';
import { StarterScreen } from '@waypoint/mobile-ui';
export default function Home() {
  const network = useNetInfo();
  return <StarterScreen role="Loader" online={network.isConnected} />;
}
