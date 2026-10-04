'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError, type VehicleResponse } from '@waypoint/api-contracts';
import { useDispatcher } from '../../../features/dispatcher/components/DispatcherShell';
import { Alert, LoadError, Loading, useLoad } from '../../../features/dispatcher/components/ui';
import {
  colomboToday, failureMessage, formatDate, getFleet, readDaily, requiredFuelDays, validFuel, vehicleLabel, writeDaily,
  type DailyInput,
} from '../../../features/dispatcher/data/dispatcher';

/**
 * Daily fleet inputs: availability per vehicle and date, and the actual consumed-fuel total.
 * Writes use the server's conditional headers; values are never defaulted or converted.
 */
export default function FleetInputsPage() {
  const { depotId, depots, day, onExpired } = useDispatcher();
  const [inputDay, setInputDay] = useState(day);
  useEffect(() => setInputDay(day), [day]);
  const fleet = useLoad(() => getFleet(depotId), onExpired, depotId);
  const today = colomboToday();
  const fuelDays = requiredFuelDays(day, today);

  return (
    <div className="planning-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">FLEET</p>
          <h1>Daily fleet inputs</h1>
          <p>
            {depots.find((d) => d.id === depotId)?.name} · availability decides which vehicles the optimizer may use.
            Fuel totals are the actual litres consumed that day across all trips.
          </p>
        </div>
      </div>

      <section className="card">
        <div className="dx-row">
          <label className="dx-field">Input date (Colombo)
            <input type="date" value={inputDay} onChange={(e) => e.target.value && setInputDay(e.target.value)} />
          </label>
          <div className="dx-field">Fuel days needed to plan {formatDate(day)}
            <div className="dx-row">
              {fuelDays.length ? fuelDays.map((d) => (
                <button key={d} className={`dx-btn ${d === inputDay ? 'on' : ''}`} onClick={() => setInputDay(d)}>{formatDate(d)}</button>
              )) : <span className="dx-muted">None: the plan week has not started, so consumption to date is zero.</span>}
            </div>
          </div>
        </div>
        <p className="dx-muted">
          Missing days are unknown, not zero: planning and publishing stop until every available vehicle has a
          recorded total from Monday through today. Record 0.000 only when the vehicle really used no fuel.
        </p>
      </section>

      {fleet.loading ? <Loading t="Loading vehicles…" /> : fleet.error ? <LoadError error={fleet.error} retry={fleet.reload} /> : (
        <section className="card dx-table-wrap">
          <table className="dx-table">
            <thead>
              <tr>
                <th>VEHICLE</th><th>CAPACITY</th><th>FUEL</th>
                <th>AVAILABLE {formatDate(inputDay)}</th><th>FUEL USED {formatDate(inputDay)}</th>
              </tr>
            </thead>
            <tbody>
              {fleet.data?.items.map((vehicle) => (
                <VehicleRow key={`${vehicle.id}:${inputDay}`} vehicle={vehicle} day={inputDay} today={today} onExpired={onExpired} />
              ))}
            </tbody>
          </table>
          {!fleet.data?.items.length && <p className="dx-muted">This depot has no vehicles.</p>}
        </section>
      )}
    </div>
  );
}

