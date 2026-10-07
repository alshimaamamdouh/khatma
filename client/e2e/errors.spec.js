import { test, expect } from '@playwright/test';
import { createKhatma, addParticipant, addMany, completedCount } from './api.js';
import { claimAs, expectNoOverflow } from './ui.js';

const NETWORK_MSG = 'تعذّر الاتصال. تأكد من الإنترنت ثم حاول مرة أخرى.';

test('network failure while finishing a juz: friendly message, page intact, can retry', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await claimAs(page, k, 'محمد أحمد');

  await page.route('**/api/**', r => r.abort());
  await page.getByRole('button', { name: /أنهيت قراءة الجزء/ }).click();
  await expect(page.getByText(NETWORK_MSG)).toBeVisible();
  await expect(page.locator('.juz-hero-number')).toHaveText('الجزء ١');
  const retry = page.getByRole('button', { name: /أنهيت قراءة الجزء/ });
  await expect(retry).toBeEnabled();
  expect(await completedCount(request, k)).toBe(0);

  // Connection is back: the same button works
  await page.unroute('**/api/**');
  await retry.click();
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toBeVisible();
  await expect(page.getByText(NETWORK_MSG)).toHaveCount(0);
  expect(await completedCount(request, k)).toBe(1);
});

test('opening the participant link while offline shows a friendly message', async ({ page, request }) => {
  const k = await createKhatma(request);
  // Only the API: '**/api/**' would also block Vite's own /src/api/client.js module
  await page.route(url => new URL(url).pathname.startsWith('/api/'), r => r.abort());
  await page.goto(`/k/${encodeURIComponent(k.code)}`);
  await expect(page.getByText(NETWORK_MSG)).toBeVisible();
  await expect(page.getByRole('link', { name: 'الصفحة الرئيسية' })).toBeVisible();
  await expect(page.getByText(/undefined|TypeError|Failed to fetch/)).toHaveCount(0);
  await expectNoOverflow(page);
});

test('network failure on the organizer screens shows a friendly message', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(`/m/${encodeURIComponent(k.code)}#${encodeURIComponent(k.password)}`);
  await page.getByRole('link', { name: /الأسماء/ }).click();
  await page.route('**/api/**', r => r.abort());
  await page.getByLabel('اسم جديد').fill('سعيد');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(page.getByText(NETWORK_MSG).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'إضافة', exact: true })).toBeEnabled();
});

test('server error (500) on marking: message shown and the button works again', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await claimAs(page, k, 'محمد أحمد');

  await page.route('**/api/khatma/*/completions', r => r.request().method() === 'POST'
    ? r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'x' }) })
    : r.continue());
  const button = page.getByRole('button', { name: /أنهيت قراءة الجزء/ });
  await button.click();
  await expect(page.locator('.error-msg')).toHaveText('x');
  await expect(button).toBeEnabled();
  expect(await completedCount(request, k)).toBe(0);

  await page.unroute('**/api/khatma/*/completions');
  await button.click();
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toBeVisible();
});

test('server error without a JSON body still shows a generic Arabic message', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await claimAs(page, k, 'محمد أحمد');
  await page.route('**/api/khatma/*/completions', r => r.request().method() === 'POST'
    ? r.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' })
    : r.continue());
  await page.getByRole('button', { name: /أنهيت قراءة الجزء/ }).click();
  await expect(page.getByText('حدث خطأ غير متوقع')).toBeVisible();
  await expect(page.getByText(/Bad gateway|SyntaxError/)).toHaveCount(0);
});

test('server error while claiming a name: message shown, can try again', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(`/k/${encodeURIComponent(k.code)}`);
  await page.getByRole('button', { name: 'محمد أحمد', exact: true }).click();
  await page.route('**/claim', r => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'تعذّر الحفظ' }) }));
  await page.getByRole('button', { name: 'نعم', exact: true }).click();
  await expect(page.getByText('تعذّر الحفظ')).toBeVisible();
  await expect(page.getByRole('button', { name: 'نعم', exact: true })).toBeEnabled();
  await page.unroute('**/claim');
  await page.getByRole('button', { name: 'نعم', exact: true }).click();
  await expect(page.getByText('السلام عليكم يا محمد')).toBeVisible();
});

