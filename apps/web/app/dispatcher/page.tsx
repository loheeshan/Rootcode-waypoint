export default function DispatcherDashboard() {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">
            OPERATIONS
          </p>

          <h1>Dashboard</h1>

          <p>
            Monitor today's delivery operation,
            fleet capacity, and exceptions.
          </p>
        </div>
      </div>

      {/* Statistics */}

      <div className="stats">
        <div className="stat-card">
          <span>ORDERS</span>
          <strong>42</strong>
          <small>12 to plan</small>
        </div>

        <div className="stat-card">
          <span>ACTIVE TRIPS</span>
          <strong>
            18 <small>/ 22</small>
          </strong>
          <small>82% deployed</small>
        </div>

        <div className="stat-card">
          <span>DELIVERIES</span>
          <strong>
            31 <small>/ 38</small>
          </strong>
          <small>
            82% complete
          </small>
        </div>

        <div className="stat-card warning">
          <span>ON-TIME SLA</span>
          <strong>86%</strong>
          <small>Target 90%</small>
        </div>

        <div className="stat-card danger">
          <span>EXCEPTIONS</span>
          <strong>4</strong>
          <small>2 critical</small>
        </div>
      </div>

      {/* Main dashboard */}

      <div className="dashboard-grid">

        <section className="card">
          <h2>Delivery Progress</h2>

          <div className="progress">
            <strong>82%</strong>
            <span>COMPLETED</span>
          </div>

          <div className="metrics">
            <div>
              <strong>31</strong>
              <span>Delivered</span>
            </div>

            <div>
              <strong>4</strong>
              <span>In Transit</span>
            </div>

            <div>
              <strong>5</strong>
              <span>Delayed</span>
            </div>

            <div>
              <strong>2</strong>
              <span>Blocked</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Fleet Capacity</h2>

          <div className="capacity">
            <p>
              Refrigerated
              <strong>82%</strong>
            </p>

            <div>
              <span style={{ width: '82%' }} />
            </div>

            <p>
              Dry / Heavy
              <strong>74%</strong>
            </p>

            <div>
              <span style={{ width: '74%' }} />
            </div>

            <p>
              Light Vans
              <strong>52%</strong>
            </p>

            <div>
              <span style={{ width: '52%' }} />
            </div>
          </div>
        </section>

      </div>

      {/* Attention */}

      <section className="card">
        <div className="card-header">
          <h2>
            Needs Immediate Attention
          </h2>

          <button>
            View all exceptions →
          </button>
        </div>

        <div className="attention">
          <div>
            <span>DELAYED</span>
            <strong>5</strong>
            <small>+2h avg delay</small>
          </div>

          <div>
            <span>OFFLINE</span>
            <strong>3</strong>
            <small>GPS signal lost</small>
          </div>

          <div>
            <span>LOADING ISSUES</span>
            <strong>2</strong>
            <small>Bay 3 dock hold</small>
          </div>
        </div>
      </section>

      {/* Orders */}

      <div className="dashboard-grid">

        <section className="card">
          <h2>Today's Orders</h2>

          <div className="ready">
            <div>
              <strong>
                12 READY TO PLAN
              </strong>

              <p>
                Orders verified and awaiting
                vehicle assignment
              </p>
            </div>

            <a href="/dispatcher/planning">
              Open Planning →
            </a>
          </div>

          <div className="order-status">
            <span>Confirmed (14)</span>
            <span>Ready (8)</span>
            <span>Planned (12)</span>
            <span>Deferred (4)</span>
            <span>Issue (4)</span>
          </div>
        </section>

        <section className="card">
          <h2>Fleet Distribution</h2>

          <div className="fake-map">
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
          </div>
        </section>

      </div>

      {/* Active Trips */}

      <section className="card">
        <div className="card-header">
          <h2>Active Trips</h2>

          <button>
            View all trips →
          </button>
        </div>

        {[
          ['WP-1042', 'Colombo → Kandy', '75%'],
          ['WP-1187', 'Colombo → Galle', '52%'],
          ['WP-0921', 'Kandy → Jaffna', '45%'],
          ['WP-0765', 'Colombo → Trinco', '40%'],
          ['WP-0419', 'Colombo → Negombo', '15%'],
        ].map((trip) => (
          <div
            className="trip"
            key={trip[0]}
          >
            <strong>{trip[0]}</strong>

            <span>{trip[1]}</span>

            <div className="trip-bar">
              <span
                style={{
                  width: trip[2],
                }}
              />
            </div>

            <strong>{trip[2]}</strong>
          </div>
        ))}
      </section>
    </>
  );
}