function VehicleRow({ vehicle, day, today, onExpired }: { vehicle: VehicleResponse; day: string; today: string; onExpired: () => void }) {
  const availability = useLoad(() => readDaily('availability', vehicle.id, day), onExpired);
  const fuel = useLoad(() => day <= today ? readDaily('fuel-usage', vehicle.id, day) : Promise.resolve(null), onExpired);
  const [litres, setLitres] = useState('');
  const [busy, setBusy] = useState<'availability' | 'fuel' | null>(null);
  const [message, setMessage] = useState<{ k: 'e' | 's' | 'w'; t: string } | null>(null);
  const sending = useRef(false);
  const [saved, setSaved] = useState<{ availability?: DailyInput<'availability'>; fuel?: DailyInput<'fuel-usage'> }>({});

  const currentAvailability = saved.availability !== undefined ? saved.availability : availability.data;
  const currentFuel = saved.fuel !== undefined ? saved.fuel : fuel.data;

  const run = async (kind: 'availability' | 'fuel', action: () => Promise<void>) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(kind);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return onExpired();
      if (error instanceof ApiError && error.status === 412) {
        // Changed elsewhere: show the current server value before anyone saves again.
        setSaved({});
        availability.reload();
        fuel.reload();
        setMessage({ k: 'w', t: `${error.detail ?? 'Daily input changed'}. The current value is shown; review it and save again.` });
      } else {
        setMessage({ k: 'e', t: failureMessage(error, 'The input') });
      }
    } finally {
      sending.current = false;
      setBusy(null);
    }
  };

  const setAvailable = (value: boolean) => run('availability', async () => {
    const next = await writeDaily('availability', vehicle.id, day, { is_available: value }, currentAvailability?.etag ?? null);
    setSaved((s) => ({ ...s, availability: next }));
    setMessage({ k: 's', t: `Saved: ${value ? 'available' : 'unavailable'}.` });
  });
  const saveFuel = () => run('fuel', async () => {
    const value = litres.trim();
    const next = await writeDaily('fuel-usage', vehicle.id, day, { fuel_used_l: value }, currentFuel?.etag ?? null);
    setSaved((s) => ({ ...s, fuel: next }));
    setLitres('');
    setMessage({ k: 's', t: `Saved: ${next?.record.fuel_used_l ?? value} L.` });
  });

  const fuelInvalid = !!litres && !validFuel(litres);
  return (
    <tr>
      <td><strong>{vehicleLabel(vehicle)}</strong><div className="dx-muted">{vehicle.type === 'van' ? 'Can serve van-only outlets' : 'Truck: not for van-only outlets'}</div></td>
      <td>{vehicle.weight_cap_kg} kg<br />{vehicle.volume_cap_m3} m³</td>
      <td>{vehicle.km_per_l} km/L<br /><span className="dx-muted">Weekly quota {vehicle.weekly_fuel_quota_l} L</span></td>
      <td>
        {availability.loading ? <Loading /> : availability.error ? <LoadError error={availability.error} retry={availability.reload} /> : (
          <>
            <div className="dx-muted">{currentAvailability ? (currentAvailability.record.is_available ? 'Recorded: available' : 'Recorded: unavailable') : 'Not recorded (unknown)'}</div>
            <div className="dx-row">
              <button className={`dx-btn ${currentAvailability?.record.is_available === true ? 'on' : ''}`} disabled={!!busy} onClick={() => setAvailable(true)}>Available</button>
              <button className={`dx-btn ${currentAvailability?.record.is_available === false ? 'on' : ''}`} disabled={!!busy} onClick={() => setAvailable(false)}>Unavailable</button>
            </div>
          </>
        )}
      </td>
      <td>
        {day > today ? <span className="dx-muted">Future date: fuel is recorded after the day.</span>
          : fuel.loading ? <Loading /> : fuel.error ? <LoadError error={fuel.error} retry={fuel.reload} /> : (
            <>
              <div className="dx-muted">{currentFuel ? `Recorded: ${currentFuel.record.fuel_used_l} L` : 'Not recorded (unknown)'}</div>
              <div className="dx-row">
                <input
                  className="dx-btn"
                  style={{ width: 110 }}
                  inputMode="decimal"
                  placeholder="e.g. 12.345"
                  aria-label="Fuel used (litres)"
                  aria-invalid={fuelInvalid}
                  value={litres}
                  onChange={(e) => setLitres(e.target.value)}
                />
                <button className="dx-btn p" disabled={!litres || fuelInvalid || !!busy} onClick={saveFuel}>
                  {busy === 'fuel' ? 'Saving…' : currentFuel ? 'Replace' : 'Record'}
                </button>
              </div>
              {fuelInvalid && <div className="dx-muted" role="alert">Use litres with up to 3 decimals, e.g. 0.000 or 12.5.</div>}
            </>
          )}
        {message && <Alert k={message.k} t={message.t} />}
      </td>
    </tr>
  );
}
