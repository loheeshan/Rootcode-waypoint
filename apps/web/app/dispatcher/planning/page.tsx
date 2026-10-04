'use client';

import { useState } from 'react';

const orders = [
  {
    id: '#ORD-7782',
    name: 'Cargills - Kandy',
    type: 'Ambient',
    weight: '450 kg',
    window: '08:00–11:00',
    category: 'Fresh',
  },
  {
    id: '#ORD-7783',
    name: 'Food City - Galle',
    type: 'Chilled',
    weight: '320 kg',
    window: '10:00–13:00',
    category: 'Chilled',
    assigned: true,
  },
  {
    id: '#ORD-7784',
    name: 'Keells - Colombo',
    type: 'Van Only',
    weight: '210 kg',
    window: '09:00–12:00',
    category: 'Style',
  },
  {
    id: '#ORD-7785',
    name: 'Singer - Jaffna',
    type: 'Ambient',
    weight: '180 kg',
    window: '11:00–15:00',
    category: 'Tech',
  },
];

const vehicles = [
  {
    id: 'VEH-025',
    type: 'Van',
    capacity: '2,000 kg • 12.0 m³',
    status: 'Ready',
  },
  {
    id: 'VEH-033',
    type: 'Reefer',
    capacity: '3,000 kg • 18.0 m³',
    status: 'Standby',
  },
  {
    id: 'VEH-044',
    type: 'Van',
    capacity: '2,000 kg • 12.0 m³',
    status: 'Available',
  },
  {
    id: 'VEH-052',
    type: 'Reefer',
    capacity: '3,000 kg • 18.0 m³',
    status: 'Available',
  },
];

