export type Category = 'Fresh' | 'Style' | 'Tech';

export type TripStatus =
  | { kind: 'loading'; loaded: number; total: number; payloadKg: number; volumeM3: number }
  | { kind: 'notStarted'; loaded: number; total: number; dock: string }
  | { kind: 'issue'; title: string; detail: string }
  | { kind: 'ready'; loaded: number; total: number; driver: string };

export type Trip = {
  id: string;
  trip: number;
  category: Category;
  tags: string[];
  departs: string;
  departsIn: string;
  minutes: number;
  urgent?: boolean;
  planUpdated?: { title: string; note: string };
  status: TripStatus;
};

// Set to true to preview VEH018 after sign-off ("Ready · 7 of 7 processed").
const VEH018_SIGNED_OFF = false;

export const trips: Trip[] = [
  {
    id: 'VEH018',
    trip: 1,
    category: 'Fresh',
    tags: ['Reefer Truck', 'Colombo Route'],
    departs: '03:30',
    departsIn: '42m',
    minutes: 42,
    urgent: true,
    status: { kind: 'loading', loaded: VEH018_SIGNED_OFF ? 7 : 5, total: 7, payloadKg: 1820, volumeM3: 14.4 },
  },
  {
    id: 'VEH022',
    trip: 2,
    category: 'Fresh',
    tags: ['Chilled Van'],
    departs: '04:15',
    departsIn: '1h 27m',
    minutes: 87,
    planUpdated: { title: 'Plan Updated (Rev 3)', note: '+1 priority order re-assigned from VEH018' },
    status: { kind: 'notStarted', loaded: 0, total: 6, dock: 'Dock Bay B-07' },
  },
  {
    id: 'VEH009',
    trip: 1,
    category: 'Style',
    tags: ['Ambient 14ft'],
    departs: '04:45',
    departsIn: '1h 57m',
    minutes: 117,
    status: { kind: 'ready', loaded: 4, total: 4, driver: 'K. Perera (Staged)' },
  },
  {
    id: 'VEH031',
    trip: 1,
    category: 'Tech',
    tags: ['Secure Vault'],
    departs: '05:00',
    departsIn: '2h 12m',
    minutes: 132,
    status: {
      kind: 'issue',
      title: '1 Issue Reported (Shortage)',
      detail: 'Stop #2: 2 items missing in staging zone C-12',
    },
  },
];