import React, { useEffect, useState, useCallback } from 'react';
import { api, getToken } from './api.js';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';

/* ---------------------------- STATUS BADGE ---------------------------- */
const STATUS_COLORS = {
  Available: 'bg-ok/20 text-ok',
  'On Trip': 'bg-accent/20 text-accent',
  'In Shop': 'bg-warn/20 text-warn',
  Retired: 'bg-white/10 text-slate-400',
  'Off Duty': 'bg-white/10 text-slate-400',
  Suspended: 'bg-danger/20 text-danger',
  Draft: 'bg-white/10 text-slate-300',
  Dispatched: 'bg-accent/20 text-accent',
  Completed: 'bg-ok/20 text-ok',
  Cancelled: 'bg-danger/20 text-danger',
  Active: 'bg-warn/20 text-warn',
  Closed: 'bg-ok/20 text-ok'
};
function Badge({ status }) {
  return <span className={`badge ${STATUS_COLORS[status] || 'bg-white/10 text-slate-300'}`}>{status}</span>;
}

/* ------------------------------- LOGIN -------------------------------- */
function Login({ onLogin }) {
  const [email, setEmail] = useState('manager@transitops.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(email, password);
      localStorage.setItem('transitops_token', data.token);
      localStorage.setItem('transitops_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold tracking-tight">TransitOps</div>
          <div className="text-slate-400 text-sm mt-1">Smart Transport Operations Platform</div>
        </div>
        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Email</label>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} type="email" required />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Password</label>
            <input className="input" value={password} onChange={e => setPassword(e.target.value)} type="password" required />
          </div>
          {error && <div className="text-danger text-sm">{error}</div>}
          <button className="btn btn-primary w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
          <div className="text-xs text-slate-500 pt-2 border-t border-white/5">
            Demo accounts (password: <span className="text-slate-300">password123</span>):<br />
            manager@transitops.com · dispatch@transitops.com · safety@transitops.com · finance@transitops.com
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------ DASHBOARD ------------------------------ */
function Dashboard() {
  const [kpi, setKpi] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);

  const load = useCallback(async () => {
    const [k, v, t] = await Promise.all([api.dashboard(), api.vehicles(), api.trips()]);
    setKpi(k); setVehicles(v); setTrips(t);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!kpi) return <div className="text-slate-400">Loading dashboard...</div>;

  const cards = [
    ['Active Vehicles', kpi.activeVehicles],
    ['Available Vehicles', kpi.availableVehicles],
    ['In Maintenance', kpi.inMaintenance],
    ['Active Trips', kpi.activeTrips],
    ['Pending Trips', kpi.pendingTrips],
    ['Drivers On Duty', kpi.driversOnDuty],
    ['Fleet Utilization', `${kpi.fleetUtilization}%`]
  ];

  const statusCounts = ['Available', 'On Trip', 'In Shop', 'Retired'].map(s => ({
    name: s, value: vehicles.filter(v => v.status === s).length
  }));
  const PIE_COLORS = ['#22C55E', '#3E7BFA', '#F59E0B', '#64748B'];

  const tripStatusData = ['Draft', 'Dispatched', 'Completed', 'Cancelled'].map(s => ({
    name: s, count: trips.filter(t => t.status === s).length
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(([label, value]) => (
          <div key={label} className="card">
            <div className="text-slate-400 text-xs uppercase tracking-wide">{label}</div>
            <div className="text-3xl font-bold mt-1">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <div className="font-semibold mb-4">Fleet Status Breakdown</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusCounts} dataKey="value" nameKey="name" outerRadius={80} label>
                {statusCounts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="font-semibold mb-4">Trips by Status</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={tripStatusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#171A22', border: '1px solid #ffffff20' }} />
              <Bar dataKey="count" fill="#3E7BFA" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ VEHICLES ------------------------------ */
function Vehicles({ user }) {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ reg_number: '', name: '', type: '', max_load_kg: '', acquisition_cost: '', region: '' });
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => setVehicles(await api.vehicles()), []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createVehicle(form);
      setForm({ reg_number: '', name: '', type: '', max_load_kg: '', acquisition_cost: '', region: '' });
      setShowForm(false);
      load();
    } catch (err) { setError(err.message); }
  };

  const retire = async (v) => {
    await api.updateVehicle(v.id, { status: 'Retired' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-xl font-semibold">Vehicle Registry</div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancel' : '+ Register Vehicle'}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid md:grid-cols-3 gap-3">
          <input className="input" placeholder="Reg Number (e.g. VAN-12)" value={form.reg_number} onChange={e => setForm({ ...form, reg_number: e.target.value })} required />
          <input className="input" placeholder="Name/Model" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Type (Van/Truck)" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} required />
          <input className="input" type="number" placeholder="Max Load (kg)" value={form.max_load_kg} onChange={e => setForm({ ...form, max_load_kg: e.target.value })} required />
          <input className="input" type="number" placeholder="Acquisition Cost" value={form.acquisition_cost} onChange={e => setForm({ ...form, acquisition_cost: e.target.value })} required />
          <input className="input" placeholder="Region" value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} />
          {error && <div className="text-danger text-sm md:col-span-3">{error}</div>}
          <button className="btn btn-primary md:col-span-3">Save Vehicle</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead><tr>
            <th>Reg No</th><th>Name</th><th>Type</th><th>Max Load</th><th>Odometer</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {vehicles.map(v => (
              <tr key={v.id}>
                <td className="font-medium">{v.reg_number}</td>
                <td>{v.name}</td>
                <td>{v.type}</td>
                <td>{v.max_load_kg} kg</td>
                <td>{v.odometer} km</td>
                <td><Badge status={v.status} /></td>
                <td>
                  {v.status !== 'Retired' && (
                    <button className="text-xs text-danger hover:underline" onClick={() => retire(v)}>Retire</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------- DRIVERS ------------------------------- */
function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({ name: '', license_number: '', license_category: '', license_expiry: '', contact_number: '' });
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => setDrivers(await api.drivers()), []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createDriver(form);
      setForm({ name: '', license_number: '', license_category: '', license_expiry: '', contact_number: '' });
      setShowForm(false);
      load();
    } catch (err) { setError(err.message); }
  };

  const setStatus = async (d, status) => { await api.updateDriver(d.id, { status }); load(); };
  const isExpired = (d) => d.license_expiry < new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-xl font-semibold">Driver Management</div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancel' : '+ Add Driver'}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid md:grid-cols-3 gap-3">
          <input className="input" placeholder="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="License Number" value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} required />
          <input className="input" placeholder="License Category (LMV/HMV)" value={form.license_category} onChange={e => setForm({ ...form, license_category: e.target.value })} required />
          <input className="input" type="date" value={form.license_expiry} onChange={e => setForm({ ...form, license_expiry: e.target.value })} required />
          <input className="input" placeholder="Contact Number" value={form.contact_number} onChange={e => setForm({ ...form, contact_number: e.target.value })} />
          {error && <div className="text-danger text-sm md:col-span-3">{error}</div>}
          <button className="btn btn-primary md:col-span-3">Save Driver</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead><tr>
            <th>Name</th><th>License #</th><th>Category</th><th>Expiry</th><th>Safety Score</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {drivers.map(d => (
              <tr key={d.id}>
                <td className="font-medium">{d.name}</td>
                <td>{d.license_number}</td>
                <td>{d.license_category}</td>
                <td className={isExpired(d) ? 'text-danger' : ''}>{d.license_expiry}{isExpired(d) ? ' (expired)' : ''}</td>
                <td>{d.safety_score}</td>
                <td><Badge status={d.status} /></td>
                <td className="space-x-2 whitespace-nowrap">
                  {d.status !== 'Suspended' ? (
                    <button className="text-xs text-danger hover:underline" onClick={() => setStatus(d, 'Suspended')}>Suspend</button>
                  ) : (
                    <button className="text-xs text-ok hover:underline" onClick={() => setStatus(d, 'Available')}>Reinstate</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- TRIPS -------------------------------- */
function Trips() {
  const [trips, setTrips] = useState([]);
  const [availVehicles, setAvailVehicles] = useState([]);
  const [availDrivers, setAvailDrivers] = useState([]);
  const [form, setForm] = useState({ source: '', destination: '', vehicle_id: '', driver_id: '', cargo_weight: '', planned_distance: '' });
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [completeForm, setCompleteForm] = useState({ actual_distance: '', fuel_consumed: '' });

  const load = useCallback(async () => {
    const [t, v, d] = await Promise.all([api.trips(), api.availableVehicles(), api.availableDrivers()]);
    setTrips(t); setAvailVehicles(v); setAvailDrivers(d);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createTrip(form);
      setForm({ source: '', destination: '', vehicle_id: '', driver_id: '', cargo_weight: '', planned_distance: '' });
      setShowForm(false);
      load();
    } catch (err) { setError(err.message); }
  };

  const dispatch = async (id) => {
    try { await api.dispatchTrip(id); load(); } catch (err) { alert(err.message); }
  };
  const cancel = async (id) => {
    try { await api.cancelTrip(id); load(); } catch (err) { alert(err.message); }
  };
  const complete = async (id) => {
    try {
      await api.completeTrip(id, {
        actual_distance: Number(completeForm.actual_distance) || undefined,
        fuel_consumed: Number(completeForm.fuel_consumed) || undefined
      });
      setCompletingId(null);
      setCompleteForm({ actual_distance: '', fuel_consumed: '' });
      load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-xl font-semibold">Trip Management</div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancel' : '+ Create Trip'}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid md:grid-cols-3 gap-3">
          <input className="input" placeholder="Source" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} required />
          <input className="input" placeholder="Destination" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} required />
          <input className="input" type="number" placeholder="Planned Distance (km)" value={form.planned_distance} onChange={e => setForm({ ...form, planned_distance: e.target.value })} required />
          <select className="input" value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })} required>
            <option value="">Select Available Vehicle</option>
            {availVehicles.map(v => <option key={v.id} value={v.id}>{v.reg_number} ({v.max_load_kg}kg max)</option>)}
          </select>
          <select className="input" value={form.driver_id} onChange={e => setForm({ ...form, driver_id: e.target.value })} required>
            <option value="">Select Available Driver</option>
            {availDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input className="input" type="number" placeholder="Cargo Weight (kg)" value={form.cargo_weight} onChange={e => setForm({ ...form, cargo_weight: e.target.value })} required />
          {error && <div className="text-danger text-sm md:col-span-3">{error}</div>}
          <button className="btn btn-primary md:col-span-3">Create Trip (Draft)</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead><tr>
            <th>Route</th><th>Vehicle</th><th>Driver</th><th>Cargo</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {trips.map(t => (
              <tr key={t.id}>
                <td>{t.source} → {t.destination}</td>
                <td>{t.reg_number}</td>
                <td>{t.driver_name}</td>
                <td>{t.cargo_weight} kg</td>
                <td><Badge status={t.status} /></td>
                <td className="space-x-2 whitespace-nowrap">
                  {t.status === 'Draft' && <button className="text-xs text-accent hover:underline" onClick={() => dispatch(t.id)}>Dispatch</button>}
                  {t.status === 'Dispatched' && completingId !== t.id && (
                    <button className="text-xs text-ok hover:underline" onClick={() => setCompletingId(t.id)}>Complete</button>
                  )}
                  {(t.status === 'Draft' || t.status === 'Dispatched') && (
                    <button className="text-xs text-danger hover:underline" onClick={() => cancel(t.id)}>Cancel</button>
                  )}
                  {completingId === t.id && (
                    <span className="inline-flex gap-1 items-center">
                      <input className="input w-24 inline" placeholder="km" value={completeForm.actual_distance} onChange={e => setCompleteForm({ ...completeForm, actual_distance: e.target.value })} />
                      <input className="input w-24 inline" placeholder="fuel L" value={completeForm.fuel_consumed} onChange={e => setCompleteForm({ ...completeForm, fuel_consumed: e.target.value })} />
                      <button className="text-xs text-ok hover:underline" onClick={() => complete(t.id)}>Save</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------- MAINTENANCE ----------------------------- */
function Maintenance() {
  const [logs, setLogs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ vehicle_id: '', description: '', cost: '' });
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const [l, v] = await Promise.all([api.maintenance(), api.vehicles()]);
    setLogs(l); setVehicles(v);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createMaintenance(form);
      setForm({ vehicle_id: '', description: '', cost: '' });
      setShowForm(false);
      load();
    } catch (err) { setError(err.message); }
  };

  const close = async (id) => { await api.closeMaintenance(id); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-xl font-semibold">Maintenance Log</div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancel' : '+ New Record'}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid md:grid-cols-3 gap-3">
          <select className="input" value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })} required>
            <option value="">Select Vehicle</option>
            {vehicles.filter(v => v.status !== 'On Trip' && v.status !== 'Retired').map(v => (
              <option key={v.id} value={v.id}>{v.reg_number}</option>
            ))}
          </select>
          <input className="input" placeholder="Description (e.g. Oil Change)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
          <input className="input" type="number" placeholder="Cost" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} required />
          {error && <div className="text-danger text-sm md:col-span-3">{error}</div>}
          <button className="btn btn-primary md:col-span-3">Save (moves vehicle to In Shop)</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead><tr><th>Vehicle</th><th>Description</th><th>Cost</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td>{l.reg_number}</td>
                <td>{l.description}</td>
                <td>₹{l.cost}</td>
                <td><Badge status={l.status} /></td>
                <td>{l.status === 'Active' && <button className="text-xs text-ok hover:underline" onClick={() => close(l.id)}>Close (restore vehicle)</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------- FUEL & EXPENSES --------------------------- */
function FuelExpenses() {
  const [fuel, setFuel] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [fuelForm, setFuelForm] = useState({ vehicle_id: '', liters: '', cost: '', date: '' });
  const [expForm, setExpForm] = useState({ vehicle_id: '', type: '', amount: '', date: '' });

  const load = useCallback(async () => {
    const [f, e, v] = await Promise.all([api.fuelLogs(), api.expenses(), api.vehicles()]);
    setFuel(f); setExpenses(e); setVehicles(v);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submitFuel = async (e) => { e.preventDefault(); await api.createFuelLog(fuelForm); setFuelForm({ vehicle_id: '', liters: '', cost: '', date: '' }); load(); };
  const submitExpense = async (e) => { e.preventDefault(); await api.createExpense(expForm); setExpForm({ vehicle_id: '', type: '', amount: '', date: '' }); load(); };

  return (
    <div className="space-y-6">
      <div className="text-xl font-semibold">Fuel & Expense Management</div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <div className="font-semibold mb-3">Log Fuel</div>
          <form onSubmit={submitFuel} className="space-y-2">
            <select className="input" value={fuelForm.vehicle_id} onChange={e => setFuelForm({ ...fuelForm, vehicle_id: e.target.value })} required>
              <option value="">Vehicle</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.reg_number}</option>)}
            </select>
            <input className="input" type="number" placeholder="Liters" value={fuelForm.liters} onChange={e => setFuelForm({ ...fuelForm, liters: e.target.value })} required />
            <input className="input" type="number" placeholder="Cost" value={fuelForm.cost} onChange={e => setFuelForm({ ...fuelForm, cost: e.target.value })} required />
            <input className="input" type="date" value={fuelForm.date} onChange={e => setFuelForm({ ...fuelForm, date: e.target.value })} />
            <button className="btn btn-primary w-full">Add Fuel Log</button>
          </form>
        </div>
        <div className="card">
          <div className="font-semibold mb-3">Log Expense (toll, misc)</div>
          <form onSubmit={submitExpense} className="space-y-2">
            <select className="input" value={expForm.vehicle_id} onChange={e => setExpForm({ ...expForm, vehicle_id: e.target.value })} required>
              <option value="">Vehicle</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.reg_number}</option>)}
            </select>
            <input className="input" placeholder="Type (Toll, Parking, Revenue...)" value={expForm.type} onChange={e => setExpForm({ ...expForm, type: e.target.value })} required />
            <input className="input" type="number" placeholder="Amount" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} required />
            <input className="input" type="date" value={expForm.date} onChange={e => setExpForm({ ...expForm, date: e.target.value })} />
            <button className="btn btn-primary w-full">Add Expense</button>
          </form>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card overflow-x-auto">
          <div className="font-semibold mb-2">Fuel Logs</div>
          <table className="data-table w-full">
            <thead><tr><th>Vehicle</th><th>Liters</th><th>Cost</th><th>Date</th></tr></thead>
            <tbody>{fuel.map(f => <tr key={f.id}><td>{f.reg_number}</td><td>{f.liters}</td><td>₹{f.cost}</td><td>{f.date}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="card overflow-x-auto">
          <div className="font-semibold mb-2">Expenses</div>
          <table className="data-table w-full">
            <thead><tr><th>Vehicle</th><th>Type</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>{expenses.map(e => <tr key={e.id}><td>{e.reg_number}</td><td>{e.type}</td><td>₹{e.amount}</td><td>{e.date}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- REPORTS ------------------------------- */
function Reports() {
  const [rows, setRows] = useState([]);
  const load = useCallback(async () => setRows(await api.reports()), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-xl font-semibold">Reports & Analytics</div>
        <a className="btn btn-ghost" href={api.exportCsvUrl()} target="_blank" rel="noreferrer">Export CSV</a>
      </div>

      <div className="card">
        <div className="font-semibold mb-4">Operational Cost by Vehicle</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="reg_number" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip contentStyle={{ background: '#171A22', border: '1px solid #ffffff20' }} />
            <Bar dataKey="operationalCost" fill="#F59E0B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead><tr>
            <th>Vehicle</th><th>Fuel Efficiency (km/L)</th><th>Total Distance</th><th>Fuel Cost</th><th>Maint. Cost</th><th>Operational Cost</th><th>ROI %</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.vehicle_id}>
                <td className="font-medium">{r.reg_number}</td>
                <td>{r.fuelEfficiency ?? '—'}</td>
                <td>{r.totalDistance} km</td>
                <td>₹{r.totalFuelCost}</td>
                <td>₹{r.totalMaintCost}</td>
                <td>₹{r.operationalCost}</td>
                <td>{r.roi ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------- SHELL -------------------------------- */
const NAV = [
  ['dashboard', 'Dashboard'],
  ['vehicles', 'Vehicles'],
  ['drivers', 'Drivers'],
  ['trips', 'Trips'],
  ['maintenance', 'Maintenance'],
  ['fuel', 'Fuel & Expenses'],
  ['reports', 'Reports']
];

export default function App() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('transitops_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    if (!getToken()) setUser(null);
  }, []);

  const logout = () => {
    localStorage.removeItem('transitops_token');
    localStorage.removeItem('transitops_user');
    setUser(null);
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-white/5 p-4 flex flex-col">
        <div className="text-lg font-bold mb-6 px-2">TransitOps</div>
        <nav className="space-y-1 flex-1">
          {NAV.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPage(key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${page === key ? 'bg-accent/20 text-accent' : 'text-slate-300 hover:bg-white/5'}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 pt-3 px-2">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-xs text-slate-500 capitalize mb-2">{user.role.replace('_', ' ')}</div>
          <button className="text-xs text-danger hover:underline" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">
        {page === 'dashboard' && <Dashboard />}
        {page === 'vehicles' && <Vehicles user={user} />}
        {page === 'drivers' && <Drivers />}
        {page === 'trips' && <Trips />}
        {page === 'maintenance' && <Maintenance />}
        {page === 'fuel' && <FuelExpenses />}
        {page === 'reports' && <Reports />}
      </main>
    </div>
  );
}
