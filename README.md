# TransitOps — Smart Transport Operations Platform For ODOO Hackathon

Full-stack fleet ops app: vehicles, drivers, trips, maintenance, fuel/expenses,
dashboard KPIs, and reports. Built for the 8-hour hackathon brief.

## Stack
- **Backend:** Node.js + Express + better-sqlite3 (zero-setup embedded DB) + JWT auth
- **Frontend:** React + Vite + Tailwind + Recharts

## Run it (2 terminals)

### 1. Backend
```bash
cd server
npm install
npm run dev
```
Runs on http://localhost:4000. DB file `transitops.db` is created automatically
with seed data on first run.

### 2. Frontend
```bash
cd client
npm install
npm run dev
```
Runs on http://localhost:5173 and proxies `/api` calls to the backend.

## Demo logins
Password for all: `password123`
- manager@transitops.com — Fleet Manager
- dispatch@transitops.com — Driver
- safety@transitops.com — Safety Officer
- finance@transitops.com — Financial Analyst

## Seed data
- 3 vehicles (VAN-05, TRK-11, VAN-09)
- 3 drivers — note "Ravi Teja" has an **expired license** (2025-01-01) to demo
  the validation rule live during your walkthrough.

## Business rules implemented (all mandatory ones from the spec)
- Registration number uniqueness enforced at DB + API level
- Retired / In Shop vehicles excluded from dispatch selection (`/api/vehicles/available`)
- Suspended or license-expired drivers excluded from assignment (`/api/drivers/available`)
  and blocked server-side even if someone bypasses the UI
- Vehicle/driver already "On Trip" cannot be double-booked
- Cargo weight vs max load capacity validated on trip creation
- Dispatch → both vehicle & driver flip to "On Trip" (single DB transaction)
- Complete → both flip back to "Available", odometer updates, optional fuel log auto-created
- Cancel (Draft or Dispatched) → restores vehicle/driver to "Available"
- Creating maintenance → vehicle auto → "In Shop"; closing → back to "Available"
  (unless Retired)
- Dashboard KPIs: Active/Available/In-Shop vehicles, Active/Pending trips,
  Drivers on duty, Fleet Utilization %
- Reports: Fuel Efficiency (km/L), Operational Cost (fuel+maintenance+expenses),
  ROI, CSV export

## What's cut for time (bonus features from the brief)
PDF export, email reminders for expiring licenses, document management, dark
mode toggle (app is dark-themed by default so this is partially covered),
advanced search/sort. Call these out explicitly in your pitch as "next up"
rather than pretending they're done.

## Demo script (matches the brief's example workflow)
1. Log in as Fleet Manager → register a vehicle if you want a fresh one
2. Go to Trips → create a trip with cargo under the vehicle's max load → Dispatch
3. Show vehicle/driver status flip to "On Trip" on their respective pages
4. Complete the trip with actual distance + fuel consumed
5. Create a Maintenance record on that vehicle → show it vanish from the
   available-vehicles dropdown on Trips
6. Close the maintenance record → vehicle available again
7. Show Reports page: fuel efficiency + operational cost + CSV export
8. Try creating a trip with cargo over the limit, or with the expired-license
   driver (Ravi Teja) → show the validation error live