test('manage link with an empty fragment shows a friendly error', async ({ page, request }) => {
  const k = await createKhatma(request);
  for (const url of [`/m/${encodeURIComponent(k.code)}`, `/m/${encodeURIComponent(k.code)}#`]) {
    await page.goto(url);
    await expect(page.getByText('رابط الإدارة غير صحيح. تأكد أنك فتحت الرسالة الصحيحة.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'الصفحة الرئيسية' })).toBeVisible();
  }
});

test('manage link with a wrong password shows a friendly error and stores nothing', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(`/m/${encodeURIComponent(k.code)}#wrong-password`);
  await expect(page.getByText('رابط الإدارة غير صحيح. تأكد أنك فتحت الرسالة الصحيحة.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('khatmas'))).toBeNull();
  // the wrong fragment is wiped from the address bar
  expect(new URL(page.url()).hash).toBe('');
});

test('legacy login: wrong password shows an error and stays on the form', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto('/');
  await page.getByRole('link', { name: /دخول المنظم/ }).click();
  await expect(page).toHaveURL(/\/manage-login$/);
  await page.getByLabel('رمز الختمة').fill(k.code);
  await page.getByLabel('كلمة مرور المسؤول').fill('definitely-wrong');
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page.locator('.error-msg')).toBeVisible();
  await expect(page).toHaveURL(/\/manage-login$/);
  await expect(page.getByRole('button', { name: 'دخول' })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('khatmas'))).toBeNull();
});

test('legacy login: empty fields ask for both, correct credentials open the manage menu', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto('/manage-login');
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page.getByText('الرجاء كتابة الرمز وكلمة المرور')).toBeVisible();
  await page.getByLabel('رمز الختمة').fill(k.code);
  await page.getByLabel('كلمة مرور المسؤول').fill(k.password);
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page.getByRole('link', { name: /الإعدادات/ })).toBeVisible();
});

test('home code form: empty code asks for it, unknown code shows the friendly page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /عندك رمز الختمة/ }).click();
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page.getByText('الرجاء كتابة رمز الختمة')).toBeVisible();
  await page.getByLabel('رمز الختمة').fill('nothing-here');
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page.getByText('لم نجد هذه الختمة.')).toBeVisible();
});

test('old URLs: /admin and /admin/create go to create; unknown /khatma/<id>/dashboard goes home', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByText('كيف تريد الختمة؟')).toBeVisible();
  await page.goto('/admin/create');
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByText('كيف تريد الختمة؟')).toBeVisible();
  await page.goto('/khatma/507f1f77bcf86cd799439011/dashboard');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: /إنشاء ختمة جديدة/ })).toBeVisible();
});

test('old URLs: /khatma/<id>/dashboard of a remembered khatma goes to its page; /admin/manage without login goes to login', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(`/k/${encodeURIComponent(k.code)}`);
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
  await page.goto(`/khatma/${k.id}/dashboard`);
  await expect(page).toHaveURL(new RegExp(`/k/${k.code}$`));
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();

  await page.goto('/admin/manage');
  await expect(page).toHaveURL(/\/manage-login$/);
});

test('/admin/manage after the organizer opened the manage link goes straight to the menu', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(`/m/${encodeURIComponent(k.code)}#${encodeURIComponent(k.password)}`);
  await expect(page.getByRole('link', { name: /الإعدادات/ })).toBeVisible();
  await page.goto('/admin/manage');
  await expect(page.getByRole('link', { name: /الإعدادات/ })).toBeVisible();
});

test('manage screens without credentials on this phone send the visitor to the legacy login', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(`/k/${encodeURIComponent(k.code)}/manage/names`);
  await expect(page).toHaveURL(/\/manage-login$/);
});

test('create: a name with only spaces is refused', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: /أنا أكتب الأسماء/ }).click();
  await page.getByLabel('اسم الختمة').fill('     ');
  let posts = 0;
  page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/khatma') posts++; });
  await page.getByRole('button', { name: 'إنشاء الختمة' }).click();
  await expect(page.getByText('الرجاء كتابة اسم الختمة')).toBeVisible();
  expect(posts).toBe(0);
  await expect(page.getByText('تم إنشاء الختمة بنجاح 🌷')).toHaveCount(0);
});

