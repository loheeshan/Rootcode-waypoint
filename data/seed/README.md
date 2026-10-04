# Seed data

Place approved competition seed files here. No real customer data or credentials
are included. Competition dataset import remains future work.

Four demo role accounts are available through the explicit
[account seed command](../../apps/api/app/auth/README.md#create-demo-accounts).
It prompts for a password and preserves existing accounts on repeat runs. It does
not read customer data or credentials from this directory.

## Synthetic integration fixture

After creating the accounts, use the
[resource seed command](../../apps/api/app/fleet/README.md#synthetic-demo-data):

```powershell
docker compose exec api python -m app.fleet.seed --demo
```

The fixture is defined in `apps/api/app/fleet/seed.py` and is independent of files
in this directory. These are invented development examples, not real fleet data.

| Resource | Values |
|---|---|
| Depot | Waypoint Demo Depot |
| Store outlet | Waypoint Demo Store, Colombo, ground dock, no parking restriction, 08:00–18:00 |
| Mall outlet | Waypoint Demo Mall, Colombo, loading bay, van only, 09:00–11:00, mall window enabled |
| Reefer van | 1,200 kg, 8 m³, 8 km/l, 120 l weekly fuel quota |
| Ambient truck | 5,000 kg, 30 m³, 5 km/l, 250 l weekly fuel quota |

Both outlets and vehicles belong to the demo depot. Times use Asia/Colombo.

| Demo account | Added resource assignment |
|---|---|
| `store@waypoint.demo` | Demo store outlet only |
| `dispatcher@waypoint.demo` | Demo depot |
| `loader@waypoint.demo` | Demo depot |
| `driver@waypoint.demo` | Demo depot; no trip assignment |

The command prints the fixed store/depot IDs; login and `/me` also return them.
Repeated runs preserve matching data and add any missing demo assignments.
Conflicting fixed-ID rows, missing accounts, inactive accounts or missing
expected roles stop the operation without partial writes. Existing passwords,
roles, unrelated data and unrelated grants are preserved. No orders are created.

## Synthetic route input snapshot

`route-inputs.synthetic.json` is a standalone routing example approved for demo
development. Every distance, travel/service time and fuel balance is invented.
The `is_synthetic: true` flag and source label propagate into scheduler results.
It is **not a road dataset** and its IDs are not the existing database demo-seed
IDs. It does not insert orders, set availability, record actual consumption or
reserve fuel. No external maps service is contacted.

The example has two outlet windows, one vehicle, two illustrative order mappings
and all six directed legs between the depot and outlets. Reverse journeys have
separate values. It is dated 2026-10-05 deliberately for repeatable tests; it is
not a live snapshot. Import with `app.planning.route_inputs.load_route_inputs(path)`.
The input format and integration limitations are documented in the
[route scheduler guide](../../apps/api/app/planning/README.md#route-scheduling-and-input-import).

From `apps/api`, `uv run pytest -q tests/test_routing.py` runs the example and the
route constraints tests. The future optimizer API must obtain real scoped master
data and fresh usage/reservation totals separately before publishing any route.
