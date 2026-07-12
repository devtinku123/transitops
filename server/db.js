import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const db = new Database('transitops.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('fleet_manager','driver','safety_officer','financial_analyst'))
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reg_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  max_load_kg REAL NOT NULL,
  odometer REAL DEFAULT 0,
  acquisition_cost REAL NOT NULL,
  region TEXT DEFAULT 'Default',
  status TEXT NOT NULL DEFAULT 'Available' CHECK(status IN ('Available','On Trip','In Shop','Retired'))
);

CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  license_number TEXT UNIQUE NOT NULL,
  license_category TEXT NOT NULL,
  license_expiry TEXT NOT NULL,
  contact_number TEXT,
  safety_score REAL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'Available' CHECK(status IN ('Available','On Trip','Off Duty','Suspended'))
);

CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  destination TEXT NOT NULL,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  driver_id INTEGER NOT NULL REFERENCES drivers(id),
  cargo_weight REAL NOT NULL,
  planned_distance REAL NOT NULL,
  actual_distance REAL,
  fuel_consumed REAL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Dispatched','Completed','Cancelled')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  description TEXT NOT NULL,
  cost REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Closed')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS fuel_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  liters REAL NOT NULL,
  cost REAL NOT NULL,
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL
);
`);

// Seed demo data only if empty
const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
if (userCount === 0) {
  const insertUser = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)');
  const pass = bcrypt.hashSync('password123', 8);
  insertUser.run('Fleet Manager', 'manager@transitops.com', pass, 'fleet_manager');
  insertUser.run('Driver Dispatcher', 'dispatch@transitops.com', pass, 'driver');
  insertUser.run('Safety Officer', 'safety@transitops.com', pass, 'safety_officer');
  insertUser.run('Financial Analyst', 'finance@transitops.com', pass, 'financial_analyst');

  const insertVehicle = db.prepare(`INSERT INTO vehicles (reg_number,name,type,max_load_kg,odometer,acquisition_cost,region,status) VALUES (?,?,?,?,?,?,?,?)`);
  insertVehicle.run('VAN-05', 'Tata Ace', 'Van', 500, 12000, 800000, 'South', 'Available');
  insertVehicle.run('TRK-11', 'Ashok Leyland Dost', 'Truck', 2000, 45000, 1500000, 'North', 'Available');
  insertVehicle.run('VAN-09', 'Mahindra Supro', 'Van', 700, 30000, 900000, 'South', 'Available');

  const insertDriver = db.prepare(`INSERT INTO drivers (name,license_number,license_category,license_expiry,contact_number,safety_score,status) VALUES (?,?,?,?,?,?,?)`);
  insertDriver.run('Alex Kumar', 'DL-1001', 'LMV', '2027-06-30', '9990001111', 95, 'Available');
  insertDriver.run('Priya Singh', 'DL-1002', 'HMV', '2026-08-15', '9990002222', 88, 'Available');
  insertDriver.run('Ravi Teja', 'DL-1003', 'LMV', '2025-01-01', '9990003333', 70, 'Available'); // expired license demo
}

export default db;
