'use client';

import { useMemo, useState } from 'react';
import '../../order.css';
type Order = {
  id: string;
  outlet: string;
  district: string;
  brand: string;
  weight: string;
  volume: string;
  temperature: 'Ambient' | 'Chilled';
  window: string;
  access: 'Normal' | 'Van Only';
  deferred: boolean;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Confirmed';
  category: 'Fresh' | 'Style' | 'Tech' | 'Chilled' | 'Van-Only';
};

const orders: Order[] = [
  {
    id: '#ORD-7782',
    outlet: 'Cargills Food City',
    district: 'Kandy Central · C-01',
    brand: 'Fresh',
    weight: '450 kg',
    volume: '3.2 m³',
    temperature: 'Ambient',
    window: '08:00 – 11:00',
    access: 'Normal',
    deferred: false,
    priority: 'High',
    status: 'Confirmed',
    category: 'Fresh',
  },
  {
    id: '#ORD-7783',
    outlet: 'Food City Express',
    district: 'Galle Fort · S-03',
    brand: 'Fresh',
    weight: '320 kg',
    volume: '2.1 m³',
    temperature: 'Chilled',
    window: '10:00 – 13:00',
    access: 'Normal',
    deferred: false,
    priority: 'Medium',
    status: 'Confirmed',
    category: 'Chilled',
  },
  {
    id: '#ORD-7784',
    outlet: 'Keells Super Outlet',
    district: 'Colombo 03 · W-07',
    brand: 'Style',
    weight: '210 kg',
    volume: '1.8 m³',
    temperature: 'Ambient',
    window: '09:00 – 12:00',
    access: 'Van Only',
    deferred: true,
    priority: 'High',
    status: 'Confirmed',
    category: 'Style',
  },
  {
    id: '#ORD-7785',
    outlet: 'Singer Mega Store',
    district: 'Jaffna Main Road · N-02',
    brand: 'Tech',
    weight: '180 kg',
    volume: '1.5 m³',
    temperature: 'Ambient',
    window: '11:00 – 15:00',
    access: 'Normal',
    deferred: false,
    priority: 'Medium',
    status: 'Confirmed',
    category: 'Tech',
  },
  {
    id: '#ORD-7786',
    outlet: 'Cargills Distribution Hub',
    district: 'Matara Beach Road · S-01',
    brand: 'Fresh',
    weight: '520 kg',
    volume: '3.8 m³',
    temperature: 'Chilled',
    window: '08:00 – 12:00',
    access: 'Normal',
    deferred: false,
    priority: 'High',
    status: 'Confirmed',
    category: 'Fresh',
  },
  {
    id: '#ORD-7787',
    outlet: 'Glomark Supermarket',
    district: 'Kurunegala Town · NW-04',
    brand: 'Style',
    weight: '260 kg',
    volume: '2.0 m³',
    temperature: 'Ambient',
    window: '13:00 – 17:00',
    access: 'Normal',
    deferred: true,
    priority: 'Low',
    status: 'Confirmed',
    category: 'Style',
  },
  {
    id: '#ORD-7788',
    outlet: 'Abans Showroom',
    district: 'Negombo City · W-09',
    brand: 'Tech',
    weight: '190 kg',
    volume: '1.4 m³',
    temperature: 'Ambient',
    window: '10:00 – 14:00',
    access: 'Normal',
    deferred: false,
    priority: 'Medium',
    status: 'Confirmed',
    category: 'Tech',
  },
  {
    id: '#ORD-7789',
    outlet: 'Cargills Express Hub',
    district: 'Anuradhapura Inner · NC-01',
    brand: 'Fresh',
    weight: '310 kg',
    volume: '2.6 m³',
    temperature: 'Chilled',
    window: '09:00 – 12:00',
    access: 'Van Only',
    deferred: false,
    priority: 'Medium',
    status: 'Confirmed',
    category: 'Fresh',
  },
  {
    id: '#ORD-7790',
    outlet: 'Keells Market Plaza',
    district: 'Trincomalee Harbor · E-01',
    brand: 'Style',
    weight: '230 kg',
    volume: '2.1 m³',
    temperature: 'Ambient',
    window: '11:00 – 16:00',
    access: 'Normal',
    deferred: true,
    priority: 'High',
    status: 'Confirmed',
    category: 'Style',
  },
  {
    id: '#ORD-7791',
    outlet: 'Singer Regional Depot',
    district: 'Batticaloa East · E-04',
    brand: 'Tech',
    weight: '160 kg',
    volume: '1.2 m³',
    temperature: 'Ambient',
    window: '13:00 – 17:00',
    access: 'Normal',
    deferred: false,
    priority: 'Low',
    status: 'Confirmed',
    category: 'Tech',
  },
];

