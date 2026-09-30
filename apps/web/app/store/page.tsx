import { Card, EmptyState } from '@waypoint/web-ui';
export default function Page() {
  return <><p className="eyebrow">WEB WORKSPACE</p><h1>Store Manager</h1><p>Orders, order creation, confirmation, delivery status, deferred notices, and receipts.</p><Card title="Workspace foundation"><EmptyState title="Ready for feature development" message="Connect authentication and API data before adding operational actions." /></Card></>;
}
