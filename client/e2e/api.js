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

// ---- Extra helpers for the layout / error / edge-case specs ----
const adminHeaders = k => ({ 'x-admin-password': enc(k.password), 'x-khatma-code': enc(k.code) });

export async function updateKhatma(request, k, data) {
  return request.put(`${API}/khatma/${k.id}`, { headers: adminHeaders(k), data });
}

export async function deleteParticipant(request, k, participantId) {
  return request.delete(`${API}/khatma/${k.id}/participants/${participantId}`, { headers: adminHeaders(k) });
}

// The organizer records a reading for any participant in the current cycle
export async function markCompleteAsAdmin(request, k, participantId) {
  const dash = await dashboard(request, k);
  return request.post(`${API}/khatma/${k.id}/completions`, {
    headers: adminHeaders(k),
    data: { participantId, cycleNumber: dash.cycleNumber }
  });
}

export async function addMany(request, k, names, startSlot = 1) {
  const out = [];
  for (let i = 0; i < names.length; i++) out.push(await addParticipant(request, k, names[i], startSlot + i));
  return out;
}

export async function getKhatmaData(request, k) {
  return (await dashboard(request, k)).khatma;
}
