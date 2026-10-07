import { test, expect } from '@playwright/test';
import { createKhatma, addParticipant, dashboard } from './api.js';

function manageUrl(k) {
  return `/m/${encodeURIComponent(k.code)}#${encodeURIComponent(k.password)}`;
}

test('manage link opens the menu and removes the password from the address bar', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(manageUrl(k));
  await expect(page.getByRole('link', { name: /الأسماء/ })).toBeVisible();
  expect(page.url()).not.toContain(k.password);
  expect(page.url()).not.toContain('#');
  await page.screenshot({ path: 'e2e/screenshots/manage-menu.png', fullPage: true });
});

test('wrong manage link shows a clear message', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(`/m/${k.code}#wrong`);
  await expect(page.getByText('رابط الإدارة غير صحيح. تأكد أنك فتحت الرسالة الصحيحة.')).toBeVisible();
});

test('organizer adds names in bulk, edits, reorders and deletes with confirmation', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /الأسماء/ }).click();

  await page.getByRole('button', { name: 'إضافة عدة أسماء مرة واحدة' }).click();
  await page.getByLabel('اكتب كل اسم في سطر').fill('محمد أحمد\nفاطمة علي\nخالد حسن');
  await page.getByRole('button', { name: 'إضافة الأسماء' }).click();
  await expect(page.getByText('تمت إضافة ٣ أسماء')).toBeVisible();
  await expect(page.getByText('١. محمد أحمد')).toBeVisible();

  // Edit
  await page.locator('.big-row', { hasText: 'خالد حسن' }).getByRole('button', { name: 'تعديل' }).click();
  await page.getByLabel('الاسم الجديد').fill('خالد حسين');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('٣. خالد حسين')).toBeVisible();

  // Reorder
  await page.locator('.big-row', { hasText: 'فاطمة علي' }).getByRole('button', { name: '▲ تقديم' }).click();
  await expect(page.getByText('١. فاطمة علي')).toBeVisible();

  // Delete: "لا" keeps, "نعم، احذف" deletes
  const row = page.locator('.big-row', { hasText: 'محمد أحمد' });
  await row.getByRole('button', { name: 'حذف' }).click();
  await expect(page.getByText('هل أنت متأكد أنك تريد حذف محمد أحمد؟')).toBeVisible();
  await page.getByRole('button', { name: 'لا', exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('button', { name: 'نعم، احذف' }).click();
  await expect(page.locator('.big-row', { hasText: 'محمد أحمد' })).toHaveCount(0);

  const dash = await dashboard(request, k);
  expect(dash.participants.map(p => p.name).sort()).toEqual(['خالد حسين', 'فاطمة علي'].sort());

  await page.getByRole('link', { name: 'رجوع' }).click();
  await expect(page.getByRole('link', { name: /الإهداء للمتوفين/ })).toBeVisible();
});

test('organizer adds one name', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /الأسماء/ }).click();
  await page.getByLabel('اسم جديد').fill('سارة');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(page.getByText('٢. سارة')).toBeVisible();
});

test('organizer adds and deletes a deceased person', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: /الإهداء للمتوفين/ }).click();
  await page.getByLabel('اسم المتوفى').fill('أحمد محمد');
  await page.getByLabel('تاريخ الوفاة').fill('2020-01-15');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(page.locator('.big-row', { hasText: 'أحمد محمد' })).toBeVisible();
  await page.locator('.big-row', { hasText: 'أحمد محمد' }).getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('button', { name: 'نعم، احذف' }).click();
  await expect(page.locator('.big-row', { hasText: 'أحمد محمد' })).toHaveCount(0);
});

test('legacy login with code and password reaches the menu', async ({ page, request }) => {
  const k = await createKhatma(request, { code: 'ختمة' + Math.floor(Math.random() * 1e6) });
  await page.goto('/manage-login');
  await page.getByLabel('رمز الختمة').fill(k.code);
  await page.getByLabel('كلمة مرور المسؤول').fill(k.password);
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page.getByRole('link', { name: /الأسماء/ })).toBeVisible();
});

test('participant page shows "إدارة الختمة" only on the organizer phone', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addParticipant(request, k, 'محمد أحمد', 1);
  await page.goto(`/k/${k.code}`);
  await expect(page.getByRole('link', { name: /إدارة الختمة/ })).toHaveCount(0);
  await page.goto(manageUrl(k));
  await page.getByRole('link', { name: 'عرض الختمة كما يراها المشاركون' }).click();
  await expect(page.getByRole('link', { name: /إدارة الختمة/ })).toBeVisible();
});

test('stored wrong admin password lands on a recoverable screen', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto('/');
  await page.evaluate(({ id, code }) => {
    localStorage.setItem('khatmas', JSON.stringify({ [id]: { code, adminPassword: 'wrong' } }));
  }, { id: 'x1', code: k.code });
  await page.goto(`/k/${encodeURIComponent(k.code)}/manage`);
  await expect(page.locator('.error-msg')).toBeVisible();
  await page.getByRole('link', { name: 'دخول المنظم' }).click();
  await expect(page.getByLabel('رمز الختمة')).toBeVisible();
});
