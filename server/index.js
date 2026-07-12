import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';
import { JWT_SECRET, requireAuth, requireRole } from './auth.js';

const app = express();
app.use(cors());
app.use(express.json());

const today = () => new Date().toISOString().slice(0, 10);

/* ---------------- AUTH ---------------- */
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
});

app.use('/api', requireAuth); // everything below requires login

/* ---------------- VEHICLES ---------------- */
app.get('/api/vehicles', (req, res) => {
  const { type, status, region } = req.query;
  let q = 'SELECT * FROM vehicles WHERE 1=1';
  const params = [];
  if (type) { q += ' AND type = ?'; params.push(type); }
  if (status) { q += ' AND status = ?'; params.push(status); }
  if (region) { q += ' AND region = ?'; params.push(region); }
  res.json(db.prepare(q).all(...params));
});

// vehicles eligible for dispatch (used by trip creation form)
app.get('/api/vehicles/available', (req, res) => {
  res.json(db.prepare("SELECT * FROM vehicles WHERE status = 'Available'").all());
});

app.post('/api/vehicles', requireRole('fleet_manager'), (req, res) => {
  const { reg_number, name, type, max_load_kg, odometer, acquisition_cost, region } = req.body;
  if (!reg_number || !name || !type || !max_load_kg || !acquisition_cost) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const exists = db.prepare('SELECT id FROM vehicles WHERE reg_number = ?').get(reg_number);
  if (exists) return res.status(409).json({ error: 'Registration number must be unique' });
  const info = db.prepare(`INSERT INTO vehicles (reg_number,name,type,max_load_kg,odometer,acquisition_cost,region,status)
    VALUES (?,?,?,?,?,?,?, 'Available')`).run(reg_number, name, type, max_load_kg, odometer || 0, acquisition_cost, region || 'Default');
  res.status(201).json(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/vehicles/:id', requireRole('fleet_manager'), (req, res) => {
  const id = req.params.id;
  const v = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
  if (!v) return res.status(404).json({ error: 'Vehicle not found' });
  const fields = ['name', 'type', 'max_load_kg', 'odometer', 'acquisition_cost', 'region', 'status'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  if (setClause) {
    db.prepare(`UPDATE vehicles SET ${setClause} WHERE id = ?`).run(...Object.values(updates), id);
  }
  res.json(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id));
});

app.delete('/api/vehicles/:id', requireRole('fleet_manager'), (req, res) => {
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

/* ---------------- DRIVERS ---------------- */
app.get('/api/drivers', (req, res) => {
  res.json(db.prepare('SELECT * FROM drivers').all());
});

app.get('/api/drivers/available', (req, res) => {
  const rows = db.prepare("SELECT * FROM drivers WHERE status = 'Available'").all();
  const eligible = rows.filter(d => d.license_expiry >= today());
  res.json(eligible);
});

app.post('/api/drivers', requireRole('fleet_manager', 'safety_officer'), (req, res) => {
  const { name, license_number, license_category, license_expiry, contact_number, safety_score } = req.body;
  if (!name || !license_number || !license_category || !license_expiry) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const exists = db.prepare('SELECT id FROM drivers WHERE license_number = ?').get(license_number);
  if (exists) return res.status(409).json({ error: 'License number must be unique' });
  const info = db.prepare(`INSERT INTO drivers (name,license_number,license_category,license_expiry,contact_number,safety_score,status)
    VALUES (?,?,?,?,?,?, 'Available')`).run(name, license_number, license_category, license_expiry, contact_number || '', safety_score ?? 100);
  res.status(201).json(db.prepare('SELECT * FROM drivers WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/drivers/:id', requireRole('fleet_manager', 'safety_officer'), (req, res) => {
  const id = req.params.id;
  const d = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
  if (!d) return res.status(404).json({ error: 'Driver not found' });
  const fields = ['name', 'license_category', 'license_expiry', 'contact_number', 'safety_score', 'status'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  if (setClause) db.prepare(`UPDATE drivers SET ${setClause} WHERE id = ?`).run(...Object.values(updates), id);
  res.json(db.prepare('SELECT * FROM drivers WHERE id = ?').get(id));
});

app.delete('/api/drivers/:id', requireRole('fleet_manager', 'safety_officer'), (req, res) => {
  db.prepare('DELETE FROM drivers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

/* ---------------- TRIPS ---------------- */
app.get('/api/trips', (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, v.reg_number, v.name as vehicle_name, d.name as driver_name
    FROM trips t
    JOIN vehicles v ON v.id = t.vehicle_id
    JOIN drivers d ON d.id = t.driver_id
    ORDER BY t.id DESC
  `).all();
  res.json(rows);
});

// Create trip (Draft) with full validation
app.post('/api/trips', (req, res) => {
  const { source, destination, vehicle_id, driver_id, cargo_weight, planned_distance } = req.body;
  if (!source || !destination || !vehicle_id || !driver_id || !cargo_weight || !planned_distance) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicle_id);
  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(driver_id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  if (vehicle.status === 'Retired' || vehicle.status === 'In Shop') {
    return res.status(400).json({ error: 'Retired or In Shop vehicles cannot be dispatched' });
  }
  if (vehicle.status === 'On Trip') {
    return res.status(400).json({ error: 'Vehicle is already on a trip' });
  }
  if (driver.status === 'Suspended') {
    return res.status(400).json({ error: 'Driver is suspended and cannot be assigned' });
  }
  if (driver.license_expiry < today()) {
    return res.status(400).json({ error: 'Driver license has expired' });
  }
  if (driver.status === 'On Trip') {
    return res.status(400).json({ error: 'Driver is already on a trip' });
  }
  if (cargo_weight > vehicle.max_load_kg) {
    return res.status(400).json({ error: `Cargo weight (${cargo_weight}kg) exceeds vehicle max load (${vehicle.max_load_kg}kg)` });
  }

  const info = db.prepare(`INSERT INTO trips (source,destination,vehicle_id,driver_id,cargo_weight,planned_distance,status)
    VALUES (?,?,?,?,?,?, 'Draft')`).run(source, destination, vehicle_id, driver_id, cargo_weight, planned_distance);
  res.status(201).json(db.prepare('SELECT * FROM trips WHERE id = ?').get(info.lastInsertRowid));
});

// Dispatch a Draft trip
app.post('/api/trips/:id/dispatch', (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (trip.status !== 'Draft') return res.status(400).json({ error: 'Only Draft trips can be dispatched' });

  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(trip.vehicle_id);
  const driver = db.prepare('SELECT * FROM drivers WHERE id = ?').get(trip.driver_id);
  if (vehicle.status !== 'Available') return res.status(400).json({ error: 'Vehicle is no longer Available' });
  if (driver.status !== 'Available') return res.status(400).json({ error: 'Driver is no longer Available' });
  if (driver.license_expiry < today()) return res.status(400).json({ error: 'Driver license has expired' });

  const tx = db.transaction(() => {
    db.prepare("UPDATE trips SET status = 'Dispatched' WHERE id = ?").run(trip.id);
    db.prepare("UPDATE vehicles SET status = 'On Trip' WHERE id = ?").run(trip.vehicle_id);
    db.prepare("UPDATE drivers SET status = 'On Trip' WHERE id = ?").run(trip.driver_id);
  });
  tx();
  res.json(db.prepare('SELECT * FROM trips WHERE id = ?').get(trip.id));
});

// Complete a Dispatched trip
app.post('/api/trips/:id/complete', (req, res) => {
  const { actual_distance, fuel_consumed } = req.body;
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (trip.status !== 'Dispatched') return res.status(400).json({ error: 'Only Dispatched trips can be completed' });

  const tx = db.transaction(() => {
    db.prepare("UPDATE trips SET status = 'Completed', actual_distance = ?, fuel_consumed = ? WHERE id = ?")
      .run(actual_distance || trip.planned_distance, fuel_consumed || 0, trip.id);
    db.prepare("UPDATE vehicles SET status = 'Available', odometer = odometer + ? WHERE id = ?")
      .run(actual_distance || trip.planned_distance, trip.vehicle_id);
    db.prepare("UPDATE drivers SET status = 'Available' WHERE id = ?").run(trip.driver_id);
    if (fuel_consumed) {
      db.prepare("INSERT INTO fuel_logs (vehicle_id, liters, cost, date) VALUES (?,?,?,?)")
        .run(trip.vehicle_id, fuel_consumed, 0, today());
    }
  });
  tx();
  res.json(db.prepare('SELECT * FROM trips WHERE id = ?').get(trip.id));
});

// Cancel a Draft or Dispatched trip
app.post('/api/trips/:id/cancel', (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (!['Draft', 'Dispatched'].includes(trip.status)) {
    return res.status(400).json({ error: 'Only Draft or Dispatched trips can be cancelled' });
  }
  const wasDispatched = trip.status === 'Dispatched';
  const tx = db.transaction(() => {
    db.prepare("UPDATE trips SET status = 'Cancelled' WHERE id = ?").run(trip.id);
    if (wasDispatched) {
      db.prepare("UPDATE vehicles SET status = 'Available' WHERE id = ?").run(trip.vehicle_id);
      db.prepare("UPDATE drivers SET status = 'Available' WHERE id = ?").run(trip.driver_id);
    }
  });
  tx();
  res.json(db.prepare('SELECT * FROM trips WHERE id = ?').get(trip.id));
});

/* ---------------- MAINTENANCE ---------------- */
app.get('/api/maintenance', (req, res) => {
  res.json(db.prepare(`
    SELECT m.*, v.reg_number, v.name as vehicle_name FROM maintenance_logs m
    JOIN vehicles v ON v.id = m.vehicle_id ORDER BY m.id DESC
  `).all());
});

app.post('/api/maintenance', requireRole('fleet_manager'), (req, res) => {
  const { vehicle_id, description, cost } = req.body;
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicle_id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  if (vehicle.status === 'On Trip') return res.status(400).json({ error: 'Cannot service a vehicle currently On Trip' });

  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO maintenance_logs (vehicle_id, description, cost, status) VALUES (?,?,?, 'Active')`)
      .run(vehicle_id, description || 'Maintenance', cost || 0);
    db.prepare("UPDATE vehicles SET status = 'In Shop' WHERE id = ?").run(vehicle_id);
    return info.lastInsertRowid;
  });
  const id = tx();
  res.status(201).json(db.prepare('SELECT * FROM maintenance_logs WHERE id = ?').get(id));
});

app.post('/api/maintenance/:id/close', requireRole('fleet_manager'), (req, res) => {
  const log = db.prepare('SELECT * FROM maintenance_logs WHERE id = ?').get(req.params.id);
  if (!log) return res.status(404).json({ error: 'Maintenance record not found' });
  if (log.status === 'Closed') return res.status(400).json({ error: 'Already closed' });

  const tx = db.transaction(() => {
    db.prepare("UPDATE maintenance_logs SET status = 'Closed', closed_at = ? WHERE id = ?").run(today(), log.id);
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(log.vehicle_id);
    if (vehicle.status !== 'Retired') {
      db.prepare("UPDATE vehicles SET status = 'Available' WHERE id = ?").run(log.vehicle_id);
    }
  });
  tx();
  res.json(db.prepare('SELECT * FROM maintenance_logs WHERE id = ?').get(log.id));
});

/* ---------------- FUEL LOGS ---------------- */
app.get('/api/fuel-logs', (req, res) => {
  res.json(db.prepare(`
    SELECT f.*, v.reg_number FROM fuel_logs f JOIN vehicles v ON v.id = f.vehicle_id ORDER BY f.id DESC
  `).all());
});

app.post('/api/fuel-logs', (req, res) => {
  const { vehicle_id, liters, cost, date } = req.body;
  if (!vehicle_id || !liters || !cost) return res.status(400).json({ error: 'Missing required fields' });
  const info = db.prepare('INSERT INTO fuel_logs (vehicle_id, liters, cost, date) VALUES (?,?,?,?)')
    .run(vehicle_id, liters, cost, date || today());
  res.status(201).json(db.prepare('SELECT * FROM fuel_logs WHERE id = ?').get(info.lastInsertRowid));
});

/* ---------------- EXPENSES ---------------- */
app.get('/api/expenses', (req, res) => {
  res.json(db.prepare(`
    SELECT e.*, v.reg_number FROM expenses e JOIN vehicles v ON v.id = e.vehicle_id ORDER BY e.id DESC
  `).all());
});

app.post('/api/expenses', (req, res) => {
  const { vehicle_id, type, amount, date } = req.body;
  if (!vehicle_id || !type || !amount) return res.status(400).json({ error: 'Missing required fields' });
  const info = db.prepare('INSERT INTO expenses (vehicle_id, type, amount, date) VALUES (?,?,?,?)')
    .run(vehicle_id, type, amount, date || today());
  res.status(201).json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid));
});

/* ---------------- DASHBOARD ---------------- */
app.get('/api/dashboard', (req, res) => {
  const vehicles = db.prepare('SELECT * FROM vehicles').all();
  const drivers = db.prepare('SELECT * FROM drivers').all();
  const trips = db.prepare('SELECT * FROM trips').all();

  const activeVehicles = vehicles.filter(v => v.status !== 'Retired').length;
  const availableVehicles = vehicles.filter(v => v.status === 'Available').length;
  const inMaintenance = vehicles.filter(v => v.status === 'In Shop').length;
  const activeTrips = trips.filter(t => t.status === 'Dispatched').length;
  const pendingTrips = trips.filter(t => t.status === 'Draft').length;
  const driversOnDuty = drivers.filter(d => d.status === 'On Trip').length;
  const utilization = vehicles.length ? Math.round((vehicles.filter(v => v.status === 'On Trip').length / vehicles.length) * 100) : 0;

  res.json({
    activeVehicles, availableVehicles, inMaintenance,
    activeTrips, pendingTrips, driversOnDuty,
    fleetUtilization: utilization
  });
});

/* ---------------- REPORTS ---------------- */
app.get('/api/reports', (req, res) => {
  const vehicles = db.prepare('SELECT * FROM vehicles').all();
  const report = vehicles.map(v => {
    const fuelRows = db.prepare('SELECT * FROM fuel_logs WHERE vehicle_id = ?').all(v.id);
    const maintRows = db.prepare("SELECT * FROM maintenance_logs WHERE vehicle_id = ?").all(v.id);
    const expenseRows = db.prepare('SELECT * FROM expenses WHERE vehicle_id = ?').all(v.id);
    const completedTrips = db.prepare("SELECT * FROM trips WHERE vehicle_id = ? AND status = 'Completed'").all(v.id);

    const totalFuelLiters = fuelRows.reduce((s, f) => s + f.liters, 0);
    const totalFuelCost = fuelRows.reduce((s, f) => s + f.cost, 0);
    const totalMaintCost = maintRows.reduce((s, m) => s + m.cost, 0);
    const totalExpenses = expenseRows.reduce((s, e) => s + e.amount, 0);
    const totalDistance = completedTrips.reduce((s, t) => s + (t.actual_distance || 0), 0);

    const fuelEfficiency = totalFuelLiters > 0 ? +(totalDistance / totalFuelLiters).toFixed(2) : null;
    const operationalCost = totalFuelCost + totalMaintCost + totalExpenses;
    // Revenue is not tracked as an entity in the spec; approximate as 0 unless expenses table has a 'revenue' type
    const revenueRows = expenseRows.filter(e => e.type.toLowerCase() === 'revenue');
    const revenue = revenueRows.reduce((s, e) => s + e.amount, 0);
    const roi = v.acquisition_cost > 0 ? +(((revenue - (totalMaintCost + totalFuelCost)) / v.acquisition_cost) * 100).toFixed(2) : null;

    return {
      vehicle_id: v.id,
      reg_number: v.reg_number,
      name: v.name,
      fuelEfficiency,
      totalDistance,
      totalFuelCost,
      totalMaintCost,
      totalExpenses,
      operationalCost,
      roi
    };
  });
  res.json(report);
});

app.get('/api/reports/export.csv', (req, res) => {
  const vehicles = db.prepare('SELECT * FROM vehicles').all();
  let csv = 'reg_number,name,fuel_efficiency_km_per_l,operational_cost,roi_percent\n';
  vehicles.forEach(v => {
    const fuelRows = db.prepare('SELECT * FROM fuel_logs WHERE vehicle_id = ?').all(v.id);
    const maintRows = db.prepare('SELECT * FROM maintenance_logs WHERE vehicle_id = ?').all(v.id);
    const totalFuelLiters = fuelRows.reduce((s, f) => s + f.liters, 0);
    const totalFuelCost = fuelRows.reduce((s, f) => s + f.cost, 0);
    const totalMaintCost = maintRows.reduce((s, m) => s + m.cost, 0);
    const completedTrips = db.prepare("SELECT * FROM trips WHERE vehicle_id = ? AND status = 'Completed'").all(v.id);
    const totalDistance = completedTrips.reduce((s, t) => s + (t.actual_distance || 0), 0);
    const fuelEfficiency = totalFuelLiters > 0 ? (totalDistance / totalFuelLiters).toFixed(2) : '';
    const operationalCost = totalFuelCost + totalMaintCost;
    csv += `${v.reg_number},${v.name},${fuelEfficiency},${operationalCost},\n`;
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="transitops_report.csv"');
  res.send(csv);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`TransitOps API running on http://localhost:${PORT}`));
