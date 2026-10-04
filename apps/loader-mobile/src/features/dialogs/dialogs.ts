export type DialogId =
  | 'scan'
  | 'labelMatches'
  | 'labelMismatch'
  | 'reportVehicleIssue'
  | 'vehicleIssueReported'
  | 'saveSignoffOffline'
  | 'acknowledgeIssue'
  | 'shutterSeal'
  | 'chilledSetpoint'
  | 'cargoSecured'
  | 'inspectionRequired'
  | 'finishChecks'
  | 'checkQuantity'
  | 'revisionAcknowledged'
  | 'stagingChange'
  | 'finalStopLoaded'
  | 'stop2Loaded';

export type DialogAction = {
  key: string;
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  href?: string; // navigate here after closing
  next?: DialogId; // or open another dialog instead
};

export type DialogDef = { title: string; body: string[]; actions: DialogAction[] };

const gate = (title: string, body: string): DialogDef => ({
  title,
  body: [body],
  actions: [
    { key: 'passed', label: 'Passed · confirm check', variant: 'primary' },
    { key: 'failed', label: 'Failed · report issue', variant: 'danger', next: 'reportVehicleIssue' },
  ],
});

export const dialogs: Record<DialogId, DialogDef> = {
  scan: {
    title: 'Scan vehicle or order',
    body: ['Camera scanning is simulated here. Choose a sample label to demonstrate matching and mismatched items.'],
    actions: [
      { key: 'veh018', label: 'Scan VEH018 / OUT014', variant: 'primary', next: 'labelMatches' },
      { key: 'veh022', label: 'Scan VEH022 item', variant: 'secondary', next: 'labelMismatch' },
      { key: 'unavailable', label: 'Camera unavailable', variant: 'secondary' },
    ],
  },
  labelMatches: {
    title: 'Label matches VEH018',
    body: ['OUT014 · Stop 2 · 20 cartons. Verify the physical quantity before confirming it is loaded.'],
    actions: [
      { key: 'confirm', label: 'Confirm loading', variant: 'primary' },
      { key: 'back', label: 'Return to checklist', variant: 'secondary', href: '/tabs/checklist' },
    ],
  },
  // Not in the screenshots: written to complete the scan demo.
  labelMismatch: {
    title: 'Label belongs to VEH022',
    body: ['OUT044 was reassigned to VEH022 in plan rev 3. Do not load this item on VEH018.'],
    actions: [
      { key: 'again', label: 'Scan again', variant: 'primary', next: 'scan' },
      { key: 'back', label: 'Return to checklist', variant: 'secondary', href: '/tabs/checklist' },
    ],
  },
  reportVehicleIssue: {
    title: 'Report vehicle or bay issue',
    body: ['The vehicle will be held while the dispatcher reviews the fault.'],
    actions: [
      { key: 'reefer', label: 'Reefer temperature fault', variant: 'danger', next: 'vehicleIssueReported' },
      { key: 'staging', label: 'Staging unit cannot be moved', variant: 'secondary', next: 'vehicleIssueReported' },
      { key: 'fit', label: 'Load will not fit safely', variant: 'secondary', next: 'vehicleIssueReported' },
    ],
  },
  vehicleIssueReported: {
    title: 'Vehicle issue reported',
    body: ['Dispatcher notified at 03:16. VEH018 remains on hold. Re-inspect after the physical fault is resolved.'],
    actions: [
      { key: 'open', label: 'Open failed inspection', variant: 'primary', href: '/tabs/depart' },
      { key: 'recheck', label: 'Recheck after repair', variant: 'secondary', href: '/tabs/departure-checks' },
    ],
  },
  saveSignoffOffline: {
    title: 'Save sign-off offline?',
    body: [
      'This records readiness only on this device. The driver is not notified or unlocked until the sign-off is synced.',
    ],
    actions: [
      { key: 'save', label: 'Save readiness locally', variant: 'primary', href: '/tabs/signoff-saved' },
      { key: 'keep', label: 'Keep reviewing', variant: 'secondary' },
    ],
  },
  acknowledgeIssue: {
    title: 'Acknowledge manifest issue',
    body: ['ORD0092322 · OUT027 · Milk 1L', '8 of 10 accepted. The shortfall is recorded on the manifest.'],
    actions: [
      { key: 'ack', label: 'Acknowledge issue', variant: 'primary' },
      { key: 'review', label: 'Review dispatcher approval', variant: 'secondary', href: '/tabs/issue-resolved' },
    ],
  },
  shutterSeal: gate('Record shutter seal', 'Confirm the shutter is closed and tamper tag SL-99420 is intact.'),
  chilledSetpoint: gate(
    'Verify chilled set-point',
    'The logger must show this trip’s required +4°C set-point. Check the cargo handling label.',
  ),
  cargoSecured: gate('Cargo secured', 'Confirm straps, barriers and load bars are locked.'),
  inspectionRequired: {
    title: 'Inspection required',
    body: ['Every inspection gate must pass before final sign-off. Failed checks keep the vehicle on hold.'],
    actions: [{ key: 'back', label: 'Return to inspection checks', variant: 'primary', href: '/tabs/departure-checks' }],
  },
  finishChecks: {
    title: 'Finish checks before sign-off',
    body: ['Complete all loading lines, acknowledge the latest plan and resolve any blocking issue before marking ready.'],
    actions: [
      { key: 'checklist', label: 'Open checklist', variant: 'primary', href: '/tabs/checklist' },
      { key: 'dispatcher', label: 'Review dispatcher decision', variant: 'secondary', href: '/tabs/dispatcher-pending' },
    ],
  },
  checkQuantity: {
    title: 'Check the quantity',
    body: ['For a shortage, available quantity must be lower than expected. For missing goods, set available to zero.'],
    actions: [{ key: 'back', label: 'Return to report', variant: 'secondary' }],
  },
  revisionAcknowledged: {
    title: 'Revision acknowledged',
    body: ['ORD0092350 was removed from VEH018 staging. Continue using the latest reverse-stop loading list.'],
    actions: [{ key: 'back', label: 'Return to checklist', variant: 'primary' }],
  },
  stagingChange: {
    title: 'Plan rev 3 · staging change',
    body: [
      'ORD0092350 (OUT044) moved from VEH018 to VEH022. Remove the labelled staging unit from VEH018 and place it at Bay B-07. Other completed loading checks are kept.',
    ],
    actions: [
      { key: 'confirm', label: 'Confirm staging unit removed', variant: 'primary', next: 'revisionAcknowledged' },
      { key: 'problem', label: 'Report removal problem', variant: 'secondary', href: '/tabs/report' },
    ],
  },
  finalStopLoaded: {
    title: 'Confirm final stop loaded',
    body: ['OUT001 · Keells Peliyagoda', '12 cartons · chilled 4°C', 'Place nearest the rear door.'],
    actions: [
      { key: 'confirm', label: 'Confirm 12 cartons loaded', variant: 'primary' },
      { key: 'problem', label: 'Report a problem', variant: 'secondary', href: '/tabs/report' },
    ],
  },
  stop2Loaded: {
    title: 'Confirm Stop 2 loaded',
    body: ['OUT014 · Cargills Mahabage', '20 cartons · fresh produce', 'Load near the tailgate, ahead of Stop 1.'],
    actions: [
      { key: 'confirm', label: 'Confirm 20 cartons loaded', variant: 'primary' },
      { key: 'problem', label: 'Report a problem', variant: 'secondary', href: '/tabs/report' },
    ],
  },
};