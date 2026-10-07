// Direct API helpers for setting up e2e scenarios (talks to the in-memory API on :3000).
const API = 'http://localhost:3000/api';
const enc = encodeURIComponent;

export async function createKhatma(request, { quick = false, phone, code, name = 'ختمة العائلة' } = {}) {
  const accessCode = code || 'e2e' + Math.random().toString(36).slice(2, 9);
  const password = 'pw-' + Math.random().toString(36).slice(2);
  const res = await request.post(`${API}/khatma`, {
    data: {
      name, accessCode, adminPassword: password,
      startDate: new Date().toISOString().slice(0, 10),
      rotationType: 'weekly', isQuick: quick, organizerPhone: phone
    }
  });
  const { id } = await res.json();
  return { id, code: accessCode, password, name };
}

export async function addParticipant(request, k, name, slotNumber) {
  const res = await request.post(`${API}/khatma/${k.id}/participants`, {
    headers: { 'x-admin-password': enc(k.password) },
    data: { name, slotNumber }
  });
  return (await res.json()).participant;
}

export async function addDeceased(request, k, name, deathDate) {
  await request.post(`${API}/khatma/${k.id}/deceased`, {
    headers: { 'x-admin-password': enc(k.password) },
    data: { name, deathDate }
  });
}

export async function joinQuick(request, k, name, slotNumber) {
  return request.post(`${API}/khatma/${k.id}/join`, {
    headers: { 'x-khatma-code': enc(k.code) },
    data: { name, slotNumber }
  });
}

export async function dashboard(request, k) {
  const res = await request.get(`${API}/khatma/${k.id}/dashboard`, { headers: { 'x-khatma-code': enc(k.code) } });
  return res.json();
}

export async function completedCount(request, k) {
  const dash = await dashboard(request, k);
  const res = await request.get(`${API}/khatma/${k.id}/completions/${dash.cycleNumber}`, {
    headers: { 'x-khatma-code': enc(k.code) }
  });
  return (await res.json()).completedCount;
}
