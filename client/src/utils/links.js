import { ar } from './arabicNumbers.js';

// No look-alike characters (0/o, 1/l/i) so a code can still be read aloud if needed
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function randomString(chars, length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export const generateCode = () => randomString(CODE_CHARS, 8);
export const generatePassword = () => randomString(PASSWORD_CHARS, 24);

export function khatmaPath(code) {
  return `/k/${encodeURIComponent(code)}`;
}

export function shareLink(code, origin = window.location.origin) {
  return origin + khatmaPath(code);
}

// The password goes in the fragment (#) so browsers never send it to any server
export function manageLink(code, password, origin = window.location.origin) {
  return `${origin}/m/${encodeURIComponent(code)}#${encodeURIComponent(password)}`;
}

export function readPasswordFromHash(hash) {
  if (!hash || hash.length < 2) return null;
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
}

export function whatsappUrl(text, phone) {
  const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function familyMessage(name, code, origin) {
  return `السلام عليكم ورحمة الله 🌷\n\nندعوكم للمشاركة في: *${name}*\n\nاضغط على الرابط لترى جزءك:\n${shareLink(code, origin)}\n\nجزاكم الله خيرًا`;
}

export function manageMessage(name, code, password, origin) {
  return `🔒 رابط إدارة: *${name}*\n\n${manageLink(code, password, origin)}\n\nاحتفظ بهذه الرسالة، ولا ترسلها لأحد`;
}

export function reminderMessage(name, code, people, origin) {
  const lines = people.map(p => `• ${p.name} (الجزء ${ar(p.juz)})`).join('\n');
  return `تذكير 🌷 — *${name}*\n\nلم يُسجَّل بعد إنهاء قراءة:\n${lines}\n\nللتسجيل اضغط هنا:\n${shareLink(code, origin)}\n\nجزاكم الله خيرًا`;
}

export function distributionMessage({ name, code, isQuick, khatmaNumber, dedicatedNames, rows, completedCount, total }, origin) {
  let text = `بسم الله الرحمن الرحيم\n\n📖 *${name}*`;
  if (!isQuick) text += `\nالختمة رقم: *${ar(khatmaNumber)}*`;
  text += '\n';
  if (!isQuick && dedicatedNames?.length > 0) {
    text += `\n🤲 *الإهداء:* ${dedicatedNames.join(' و ')}\n`;
  }
  text += '\n📋 *توزيع الأجزاء:*\n';
  const sorted = [...rows].sort((a, b) => a.juz - b.juz);
  sorted.forEach(r => {
    text += `الجزء ${ar(r.juz)} ← ${r.name}${r.done ? ' ✅' : ''}\n`;
  });
  const taken = new Set(sorted.map(r => r.juz));
  const free = [];
  for (let i = 1; i <= 30; i++) if (!taken.has(i)) free.push(ar(i));
  if (free.length > 0) text += `\n📗 *أجزاء متاحة:* ${free.join('، ')}\n`;
  if (total > 0) {
    text += `\n📊 ${ar(completedCount)} من ${ar(total)} أنهوا القراءة`;
    if (completedCount >= total) text += '\n\n🎉 *تمت الختمة بحمد الله*';
  }
  text += `\n\n${shareLink(code, origin)}\n\nجزاكم الله خيرًا`;
  return text;
}
