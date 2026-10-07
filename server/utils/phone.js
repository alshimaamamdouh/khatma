// Stores phone numbers as international digits only (e.g. 97336123456) for wa.me links.
function normalizePhone(value) {
  if (!value) return null;
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits.length >= 8 ? digits : null;
}

module.exports = { normalizePhone };
