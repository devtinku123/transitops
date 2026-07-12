const BASE = '/api';

function getToken() {
  return localStorage.getItem('transitops_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  dashboard: () => request('/dashboard'),

  vehicles: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/vehicles${qs ? '?' + qs : ''}`);
  },
  availableVehicles: () => request('/vehicles/available'),
  createVehicle: (body) => request('/vehicles', { method: 'POST', body: JSON.stringify(body) }),
  updateVehicle: (id, body) => request(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteVehicle: (id) => request(`/vehicles/${id}`, { method: 'DELETE' }),

  drivers: () => request('/drivers'),
  availableDrivers: () => request('/drivers/available'),
  createDriver: (body) => request('/drivers', { method: 'POST', body: JSON.stringify(body) }),
  updateDriver: (id, body) => request(`/drivers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDriver: (id) => request(`/drivers/${id}`, { method: 'DELETE' }),

  trips: () => request('/trips'),
  createTrip: (body) => request('/trips', { method: 'POST', body: JSON.stringify(body) }),
  dispatchTrip: (id) => request(`/trips/${id}/dispatch`, { method: 'POST' }),
  completeTrip: (id, body) => request(`/trips/${id}/complete`, { method: 'POST', body: JSON.stringify(body) }),
  cancelTrip: (id) => request(`/trips/${id}/cancel`, { method: 'POST' }),

  maintenance: () => request('/maintenance'),
  createMaintenance: (body) => request('/maintenance', { method: 'POST', body: JSON.stringify(body) }),
  closeMaintenance: (id) => request(`/maintenance/${id}/close`, { method: 'POST' }),

  fuelLogs: () => request('/fuel-logs'),
  createFuelLog: (body) => request('/fuel-logs', { method: 'POST', body: JSON.stringify(body) }),

  expenses: () => request('/expenses'),
  createExpense: (body) => request('/expenses', { method: 'POST', body: JSON.stringify(body) }),

  reports: () => request('/reports'),
  exportCsvUrl: () => `${BASE}/reports/export.csv`
};

export { getToken };
