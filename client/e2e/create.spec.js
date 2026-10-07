import { test, expect } from '@playwright/test';
import { createKhatma, addParticipant, dashboard } from './api.js';

test('create a regular khatma with only a name, then add names', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /إنشاء ختمة جديدة/ }).click();
  await page.getByRole('button', { name: /أنا أكتب الأسماء/ }).click();
  await page.getByLabel('اسم الختمة').fill('ختمة عائلة الأحمد');
  await expect(page.getByLabel('كل أسبوع', { exact: true })).toBeChecked();
  await page.getByLabel(/رقم واتساب للمساعدة/).fill('97336123456');
  await page.screenshot({ path: 'e2e/screenshots/create-form.png', fullPage: true });
  await page.getByRole('button', { name: 'إنشاء الختمة' }).click();

  await expect(page.getByText('تم إنشاء الختمة بنجاح 🌷')).toBeVisible();
  await expect(page.getByText('الخطوة التالية: أضف أسماء المشاركين')).toBeVisible();
  const family = decodeURIComponent(await page.getByRole('link', { name: /أرسل الختمة للعائلة/ }).getAttribute('href'));
  expect(family).toMatch(/\/k\/[a-z0-9]{8}/);
  const manage = decodeURIComponent(await page.getByRole('link', { name: /احفظ رابط الإدارة/ }).getAttribute('href'));
  expect(manage).toMatch(/\/m\/[a-z0-9]{8}#\S{24}/);
  expect(manage).toContain('احتفظ بهذه الرسالة، ولا ترسلها لأحد');
  await page.screenshot({ path: 'e2e/screenshots/create-success.png', fullPage: true });

  await page.getByRole('link', { name: /أضف الأسماء/ }).click();
  await page.getByLabel('اسم جديد').fill('محمد');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(page.getByText('١. محمد')).toBeVisible();
});

test('create a quick khatma and land on the juz list', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: /كل شخص يختار جزءه بنفسه/ }).click();
  await expect(page.getByText('متى تتغير الأجزاء؟')).toHaveCount(0);
  await page.getByLabel('اسم الختمة').fill('ختمة سريعة');
  await page.getByRole('button', { name: 'إنشاء الختمة' }).click();
  await expect(page.getByText('تم إنشاء الختمة بنجاح 🌷')).toBeVisible();
  await expect(page.getByText('الخطوة التالية')).toHaveCount(0);
  await page.getByRole('link', { name: 'فتح الختمة' }).click();
  await expect(page.getByText('اختر الجزء الذي ستقرؤه')).toBeVisible();
});

test('name is required', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: /كل شخص يختار جزءه بنفسه/ }).click();
  await page.getByRole('button', { name: 'إنشاء الختمة' }).click();
  await expect(page.getByText('الرجاء كتابة اسم الختمة')).toBeVisible();
});

test('home: old Arabic code still works and the khatma is offered next time', async ({ page, request }) => {
  const k = await createKhatma(request, { code: 'ختمة' + Math.floor(Math.random() * 1e6), name: 'ختمة قديمة' });
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto('/');
  await page.getByRole('button', { name: 'عندك رمز الختمة؟ اكتبه هنا' }).click();
  await page.getByLabel('رمز الختمة').fill(k.code);
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: /العودة إلى: ختمة قديمة/ })).toBeVisible();
});

test('legacy storage and URLs from the old site keep working', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto('/');
  await page.evaluate(({ id, code, password }) => {
    localStorage.clear();
    localStorage.setItem('khatmaCode', code);
    localStorage.setItem('khatmaId', id);
    localStorage.setItem('adminPassword', password);
    localStorage.setItem('participantId', 'old-id');
  }, k);
  await page.goto(`/khatma/${k.id}/dashboard`);
  await expect(page).toHaveURL(new RegExp(`/k/${k.code}$`));
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
  await page.goto('/admin/manage');
  await expect(page.getByRole('link', { name: /الأسماء/ })).toBeVisible();
});

test('the banned technical words do not appear on participant screens', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(`/k/${k.code}`);
  await page.getByRole('button', { name: 'محمد أحمد' }).click();
  await page.getByRole('button', { name: 'نعم', exact: true }).click();
  await page.getByRole('button', { name: /عرض المشاركين/ }).click();
  const text = await page.locator('body').innerText();
  for (const word of ['CSV', 'شاغر', 'التكرار', 'رمز', 'كلمة مرور']) {
    expect(text).not.toContain(word);
  }
  const dash = await dashboard(request, k);
  expect(dash.participants).toHaveLength(1);
});
