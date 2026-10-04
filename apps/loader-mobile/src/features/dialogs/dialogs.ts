import type { DialogLine } from '../../components/ui/DialogCard';

export type DialogId =
  | 'scan' | 'labelMatches' | 'labelMismatch' | 'reportVehicleIssue' | 'vehicleIssueReported'
  | 'saveSignoffOffline' | 'acknowledgeIssue' | 'shutterSeal' | 'chilledSetpoint' | 'cargoSecured'
  | 'inspectionRequired' | 'finishChecks' | 'checkQuantity' | 'revisionAcknowledged'
  | 'stagingChange' | 'finalStopLoaded' | 'stop2Loaded'
  | 'pin' | 'markReady' | 'reviewReport' | 'sentToDispatcher' | 'savedOffline'
  | 'orderDetails' | 'dispatcherNotified' | 'shortageResolved' | 'trip2Complete'
  | 'completeSixLines' | 'downloadingPlan';

export type DialogAction = {
  key: string;
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  href?: string; // navigate here after closing
  next?: DialogId; // or open another dialog instead
};

export type DialogDef = {
  title: string;
  body: DialogLine[];
  actions: DialogAction[];
  custom?: 'pin'; // renders the PIN keypad inside the card
  successHref?: string; // where the PIN keypad goes on success
};

const gate = (title: string, body: string): DialogDef => ({
  title,
  body: [body],
  actions: [
    { key: 'passed', label: 'Passed · confirm check', variant: 'primary' },
    { key: 'failed', label: 'Failed · report issue', variant: 'danger', next: 'reportVehicleIssue' },
  ],
});

export const dialogs: Record<DialogId, DialogDef> = {
  /* ---------------- Earlier 17 ---------------- */
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
    body: ['This records readiness only on this device. The driver is not notified or unlocked until the sign-off is synced.'],
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
  chilledSetpoint: gate('Verify chilled set-point', 'The logger must show this trip’s required +4°C set-point. Check the cargo handling label.'),
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
    body: ['ORD0092350 (OUT044) moved from VEH018 to VEH022. Remove the labelled staging unit from VEH018 and place it at Bay B-07. Other completed loading checks are kept.'],
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

  /* ---------------- NEW: screen "Enter bay-lead PIN" ---------------- */
  pin: {
    title: 'Enter bay-lead PIN',
    body: ['Use the demo PIN 0426 to continue. No account credentials are sent.'],
    actions: [],
    custom: 'pin',
    successHref: '/tabs/today',
  },

  /* ---------------- NEW: screen "Mark VEH018 ready?" ---------------- */
  markReady: {
    title: 'Mark VEH018 ready?',
    body: [
      '7 orders processed · 3 inspection checks passed. The shortage remains on the signed manifest.',
      { text: 'Issue acknowledgement required', tone: 'warn' },
    ],
    actions: [
      { key: 'confirm', label: 'Confirm ready to depart', variant: 'primary', href: '/tabs/vehicle-ready' },
      { key: 'back', label: 'Back to readiness', variant: 'secondary' },
    ],
  },

  /* ---------------- NEW: screen "Review problem report" ---------------- */
  // The Report screen fills in the lines below with the real selections.
  reviewReport: {
    title: 'Review problem report',
    body: [
      { text: 'ORD0092322 · OUT027 · Milk 1L', tone: 'heading' },
      { text: 'Quantity Short · available 8 of 10', tone: 'dark' },
      { text: 'Hold vehicle — needs dispatcher', tone: 'dark' },
      { text: 'Bay 4 photo attached · 03:12', tone: 'dark' },
      { text: '2 crates damaged in Bay 4', tone: 'dark' },
      { text: 'Capture time: 03:12 · Bay B-04', tone: 'small' },
    ],
    actions: [
      { key: 'send', label: 'Send report', variant: 'primary' },
      { key: 'edit', label: 'Edit report', variant: 'secondary' },
    ],
  },

  /* ---------------- NEW: screen "Sent to dispatcher · 03:12" ---------------- */
  sentToDispatcher: {
    title: 'Sent to dispatcher · 03:12',
    body: [
      'The report is attached to the order. Your selected urgency is included.',
      { text: 'Hold vehicle — needs dispatcher', tone: 'strong' },
    ],
    actions: [
      { key: 'status', label: 'View dispatcher status', variant: 'primary', href: '/tabs/dispatcher-pending' },
      { key: 'continue', label: 'Continue checklist', variant: 'secondary', href: '/tabs/checklist' },
    ],
  },

  /* ---------------- NEW: screen "Saved on this device · 03:12" ---------------- */
  savedOffline: {
    title: 'Saved on this device · 03:12',
    body: [
      'The dispatcher has not received this report yet. It will send when the connection returns.',
      { text: 'Hold vehicle — needs dispatcher', tone: 'strong' },
    ],
    actions: [
      { key: 'continue', label: 'Continue offline loading', variant: 'primary', href: '/tabs/checklist' },
      { key: 'queue', label: 'View sync queue', variant: 'secondary', href: '/tabs/sync-queue' },
    ],
  },

  /* ---------------- NEW: screen "Order and loading details" ---------------- */
  // The Checklist screen fills in the order and quantities.
  orderDetails: {
    title: 'Order and loading details',
    body: [
      { text: 'OUT081 · Stop 7', tone: 'heading' },
      { text: '18 cartons · chilled 4°C · loaded deepest', tone: 'dark' },
    ],
    actions: [
      { key: 'report', label: 'Report problem on this order', variant: 'primary', href: '/tabs/report' },
      { key: 'back', label: 'Return to checklist', variant: 'secondary' },
    ],
  },

  /* ---------------- NEW: screen "Dispatcher notified" ---------------- */
  dispatcherNotified: {
    title: 'Dispatcher notified',
    body: ['VEH031’s two missing items remain an open issue. Captured at 03:18 · staging zone C-12.'],
    actions: [{ key: 'back', label: 'Return to issue', variant: 'primary' }],
  },

  /* ---------------- NEW: screen "Staging shortage resolved" ---------------- */
  shortageResolved: {
    title: 'Staging shortage resolved',
    body: ['Both items were found and checked against VEH031’s manifest. The issue history is retained.'],
    actions: [{ key: 'back', label: 'Back to Tech trips', variant: 'primary', href: '/tabs/today?filter=Tech' }],
  },

  /* ---------------- NEW: screen "VEH022 loading complete" ---------------- */
  trip2Complete: {
    title: 'VEH022 loading complete',
    body: ['6 of 6 orders checked. This trip is ready for the bay lead’s physical inspection and handoff.'],
    actions: [{ key: 'back', label: 'Back to today’s loading', variant: 'primary', href: '/tabs/today' }],
  },

  /* ---------------- NEW: screen "Complete all six loading lines" ---------------- */
  completeSixLines: {
    title: 'Complete all six loading lines',
    body: ['Tick each order after loading it. Keep reverse stop order and verify the reassigned staging unit.'],
    actions: [{ key: 'back', label: 'Return to VEH022 checklist', variant: 'primary' }],
  },

  /* ---------------- NEW: screen "Downloading latest plan…" ---------------- */
  downloadingPlan: {
    title: 'Downloading latest plan…',
    body: ['Checking the current depot and plan revision before enabling loading.'],
    actions: [],
  },
};