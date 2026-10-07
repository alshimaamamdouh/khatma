import { test, expect } from '@playwright/test';
import { createKhatma, addParticipant, addDeceased, completedCount } from './api.js';

async function claimAs(page, k, name) {
  await page.goto(`/k/${encodeURIComponent(k.code)}`);
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByText(`هل أنت ${name}؟`)).toBeVisible();
  await page.getByRole('button', { name: 'نعم', exact: true }).click();
  await expect(page.getByText(`السلام عليكم يا ${name.split(' ')[0]}`)).toBeVisible();
}

test('participant opens link, picks name, finishes, undoes, is remembered', async ({ page, request }) => {
  const k = await createKhatma(request, { phone: '97336123456' });
  await addParticipant(request, k, 'محمد أحمد', 1);
  await addParticipant(request, k, 'فاطمة علي', 2);
  await addDeceased(request, k, 'أحمد محمد', '2020-01-15');

  await claimAs(page, k, 'محمد أحمد');
  await expect(page.getByText('جزؤك الحالي')).toBeVisible();
  await expect(page.locator('.juz-hero-number')).toHaveText('الجزء ١');
  await expect(page.getByText(/يتغير الجزء يوم/)).toBeVisible();
  await expect(page.getByText(/إهداءً إلى روح أحمد محمد/)).toBeVisible();
  await expect(page.getByRole('link', { name: /ابدأ قراءة الجزء/ })).toHaveAttribute('href', 'https://quran.com/ar/juz/1');
  await expect(page.getByRole('link', { name: /تحتاج مساعدة/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/97336123456\?text=/);
  await page.screenshot({ path: 'e2e/screenshots/participant-main.png', fullPage: true });

  await page.getByRole('button', { name: /أنهيت قراءة الجزء/ }).click();
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toBeVisible();
  await expect(page.getByText('١ من ٢ شخصًا أنهوا القراءة')).toBeVisible();
  expect(await completedCount(request, k)).toBe(1);
  await page.screenshot({ path: 'e2e/screenshots/participant-done.png', fullPage: true });

  // Undo asks first; "لا" changes nothing
  await page.getByRole('button', { name: 'تراجع' }).click();
  await expect(page.getByText('هل تريد التراجع عن تسجيل القراءة؟')).toBeVisible();
  await page.getByRole('button', { name: 'لا', exact: true }).click();
  expect(await completedCount(request, k)).toBe(1);
  await page.getByRole('button', { name: 'تراجع' }).click();
  await page.getByRole('button', { name: 'نعم، تراجع' }).click();
  await expect(page.getByRole('button', { name: /أنهيت قراءة الجزء/ })).toBeVisible();
  expect(await completedCount(request, k)).toBe(0);

  // Remembered after reload
  await page.reload();
  await expect(page.getByText('السلام عليكم يا محمد')).toBeVisible();

  // Change name
  await page.getByRole('button', { name: /لست محمد؟ غيّر الاسم/ }).click();
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
});

test('"لا" on "هل أنت…؟" goes back to the name list', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(`/k/${k.code}`);
  await page.getByRole('button', { name: 'محمد أحمد' }).click();
  await page.getByRole('button', { name: 'لا', exact: true }).click();
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
});

test('rapid triple tap on "أنهيت" sends one request and records one completion', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await claimAs(page, k, 'محمد أحمد');

  let posts = 0;
  page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/completions')) posts++; });
  await page.getByRole('button', { name: /أنهيت قراءة الجزء/ }).click({ clickCount: 3 });
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toHaveCount(1);
  expect(posts).toBe(1);
  expect(await completedCount(request, k)).toBe(1);
});

test('participant list is collapsed and view-only', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await addParticipant(request, k, 'فاطمة علي', 2);
  await claimAs(page, k, 'محمد أحمد');
  await expect(page.locator('.status-list')).toHaveCount(0);
  await page.getByRole('button', { name: /عرض المشاركين/ }).click();
  await expect(page.getByText('الجزء ٢ — فاطمة علي')).toBeVisible();
  await expect(page.getByText('⏳ لم ينته بعد').first()).toBeVisible();
  await expect(page.locator('.status-list button')).toHaveCount(0);
});

test('sizes: juz number is the biggest text and main buttons are ≥ 56px tall', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await claimAs(page, k, 'محمد أحمد');
  const juzSize = await page.locator('.juz-hero-number').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(juzSize).toBeGreaterThanOrEqual(56);
  const greetingSize = await page.locator('.greeting').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(juzSize).toBeGreaterThan(greetingSize);
  for (const box of await page.locator('.btn-big').all()) {
    expect((await box.boundingBox()).height).toBeGreaterThanOrEqual(56);
  }
});

test('help link is hidden when the organizer saved no phone', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await claimAs(page, k, 'محمد أحمد');
  await expect(page.getByText(/تحتاج مساعدة/)).toHaveCount(0);
});

test('unknown link shows a friendly message', async ({ page }) => {
  await page.goto('/k/does-not-exist');
  await expect(page.getByText('لم نجد هذه الختمة.')).toBeVisible();
  await expect(page.getByText('تأكد من الرابط، أو اسأل منظم الختمة.')).toBeVisible();
  await expect(page.getByText(/رمز/)).toHaveCount(0);
});