export default function PlanningPage() {
  const [activeTab, setActiveTab] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState('#ORD-7783');
  const [optimized, setOptimized] = useState(false);

  const tabs = [
    ['All', '88'],
    ['Fresh', '28'],
    ['Style', '22'],
    ['Tech', '16'],
    ['Chilled', '22'],
  ];

  return (
    <div className="planning-page">
      {/* PAGE HEADER */}

      <div className="planning-header">
        <div>
          <div className="planning-title-row">
            <h1>Planning Workspace</h1>
            <span className="desk-badge">Desk 02 Active</span>
          </div>

          <p>
            Allocate orders to vehicles, optimise multi-drop routes, and
            enforce cold-chain constraints.
          </p>
        </div>

        <div className="planning-actions">
          <button className="date-button">
            <span>▣</span>
            <div>
              <small>DELIVERY DATE</small>
              <strong>Sep 25, 2026</strong>
            </div>
            <span>⌄</span>
          </button>

          <button
            className="secondary-button"
            onClick={() => setOptimized(true)}
          >
            ⚡ Auto Allocate
          </button>

          <button
            className="primary-button"
            onClick={() => setOptimized(true)}
          >
            ◉ Validate Plan
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}

      <div className="planning-stats">
        <div className="planning-stat-card">
          <div className="stat-top">
            <span>ORDERS / UNASSIGNED</span>
            <b>▧</b>
          </div>

          <div className="stat-number-row">
            <strong>88</strong>
            <span className="blue-pill">12 ready</span>
          </div>

          <p>Awaiting vehicle assignment</p>
        </div>

        <div className="planning-stat-card">
          <div className="stat-top">
            <span>ASSIGNED ORDERS</span>
            <b className="green-icon">▱</b>
          </div>

          <div className="stat-number-row">
            <strong>54</strong>
            <span className="muted-number">/ 142 total</span>
            <span className="green-percent">38%</span>
          </div>

          <div className="progress-bar">
            <div style={{ width: '38%' }} />
          </div>
        </div>

        <div className="planning-stat-card">
          <div className="stat-top">
            <span>COLD CHAIN</span>
            <b className="cyan-icon">✣</b>
          </div>

          <div className="stat-number-row">
            <strong className="blue-number">22</strong>
            <span className="muted-number">Reefer fleet req.</span>
          </div>

          <p>Strict temp lock enforced</p>
        </div>

        <div className="planning-stat-card">
          <div className="stat-top">
            <span>LATE RISKS</span>
            <b className="orange-icon">△</b>
          </div>

          <div className="stat-number-row">
            <strong className="orange-number">8</strong>
            <span className="red-pill">3 critical</span>
          </div>

          <p>Urgent re-route needed</p>
        </div>
      </div>

      {/* MAIN WORKSPACE */}

      <div className="planning-workspace">
        {/* ORDERS */}

        <section className="orders-panel planning-panel">
          <div className="panel-heading">
            <div>
              <h2>
                ORDERS POOL <span>88 unassigned</span>
              </h2>
            </div>

            <span className="filter-icon">☷</span>
          </div>

          <div className="order-tabs">
            {tabs.map(([name, count]) => (
              <button
                key={name}
                className={activeTab === name ? 'active' : ''}
                onClick={() => setActiveTab(name)}
              >
                <strong>{name}</strong>
                <span>{count}</span>
              </button>
            ))}
          </div>

          <div className="order-search">
            <span>⌕</span>
            <input placeholder="Filter outlet, ID, location..." />
            <kbd>⌘F</kbd>
          </div>

          <div className="order-table-head">
            <span>□</span>
            <span>ORDER & OUTLET</span>
            <span>TEMP / LOAD</span>
            <span>WINDOW</span>
          </div>

          <div className="order-list">
            {orders.map((order) => (
              <button
                key={order.id}
                className={`order-row ${
                  selectedOrder === order.id ? 'selected' : ''
                }`}
                onClick={() => setSelectedOrder(order.id)}
              >
                <span className="checkbox">□</span>

                <div className="order-name">
                  <strong>{order.id}</strong>
                  <b>{order.name}</b>

                  {order.assigned && (
                    <span className="assigned-label">● Assigned</span>
                  )}
                </div>

                <div className="order-type">
                  <span
                    className={
                      order.type === 'Chilled'
                        ? 'temp chilled'
                        : order.type === 'Van Only'
                          ? 'temp van'
                          : 'temp'
                    }
                  >
                    {order.type}
                  </span>

                  <small>{order.weight}</small>
                </div>

                <div className="order-window">
                  <strong>{order.window}</strong>
                  <small>{order.category}</small>
                </div>
              </button>
            ))}
          </div>

          <div className="orders-footer">
            <span>Showing 1–6 of 88 orders</span>

            <div className="pagination">
              <button className="current">1</button>
              <button>2</button>
              <button>3</button>
              <span>...</span>
              <button>9</button>
            </div>
          </div>
        </section>

        {/* MAP */}

        <section className="map-panel planning-panel">
          <div className="panel-heading">
            <h2>
              <span className="map-icon">◈</span>
              INTERACTIVE ROUTE MAP
            </h2>

            <span className="live-corridor">
              ● 4 Corridors Live
            </span>
          </div>

          <div className="fake-map">
            <div className="map-label river">Kelani River</div>
            <div className="map-label dc">DC</div>
            <div className="map-label peliyagoda">Peliyagoda</div>
            <div className="map-label pettah">Pettah</div>
            <div className="map-label maradana">Maradana</div>
            <div className="map-label colombo">Colombo Fort</div>
            <div className="map-label borella">Borella</div>
            <div className="map-label cinnamon">Cinnamon Gdns</div>
            <div className="map-label kollupitiya">Kollupitiya</div>

            <div className="route route-one" />
            <div className="route route-two" />

            <span className="map-stop stop-one">1</span>
            <span className="map-stop stop-two">2</span>
            <span className="map-stop stop-three">3</span>
            <span className="map-stop stop-four">4</span>

            <span className="warning-stop">!</span>

            <div className="map-controls">
              <button>+</button>
              <button>−</button>
              <button>⌾</button>
            </div>

            <div className="map-water-label">Indian Ocean</div>
          </div>

          <div className="map-legend">
            <span>● Fresh Route</span>
            <span>● Style Route</span>
            <span>● Tech Route</span>
            <span>● Chilled Route</span>
          </div>
        </section>

        {/* VEHICLE */}

        <section className="vehicle-panel planning-panel">
          <div className="vehicle-header">
            <div className="vehicle-title">
              <span className="truck-icon">▱</span>

              <div>
                <h2>VEH-018</h2>
                <p>Reefer • Max 3,000 kg • 18.0 m³</p>
              </div>
            </div>

            <div>
              <span className="active-badge">ACTIVE</span>
              <select>
                <option>Trip 1 • 3 Orders</option>
              </select>
            </div>
          </div>

          <div className="capacity-row">
            <div>
              <span>Weight: 1,150 / 3,000 kg</span>
              <strong>38%</strong>
              <div className="capacity-bar">
                <div style={{ width: '38%' }} />
              </div>
            </div>

            <div>
              <span>Volume: 8.6 / 18.0 m³</span>
              <strong>48%</strong>
              <div className="capacity-bar">
                <div style={{ width: '48%' }} />
              </div>
            </div>
          </div>

          <div className="vehicle-info">
            <span>↗ Est. Dist: <b>210 km</b></span>
            <span>◷ Est. Time: <b>4h 20m</b></span>
          </div>

          <div className="stops-header">
            <strong>ASSIGNED STOPS SEQUENCE (3)</strong>
            <button>Reorder Stops</button>
          </div>

          <div className="stops">
            <div className="stop-card">
              <span className="stop-number">1</span>
              <div>
                <strong>#ORD-7783 • Food City Galle</strong>
                <small>320 kg • Chilled</small>
              </div>
              <b>ETA 10:00</b>
            </div>

            <div className="stop-card">
              <span className="stop-number dark">2</span>
              <div>
                <strong>#ORD-7786 • Cargills Matara</strong>
                <small>520 kg • Chilled</small>
              </div>
              <b>ETA 11:30</b>
            </div>

            <div className="stop-card late">
              <span className="stop-number orange">3</span>
              <div>
                <strong>#ORD-7789 • Cargills Matara</strong>
                <small>310 kg • Chilled</small>
              </div>
              <b>Late Risk</b>
            </div>
          </div>

          <button className="drop-order">
            ⊕ Drop selected orders to assign to Trip 1
          </button>

          <div className="fleet-heading">
            <strong>AVAILABLE FLEET UNITS</strong>
            <span>4 &nbsp; Ready for assignment</span>
          </div>

          <div className="fleet-list">
            {vehicles.map((vehicle) => (
              <div className="fleet-row" key={vehicle.id}>
                <span className="fleet-icon">
                  {vehicle.type === 'Reefer' ? '✣' : '▱'}
                </span>

                <div>
                  <strong>{vehicle.id} <small>{vehicle.type}</small></strong>
                  <p>Cap: {vehicle.capacity}</p>
                </div>

                <span className="fleet-orders">0 Orders</span>
                <span className={`fleet-status ${vehicle.status.toLowerCase()}`}>
                  {vehicle.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* BOTTOM ACTIONS */}

      <div className="planning-bottom-actions">
        <button className="secondary-button">Review deferrals</button>
        <button className="secondary-button">Check hard rules</button>

        <button
          className="primary-button"
          onClick={() => setOptimized(true)}
        >
          {optimized ? '✓ Valid Draft' : 'Save valid draft'} →
        </button>
      </div>

      {/* RECOVERY */}

      <section className="recovery-panel">
        <h2>Operational recovery</h2>
        <p>
          Review incidents and demonstrate recovery without losing dispatch
          context.
        </p>

        <button className="secondary-button">
          Open recovery scenarios
        </button>
      </section>
    </div>
  );
}