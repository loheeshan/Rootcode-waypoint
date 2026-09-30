import Link from 'next/link';
import { Card } from '@waypoint/web-ui';
export default function Home() {
  return <><p className="eyebrow">DELIVERY OPERATIONS / STARTER</p><h1>One connected delivery day.</h1><p>The repository foundation for Store, Dispatcher, Loader, and Driver workflows. Choose a web workspace to begin.</p><div className="grid"><Card title="Dispatcher"><p>Plan deliveries, allocate vehicles, and follow daily operations.</p><Link href="/dispatcher">Open Dispatcher</Link></Card><Card title="Store Manager"><p>Create orders, track delivery progress, and confirm receipts.</p><Link href="/store">Open Store Manager</Link></Card></div><p className="notice">Foundation only: these pages contain no operational data. Authentication, role permissions, and business workflows are the next implementation steps.</p></>;
}