test('create: a very long name does not overflow on the form, success, participant and manage screens', async ({ page }) => {
  const longName = 'ختمة'.repeat(45); // 180 characters, no spaces
  await page.goto('/create');
  await page.getByRole('button', { name: /أنا أكتب الأسماء/ }).click();
  await page.getByLabel('اسم الختمة').fill(longName);
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'إنشاء الختمة' }).click();
  await expect(page.getByText('تم إنشاء الختمة بنجاح 🌷')).toBeVisible();
  await expectNoOverflow(page);

  await page.getByRole('link', { name: 'فتح الختمة' }).click();
  await expect(page.getByRole('heading', { name: longName })).toBeVisible();
  await expectNoOverflow(page);

  await page.getByRole('link', { name: /إدارة الختمة/ }).click();
  await expect(page.getByRole('heading', { name: new RegExp(longName) })).toBeVisible();
  await expectNoOverflow(page);

  await page.goto('/');
  await expect(page.getByRole('link', { name: /العودة إلى/ })).toBeVisible();
  await expectNoOverflow(page);
});

test('create: a very long participant name does not overflow on any screen that lists it', async ({ page, request }) => {
  const k = await createKhatma(request);
  const longName = 'عبدالرحمن'.repeat(14); // one 126 letter "word"
  await addMany(request, k, [longName, 'فاطمة علي']);
  await page.goto(`/k/${encodeURIComponent(k.code)}`);
  await expect(page.getByRole('button', { name: longName })).toBeVisible();
  await expectNoOverflow(page);
  await page.getByRole('button', { name: longName }).click();
  await expectNoOverflow(page);
  await page.getByRole('button', { name: 'نعم', exact: true }).click();
  await page.getByRole('button', { name: /عرض المشاركين/ }).click();
  await expectNoOverflow(page);
  await page.goto(`/m/${encodeURIComponent(k.code)}#${encodeURIComponent(k.password)}`);
  for (const link of [/الأسماء/, /تسجيل من أنهى القراءة/]) {
    await page.getByRole('link', { name: link }).click();
    await expect(page.locator('.big-row').first()).toBeVisible();
    await expectNoOverflow(page);
    await page.getByRole('link', { name: 'رجوع' }).click();
  }
});

test('create: double-clicking "إنشاء الختمة" sends one request and creates one khatma', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: /أنا أكتب الأسماء/ }).click();
  await page.getByLabel('اسم الختمة').fill('ختمة مزدوجة');
  let posts = 0;
  page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/khatma') posts++; });
  await page.getByRole('button', { name: 'إنشاء الختمة' }).dblclick();
  await expect(page.getByText('تم إنشاء الختمة بنجاح 🌷')).toBeVisible();
  await expect(page.getByText('تم إنشاء الختمة بنجاح 🌷')).toHaveCount(1);
  expect(posts).toBe(1);
});

test('create: server error shows the message and the button works again', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: /كل شخص يختار جزءه بنفسه/ }).click();
  await page.getByLabel('اسم الختمة').fill('ختمة');
  await page.route('**/api/khatma', r => r.request().method() === 'POST'
    ? r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'تعذّر الإنشاء' }) })
    : r.continue());
  await page.getByRole('button', { name: 'إنشاء الختمة' }).click();
  await expect(page.getByText('تعذّر الإنشاء')).toBeVisible();
  await expect(page.getByRole('button', { name: 'إنشاء الختمة' })).toBeEnabled();
  await page.unroute('**/api/khatma');
  await page.getByRole('button', { name: 'إنشاء الختمة' }).click();
  await expect(page.getByText('تم إنشاء الختمة بنجاح 🌷')).toBeVisible();
});

test('create: a 409 on the random code is retried once and succeeds', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: /كل شخص يختار جزءه بنفسه/ }).click();
  await page.getByLabel('اسم الختمة').fill('ختمة');
  let calls = 0;
  await page.route('**/api/khatma', async r => {
    if (r.request().method() !== 'POST') return r.continue();
    calls++;
    if (calls === 1) return r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'مستخدم' }) });
    return r.continue();
  });
  await page.getByRole('button', { name: 'إنشاء الختمة' }).click();
  await expect(page.getByText('تم إنشاء الختمة بنجاح 🌷')).toBeVisible();
  expect(calls).toBe(2);
});

test('accessibility: html has lang="ar" and dir="rtl" on every route', async ({ page, request }) => {
  const k = await createKhatma(request);
  for (const url of ['/', '/create', `/k/${encodeURIComponent(k.code)}`, '/manage-login', '/zzz']) {
    await page.goto(url);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  }
});
