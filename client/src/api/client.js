const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request(endpoint, options = {}) {
  const code = localStorage.getItem('khatmaCode');
  const adminPassword = localStorage.getItem('adminPassword');

  const headers = {
    'Content-Type': 'application/json',
    ...(code ? { 'x-khatma-code': code } : {}),
    ...(adminPassword ? { 'x-admin-password': adminPassword } : {}),
    ...options.headers
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'حدث خطأ غير متوقع');
  }

  return data;
}

export const api = {
  // Khatma
  access: (code) => request('/khatma/access', {
    method: 'POST',
    body: JSON.stringify({ code })
  }),

  adminLogin: (code, adminPassword) => request('/khatma/admin-login', {
    method: 'POST',
    body: JSON.stringify({ code, adminPassword })
  }),

  createKhatma: (data) => request('/khatma', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getDashboard: (id) => request(`/khatma/${id}/dashboard`),

  updateKhatma: (id, data) => request(`/khatma/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  deleteKhatma: (id) => request(`/khatma/${id}`, {
    method: 'DELETE'
  }),

  // Participants
  getParticipants: (khatmaId) => request(`/khatma/${khatmaId}/participants`),

  addParticipant: (khatmaId, data) => request(`/khatma/${khatmaId}/participants`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  updateParticipant: (khatmaId, pid, data) => request(`/khatma/${khatmaId}/participants/${pid}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  deleteParticipant: (khatmaId, pid) => request(`/khatma/${khatmaId}/participants/${pid}`, {
    method: 'DELETE'
  }),

  // Deceased
  getDeceased: (khatmaId) => request(`/khatma/${khatmaId}/deceased`),

  addDeceased: (khatmaId, data) => request(`/khatma/${khatmaId}/deceased`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  updateDeceased: (khatmaId, did, data) => request(`/khatma/${khatmaId}/deceased/${did}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  deleteDeceased: (khatmaId, did) => request(`/khatma/${khatmaId}/deceased/${did}`, {
    method: 'DELETE'
  })
};
