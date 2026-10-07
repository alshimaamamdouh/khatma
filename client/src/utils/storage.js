// All phone storage lives here. One record per khatma:
// { code, name?, adminPassword?, participantId?, participantToken? }
const KHATMAS_KEY = 'khatmas';
const ACTIVE_KEY = 'activeKhatmaId';

// Private browsing / blocked storage must never crash the page
function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function readAll() {
  try {
    const parsed = JSON.parse(safeGet(KHATMAS_KEY));
    // Anything but a plain object (string, number, array, null) is corrupt: treat as empty
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
function writeAll(all) {
  safeSet(KHATMAS_KEY, JSON.stringify(all));
}

export function getKhatma(id) {
  return readAll()[id] || null;
}

export function saveKhatma(id, patch) {
  const all = readAll();
  all[id] = { ...all[id], ...patch };
  writeAll(all);
}

export function removeKhatma(id) {
  const all = readAll();
  delete all[id];
  writeAll(all);
  if (safeGet(ACTIVE_KEY) === id) safeRemove(ACTIVE_KEY);
}

export function forgetParticipant(id) {
  const all = readAll();
  if (!all[id]) return;
  delete all[id].participantId;
  delete all[id].participantToken;
  writeAll(all);
}

export function findIdByCode(code) {
  const all = readAll();
  return Object.keys(all).find(id => all[id].code === code) || null;
}

export function setActive(id) {
  safeSet(ACTIVE_KEY, id);
}

export function getActive() {
  const id = safeGet(ACTIVE_KEY);
  if (!id) return null;
  const record = getKhatma(id);
  return record ? { id, ...record } : null;
}

// Move the old single-khatma keys into the new format, once.
// The old participantId is dropped on purpose: it has no token, so the person
// is asked "مَن أنت؟" once more and claims their name properly.
export function migrateLegacyStorage() {
  const code = safeGet('khatmaCode');
  const id = safeGet('khatmaId');
  const adminPassword = safeGet('adminPassword');
  if (code && id && !getKhatma(id)) {
    saveKhatma(id, adminPassword ? { code, adminPassword } : { code });
    setActive(id);
  }
  // Only drop the old credentials once the new record reads back correctly
  const migrated = !code || !id || getKhatma(id)?.code === code;
  const keys = ['khatmaName', 'participantId', 'participantName', 'participantSlot', 'darkMode'];
  if (migrated) keys.push('khatmaCode', 'khatmaId', 'adminPassword');
  keys.forEach(safeRemove);
  document.documentElement.removeAttribute('data-theme');
}
