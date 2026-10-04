import type { Metadata } from 'next';
import Waypoint from '@/features/store/components/Waypoint';

export const metadata: Metadata = { title: 'Store Manager | Waypoint' };

export default function StorePage() {
  return <Waypoint />;
}