const categories = [
  { label: 'All Orders', count: 142 },
  { label: 'Fresh', count: 54 },
  { label: 'Style', count: 30 },
  { label: 'Tech', count: 16 },
  { label: 'Chilled', count: 22 },
  { label: 'Van-Only', count: 11 },
  { label: 'Previously Deferred', count: 8 },
];

export default function OrdersPage() {
  const [activeCategory, setActiveCategory] = useState('All Orders');
  const [search, setSearch] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showDeferred, setShowDeferred] = useState(false);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        order.id.toLowerCase().includes(searchText) ||
        order.outlet.toLowerCase().includes(searchText) ||
        order.district.toLowerCase().includes(searchText);

      let matchesCategory = true;

      if (activeCategory === 'Fresh') {
        matchesCategory = order.category === 'Fresh';
      }

      if (activeCategory === 'Style') {
        matchesCategory = order.category === 'Style';
      }

      if (activeCategory === 'Tech') {
        matchesCategory = order.category === 'Tech';
      }

      if (activeCategory === 'Chilled') {
        matchesCategory = order.temperature === 'Chilled';
      }

      if (activeCategory === 'Van-Only') {
        matchesCategory = order.access === 'Van Only';
      }

      if (activeCategory === 'Previously Deferred') {
        matchesCategory = order.deferred;
      }

      if (showDeferred) {
        matchesCategory = matchesCategory && order.deferred;
      }

      return matchesSearch && matchesCategory;
    });
  }, [activeCategory, search, showDeferred]);

  const toggleOrder = (id: string) => {
    setSelectedOrders((current) =>
      current.includes(id)
        ? current.filter((orderId) => orderId !== id)
        : [...current, id],
    );
  };

  const toggleAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map((order) => order.id));
    }
  };

  const totalWeight = selectedOrders.length * 310;
  const totalVolume = selectedOrders.length * 2.4;

  return (
    <div className="orders-page">
      {/* PAGE HEADER */}

      <section className="orders-header-card">
        <div>
          <div className="orders-title-row">
            <h1>Confirmed Order Queue</h1>
            <span className="cutoff-badge">Cutoff Validated</span>
          </div>

          <p>
            All orders that made the cutoff for the selected delivery date.
          </p>
        </div>

        <div className="orders-header-actions">
          <button className="orders-date-button">
            <span>▣</span>

            <div>
              <small>DELIVERY DATE</small>
              <strong>Sep 25, 2026</strong>
            </div>

            <span>⌄</span>
          </button>

          <button className="orders-secondary-button">
            ↓ Export
          </button>

          <button className="orders-primary-button">
            + Create Order
          </button>
        </div>
      </section>

      {/* QUEUE ACTIONS */}

      <div className="queue-actions">
        <button className="queue-tab active">
          Confirmed before cutoff
        </button>

        <button className="queue-tab">
          After cutoff — next run
        </button>

        <button className="queue-plan-button">
          Auto-plan orders →
        </button>
      </div>

      {/* SUMMARY */}

      <section className="orders-summary">
        <div>
          <strong>142</strong>
          <span>CONFIRMED ORDERS</span>
        </div>

        <div className="summary-pill deferred-pill">
          ● 8 Previously Deferred
        </div>

        <div className="summary-pill van-pill">
          ● 11 Van-Only Access
        </div>

        <div className="summary-spacer" />

        <div className="payload-stat">
          <strong>34.8 t</strong>
          <span>⚖</span>
        </div>

        <div className="payload-stat">
          <strong>182 m³</strong>
          <span>◉</span>
          <small>PAYLOAD VOL</small>
        </div>
      </section>

      {/* FILTERS */}

      <section className="filters-card">
        <div className="filter-title">
          ☷ <span>FILTERS</span>
        </div>

        <select defaultValue="all">
          <option value="all">Depot: All Depots</option>
          <option>Colombo</option>
          <option>Kandy</option>
          <option>Galle</option>
        </select>

        <select defaultValue="all">
          <option value="all">Brand: All Brands</option>
          <option>Cargills</option>
          <option>Keells</option>
          <option>Singer</option>
          <option>Abans</option>
        </select>

        <select defaultValue="all">
          <option value="all">District: All Districts</option>
          <option>Colombo</option>
          <option>Kandy</option>
          <option>Galle</option>
          <option>Jaffna</option>
        </select>

        <select defaultValue="all">
          <option value="all">Temp: All Types</option>
          <option>Ambient</option>
          <option>Chilled</option>
        </select>

        <select defaultValue="all">
          <option value="all">Access: All Vehicles</option>
          <option>Normal</option>
          <option>Van Only</option>
        </select>

        <select defaultValue="all">
          <option value="all">Deferred: All</option>
          <option>Yes</option>
          <option>No</option>
        </select>

        <select defaultValue="all">
          <option value="all">Priority: All Priorities</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>

        <button
          className="clear-filters"
          onClick={() => {
            setActiveCategory('All Orders');
            setSearch('');
            setShowDeferred(false);
          }}
        >
          Clear All
        </button>

        <button className="apply-filters">
          Apply Filters
        </button>
      </section>

      {/* CATEGORY TABS + SEARCH */}

      <div className="order-category-row">
        <div className="order-category-tabs">
          {categories.map((category) => (
            <button
              key={category.label}
              className={
                activeCategory === category.label ? 'active' : ''
              }
              onClick={() => setActiveCategory(category.label)}
            >
              <span className="category-dot" />
              {category.label}
              <strong>{category.count}</strong>
            </button>
          ))}
        </div>

        <div className="order-search-box">
          <span>⌕</span>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this order queue..."
          />

          <kbd>⌘F</kbd>
        </div>
      </div>

      {/* TABLE */}

      <section className="orders-table-card">
        <div className="table-toolbar">
          <div>
            <button
              className="select-all-button"
              onClick={toggleAll}
            >
              {selectedOrders.length === filteredOrders.length &&
              filteredOrders.length > 0
                ? '☑'
                : '☐'}
            </button>

            <strong>
              {selectedOrders.length > 0
                ? `${selectedOrders.length} orders selected`
                : 'No orders selected'}
            </strong>

            <span>
              Total: {totalWeight.toLocaleString()} kg ·{' '}
              {totalVolume.toFixed(1)} m³
            </span>
          </div>

          <div className="table-actions">
            <button
              onClick={() => setShowDeferred(!showDeferred)}
            >
              Defer Selected
            </button>

            <button className="batch-plan-button">
              Batch Plan Into Trips →
            </button>
          </div>
        </div>

        <div className="orders-table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th className="checkbox-column">□</th>
                <th>ORDER #</th>
                <th>OUTLET & DISTRICT</th>
                <th>BRAND</th>
                <th>WEIGHT</th>
                <th>VOLUME</th>
                <th>TEMPERATURE</th>
                <th>DELIVERY WINDOW</th>
                <th>ACCESS</th>
                <th>DEFERRED?</th>
                <th>PRIORITY</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td className="checkbox-column">
                    <button
                      className="row-checkbox"
                      onClick={() => toggleOrder(order.id)}
                    >
                      {selectedOrders.includes(order.id)
                        ? '☑'
                        : '□'}
                    </button>
                  </td>

                  <td>
                    <strong className="order-id">
                      {order.id}
                    </strong>
                  </td>

                  <td>
                    <div className="outlet-cell">
                      <strong>{order.outlet}</strong>
                      <small>{order.district}</small>
                    </div>
                  </td>

                  <td>
                    <span
                      className={`brand-badge ${order.brand.toLowerCase()}`}
                    >
                      {order.brand}
                    </span>
                  </td>

                  <td>
                    <strong>{order.weight}</strong>
                  </td>

                  <td>
                    <strong>{order.volume}</strong>
                  </td>

                  <td>
                    <span
                      className={`temperature-badge ${
                        order.temperature === 'Chilled'
                          ? 'chilled'
                          : 'ambient'
                      }`}
                    >
                      {order.temperature === 'Chilled'
                        ? '❄'
                        : '☀'}{' '}
                      {order.temperature}
                    </span>
                  </td>

                  <td>
                    <strong className="delivery-window">
                      {order.window}
                    </strong>
                  </td>

                  <td>
                    {order.access === 'Van Only' ? (
                      <span className="van-only-badge">
                        ♙ Van
                        <br />
                        Only
                      </span>
                    ) : (
                      <span className="normal-access">
                        Normal
                      </span>
                    )}
                  </td>

                  <td>
                    {order.deferred ? (
                      <span className="deferred-badge">
                        Deferred
                      </span>
                    ) : (
                      <span className="not-deferred">
                        No
                      </span>
                    )}
                  </td>

                  <td>
                    <span
                      className={`priority-badge ${order.priority.toLowerCase()}`}
                    >
                      {order.priority}
                    </span>
                  </td>

                  <td>
                    <span className="confirmed-badge">
                      ● Confirmed
                    </span>
                  </td>

                  <td>
                    <button className="more-button">•••</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="empty-orders">
            <strong>No orders found</strong>
            <p>Try changing your search or filters.</p>
          </div>
        )}

        <div className="orders-table-footer">
          <span>
            Showing {filteredOrders.length} of 142 orders
          </span>

          <div className="orders-pagination">
            <button className="active">1</button>
            <button>2</button>
            <button>3</button>
            <span>...</span>
            <button>15</button>
            <button>›</button>
          </div>
        </div>
      </section>
    </div>
  );
}