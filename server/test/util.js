// Shared small helpers for the Area A tests (not a test file: the runner only picks *.test.js).
const enc = encodeURIComponent;
const codeH = k => ({ 'x-khatma-code': enc(k.code) });
const adminH = k => ({ 'x-admin-password': enc(k.password) });

function pad(n) { return String(n).padStart(2, '0'); }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function daysAgo(n) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return dateStr(d); }
function daysAhead(n) { return daysAgo(-n); }

module.exports = { enc, codeH, adminH, daysAgo, daysAhead, dateStr };
