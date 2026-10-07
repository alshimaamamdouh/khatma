// Page-level helpers shared by the e2e specs.
import { expect } from '@playwright/test';

export const manageUrl = (k, sub = '') =>
  sub ? `/k/${encodeURIComponent(k.code)}/manage/${sub}` : `/m/${encodeURIComponent(k.code)}#${encodeURIComponent(k.password)}`;

// Opens the private manage link (stores the organizer password on this phone) and lands on the menu
export async function openManage(page, k) {
  await page.goto(manageUrl(k));
  await expect(page.getByRole('link', { name: /الإعدادات/ })).toBeVisible();
}

// Goes to a manage sub-screen through the menu (keeps the single-page flow real)
export async function openManageScreen(page, k, linkName) {
  await openManage(page, k);
  await page.getByRole('link', { name: linkName }).click();
}

export async function claimAs(page, k, name) {
  await page.goto(`/k/${encodeURIComponent(k.code)}`);
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByText(`هل أنت ${name}؟`)).toBeVisible();
  await page.getByRole('button', { name: 'نعم', exact: true }).click();
  await expect(page.getByText(`السلام عليكم يا ${name.split(' ')[0]}`)).toBeVisible();
}

export async function expectNoOverflow(page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(scrollWidth, 'horizontal overflow').toBeLessThanOrEqual(innerWidth);
}

const CONTROLS = '.btn, .btn-big, .big-row-button, .tile, .link-button, .row-action, .choice-card, .row-actions .btn';
const BANNED = ['CSV', 'شاغر', 'التكرار', 'رمز', 'كلمة مرور'];

/**
 * One sweep for a screen that is already displayed:
 * no horizontal overflow, body font >= 20px, every control >= 56px tall,
 * no banned words, every button/link/field has an accessible name, <html lang/dir>.
 * `legacyWords: true` allows "رمز" / "كلمة مرور" (the legacy code entry screens).
 */
export async function checkPage(page, { legacyWords = false } = {}) {
  const banned = legacyWords ? BANNED.filter(w => w !== 'رمز' && w !== 'كلمة مرور') : BANNED;
  const problems = await page.evaluate(({ controls, banned }) => {
    const out = [];
    const visible = el => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const label = el => `<${el.tagName.toLowerCase()} class="${el.className}"> "${(el.innerText || '').trim().slice(0, 30)}"`;

    if (document.documentElement.scrollWidth > window.innerWidth) {
      out.push(`overflow: scrollWidth ${document.documentElement.scrollWidth} > innerWidth ${window.innerWidth}`);
    }
    const bodyFont = parseFloat(getComputedStyle(document.body).fontSize);
    if (bodyFont < 20) out.push(`body font ${bodyFont}px < 20px`);

    document.querySelectorAll(controls).forEach(el => {
      if (!visible(el)) return;
      const h = el.getBoundingClientRect().height;
      if (h < 55.5) out.push(`control too short (${h.toFixed(1)}px): ${label(el)}`);
    });

    const texts = [document.body.innerText];
    document.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(el => {
      for (const a of ['placeholder', 'aria-label', 'title', 'alt']) if (el.getAttribute(a)) texts.push(el.getAttribute(a));
    });
    const all = texts.join('\n');
    for (const w of banned) {
      if (w === 'CSV' ? /csv/i.test(all) : all.includes(w)) out.push(`banned word present: ${w}`);
    }

    document.querySelectorAll('button, a[href], input:not([type=hidden]), textarea, select, [role=button]').forEach(el => {
      if (!visible(el)) return;
      let named = !!(el.getAttribute('aria-label') || '').trim() || !!(el.getAttribute('title') || '').trim();
      if (!named && el.getAttribute('aria-labelledby')) {
        named = el.getAttribute('aria-labelledby').split(/\s+/).some(id => (document.getElementById(id)?.textContent || '').trim());
      }
      if (!named && el.labels && el.labels.length) named = [...el.labels].some(l => l.textContent.trim());
      if (!named && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) named = !!(el.innerText || el.textContent || '').trim();
      if (!named) out.push(`no accessible name: ${label(el)}`);
    });

    const html = document.documentElement;
    if (html.getAttribute('lang') !== 'ar') out.push(`html lang=${html.getAttribute('lang')}`);
    if (html.getAttribute('dir') !== 'rtl') out.push(`html dir=${html.getAttribute('dir')}`);
    return out;
  }, { controls: CONTROLS, banned });
  expect(problems, problems.join('\n')).toEqual([]);
}
