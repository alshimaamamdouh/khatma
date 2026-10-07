import fs from 'fs';
import { test, expect } from '@playwright/test';
import { createKhatma, addParticipant, completedCount, dashboard } from './api.js';

const manageUrl = k => `/m/${encodeURIComponent(k.code)}#${encodeURIComponent(k.password)}`;

test('organizer records that someone finished, and undoes with confirmation', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /تسجيل من أنهى القراءة/ }).click();
  const row = page.locator('.big-row', { hasText: 'محمد أحمد' });
  await expect(row.getByText('⏳ لم ينته بعد')).toBeVisible();
  await row.getByRole('button', { name: 'سجّل أنه أنهى' }).click();
  await expect(row.getByText('✅ أنهى')).toBeVisible();
  expect(await completedCount(request, k)).toBe(1);
  await row.getByRole('button', { name: 'تراجع' }).click();
  await page.getByRole('button', { name: 'نعم، تراجع' }).click();
  await expect(row.getByText('⏳ لم ينته بعد')).toBeVisible();
  expect(await completedCount(request, k)).toBe(0);
});

test('send screen builds WhatsApp links for family, reminder and distribution', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /إرسال للعائلة/ }).click();
  const family = await page.getByRole('link', { name: /أرسل الختمة للعائلة/ }).getAttribute('href');
  expect(decodeURIComponent(family)).toContain(`/k/${k.code}`);
  const reminder = await page.getByRole('link', { name: /تذكير/ }).getAttribute('href');
  expect(decodeURIComponent(reminder)).toContain('محمد أحمد (الجزء ١)');
  const manage = await page.getByRole('link', { name: /رابط الإدارة/ }).getAttribute('href');
  expect(decodeURIComponent(manage)).toContain('ولا ترسلها لأحد');
});

test('pause and resume', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /إيقاف مؤقت/ }).click();
  await page.getByLabel('من يوم').fill('2020-01-01');
  await page.getByLabel('إلى يوم').fill('2099-01-01');
  await page.getByRole('button', { name: 'إيقاف الختمة' }).click();
  await expect(page.getByText(/الختمة متوقفة/)).toBeVisible();
  expect((await dashboard(request, k)).paused).toBe(true);
  await page.getByRole('button', { name: 'استئناف الختمة' }).click();
  await expect(page.getByRole('button', { name: 'إيقاف الختمة' })).toBeVisible();
  expect((await dashboard(request, k)).paused).toBe(false);
});

test('settings: change name and help phone; Excel and copy are under advanced options', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /الإعدادات/ }).click();
  await page.getByLabel('اسم الختمة').fill('ختمة جديدة');
  await page.getByLabel(/رقم واتساب للمساعدة/).fill('+973 3612 3456');
  await expect(page.getByRole('button', { name: /تنزيل ملف Excel/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('تم الحفظ')).toBeVisible();
  const dash = await dashboard(request, k);
  expect(dash.khatma.name).toBe('ختمة جديدة');
  expect(dash.khatma.organizer_phone).toBe('97336123456');

  await page.getByRole('button', { name: /خيارات متقدمة/ }).click();
  await expect(page.getByRole('button', { name: /تنزيل ملف Excel/ })).toBeVisible();
  await page.getByRole('button', { name: /نسخ الختمة/ }).click();
  await expect(page.getByText('تم نسخ الختمة')).toBeVisible();
  await expect(page.getByRole('link', { name: /أرسل الختمة للعائلة/ })).toBeVisible();
});

test('delete khatma needs two confirmations', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /الإعدادات/ }).click();
  await page.getByRole('button', { name: /خيارات متقدمة/ }).click();
  await page.getByRole('button', { name: 'حذف الختمة' }).click();
  await page.getByRole('button', { name: 'نعم، احذف' }).click();
  await expect(page.getByText('هذا لا يمكن التراجع عنه. هل تحذفها نهائيًا؟')).toBeVisible();
  await page.waitForTimeout(900); // the final confirm ignores taps for the first 800 ms
  await page.getByRole('button', { name: 'نعم، احذف نهائيًا' }).click();
  await expect(page).toHaveURL(/\/$/);
  const res = await request.post('http://localhost:3000/api/khatma/access', { data: { code: k.code } });
  expect(res.status()).toBe(404);
});

test('history and stats open from the menu and go back', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /السجل والإحصائيات/ }).click();
  await expect(page.getByText('سجل الختمات السابقة')).toBeVisible();
  await page.getByRole('link', { name: 'الإحصائيات' }).click();
  await expect(page.getByText('ترتيب المشاركين')).toBeVisible();
  await page.getByRole('link', { name: 'رجوع' }).click();
  await expect(page.getByRole('link', { name: /الأسماء/ })).toBeVisible();
});

test('Excel export escapes commas and quotes and starts with a BOM', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'علي, "الصغير"', 1);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /الإعدادات/ }).click();
  await page.getByRole('button', { name: /خيارات متقدمة/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /تنزيل ملف Excel/ }).click();
  const text = fs.readFileSync(await (await download).path(), 'utf8');
  expect(text.charCodeAt(0)).toBe(0xFEFF);
  expect(text).toContain('"علي, ""الصغير"""');
});

test('an expired pause shows the normal pause form', async ({ page, request }) => {
  const k = await createKhatma(request);
  await request.put(`http://localhost:3000/api/khatma/${k.id}`, {
    headers: { 'x-admin-password': encodeURIComponent(k.password) },
    data: { pausedFrom: '2020-01-01', pausedTo: '2020-02-01' }
  });
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /إيقاف مؤقت/ }).click();
  await expect(page.getByRole('button', { name: 'إيقاف الختمة' })).toBeVisible();
});
