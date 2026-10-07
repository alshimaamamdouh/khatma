import { test, expect } from '@playwright/test';
import { createKhatma, addMany, addDeceased, getKhatmaData, dashboard } from './api.js';
import { openManage, openManageScreen, manageUrl } from './ui.js';

test('quick khatma menu hides dedication, pause and history', async ({ page, request }) => {
  const k = await createKhatma(request, { quick: true });
  await openManage(page, k);
  for (const shown of [/الأسماء/, /تسجيل من أنهى القراءة/, /إرسال للعائلة/, /الإعدادات/]) {
    await expect(page.getByRole('link', { name: shown })).toBeVisible();
  }
  for (const hidden of [/الإهداء/, /إيقاف مؤقت/, /السجل/]) {
    await expect(page.getByRole('link', { name: hidden })).toHaveCount(0);
  }
  await expect(page.locator('.tile')).toHaveCount(4);
});

test('regular khatma menu shows all seven tiles', async ({ page, request }) => {
  const k = await createKhatma(request);
  await openManage(page, k);
  await expect(page.locator('.tile')).toHaveCount(7);
  await expect(page.getByRole('link', { name: 'عرض الختمة كما يراها المشاركون' })).toBeVisible();
});

test('quick khatma names screen has no reorder buttons; regular has them', async ({ page, request }) => {
  const q = await createKhatma(request, { quick: true });
  await addMany(request, q, ['محمد أحمد', 'فاطمة علي']);
  await openManageScreen(page, q, /الأسماء/);
  await expect(page.locator('.big-row')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /تقديم|تأخير/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'تعديل' })).toHaveCount(2);

  const r = await createKhatma(request);
  await addMany(request, r, ['محمد أحمد', 'فاطمة علي']);
  await openManageScreen(page, r, /الأسماء/);
  await expect(page.getByRole('button', { name: /تقديم/ })).toHaveCount(2);
  await expect(page.getByRole('button', { name: /تأخير/ })).toHaveCount(2);
});

test('names: adding beyond 30 is refused with a clear message', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, Array.from({ length: 30 }, (_, i) => `شخص ${i + 1}`));
  await openManageScreen(page, k, /الأسماء/);
  await expect(page.getByText('الأسماء (٣٠ من ٣٠)')).toBeVisible();
  await page.getByLabel('اسم جديد').fill('واحد زيادة');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(page.getByText('اكتمل العدد: ٣٠ اسمًا')).toBeVisible();
  await expect(page.locator('.big-row')).toHaveCount(30);
  await expect(page.getByText('واحد زيادة')).toHaveCount(0);

  // bulk: too many names for the free slots
  await page.getByRole('button', { name: 'إضافة عدة أسماء مرة واحدة' }).click();
  await page.getByLabel('اكتب كل اسم في سطر').fill('أ\nب');
  await page.getByRole('button', { name: 'إضافة الأسماء' }).click();
  await expect(page.getByText(/يمكن إضافة .* أسماء فقط/)).toBeVisible();
  await expect(page.locator('.big-row')).toHaveCount(30);
});

test('names: bulk add ignores blank lines and keeps order; too many for the free slots is refused', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, Array.from({ length: 27 }, (_, i) => `شخص ${i + 1}`));
  await openManageScreen(page, k, /الأسماء/);
  await page.getByRole('button', { name: 'إضافة عدة أسماء مرة واحدة' }).click();
  await page.getByLabel('اكتب كل اسم في سطر').fill('أحمد\n\n   \nسالم  \n\n\nخالد\n');
  await page.getByRole('button', { name: 'إضافة الأسماء' }).click();
  await expect(page.getByText('تمت إضافة ٣ أسماء')).toBeVisible();
  await expect(page.locator('.big-row')).toHaveCount(30);
  await expect(page.locator('.big-row').nth(27)).toContainText('أحمد');
  await expect(page.locator('.big-row').nth(28)).toContainText('سالم');
  await expect(page.locator('.big-row').nth(29)).toContainText('خالد');
  // the bulk form closed again
  await expect(page.getByLabel('اكتب كل اسم في سطر')).toHaveCount(0);
});

test('names: bulk add with only blank lines asks for a name', async ({ page, request }) => {
  const k = await createKhatma(request);
  await openManageScreen(page, k, /الأسماء/);
  await page.getByRole('button', { name: 'إضافة عدة أسماء مرة واحدة' }).click();
  await page.getByLabel('اكتب كل اسم في سطر').fill('\n  \n\n');
  await page.getByRole('button', { name: 'إضافة الأسماء' }).click();
  await expect(page.getByText('الرجاء كتابة اسم واحد على الأقل')).toBeVisible();
});

test('names: single add with blank name is refused; trimmed name is added', async ({ page, request }) => {
  const k = await createKhatma(request);
  await openManageScreen(page, k, /الأسماء/);
  await page.getByLabel('اسم جديد').fill('   ');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(page.getByText('الرجاء كتابة الاسم')).toBeVisible();
  await expect(page.locator('.big-row')).toHaveCount(0);
  await page.getByLabel('اسم جديد').fill('  محمد  ');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(page.getByText('١. محمد', { exact: true })).toBeVisible();
  await expect(page.getByLabel('اسم جديد')).toHaveValue('');
});

test('names: reorder buttons are disabled at the ends and swap neighbours', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['أول', 'ثاني', 'ثالث']);
  await openManageScreen(page, k, /الأسماء/);
  const rows = page.locator('.big-row');
  await expect(rows.nth(0).getByRole('button', { name: /تقديم/ })).toBeDisabled();
  await expect(rows.nth(0).getByRole('button', { name: /تأخير/ })).toBeEnabled();
  await expect(rows.nth(2).getByRole('button', { name: /تأخير/ })).toBeDisabled();
  await expect(rows.nth(2).getByRole('button', { name: /تقديم/ })).toBeEnabled();

  await rows.nth(0).getByRole('button', { name: /تأخير/ }).click();
  await expect(rows.nth(0)).toContainText('ثاني');
  await expect(rows.nth(1)).toContainText('أول');
  await expect(rows.nth(1).getByRole('button', { name: /تقديم/ })).toBeEnabled();
  await rows.nth(2).getByRole('button', { name: /تقديم/ }).click();
  await expect(rows.nth(1)).toContainText('ثالث');
  await expect(rows.nth(2)).toContainText('أول');
  await expect(rows.nth(2).getByRole('button', { name: /تأخير/ })).toBeDisabled();
});

test('names: rename, rename with empty name is refused, delete asks first and "لا" keeps the name', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['محمد', 'فاطمة']);
  await openManageScreen(page, k, /الأسماء/);
  await page.locator('.big-row').first().getByRole('button', { name: 'تعديل' }).click();
  await page.getByLabel('الاسم الجديد').fill('   ');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('الرجاء كتابة الاسم')).toBeVisible();
  await page.getByLabel('الاسم الجديد').fill('محمد علي');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('تم حفظ الاسم')).toBeVisible();
  await expect(page.getByText('١. محمد علي')).toBeVisible();

  await page.locator('.big-row').nth(1).getByRole('button', { name: 'حذف' }).click();
  await expect(page.getByText('هل أنت متأكد أنك تريد حذف فاطمة؟')).toBeVisible();
  await page.getByRole('button', { name: 'لا', exact: true }).click();
  await expect(page.locator('.big-row')).toHaveCount(2);
  await page.locator('.big-row').nth(1).getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('button', { name: 'نعم، احذف' }).click();
  await expect(page.getByText('تم حذف فاطمة')).toBeVisible();
  await expect(page.locator('.big-row')).toHaveCount(1);
});

test('names: a new name takes the first free slot after a deletion', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['أول', 'ثاني', 'ثالث']);
  await openManageScreen(page, k, /الأسماء/);
  await page.locator('.big-row').nth(1).getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('button', { name: 'نعم، احذف' }).click();
  await expect(page.locator('.big-row')).toHaveCount(2);
  await page.getByLabel('اسم جديد').fill('رابع');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(page.locator('.big-row')).toHaveCount(3);
  // slot 2 was free, so the new person is second in the list
  await expect(page.locator('.big-row').nth(1)).toContainText('رابع');
});

test('deceased: add, edit name and date, delete', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addDeceased(request, k, 'أحمد محمد', '2020-01-15');
  await openManageScreen(page, k, /الإهداء للمتوفين/);
  await expect(page.locator('.big-row')).toHaveCount(1);

  await page.getByRole('button', { name: 'تعديل' }).click();
  await expect(page.getByLabel('الاسم', { exact: true })).toHaveValue('أحمد محمد');
  await expect(page.getByLabel('تاريخ الوفاة')).toHaveValue('2020-01-15');
  await page.getByLabel('الاسم', { exact: true }).fill('أحمد علي');
  await page.getByLabel('تاريخ الوفاة').fill('2021-03-04');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.locator('.big-row')).toContainText('أحمد علي');
  await expect(page.locator('.big-row')).not.toContainText('أحمد محمد');

  // the saved values come back when editing again
  await page.getByRole('button', { name: 'تعديل' }).click();
  await expect(page.getByLabel('الاسم', { exact: true })).toHaveValue('أحمد علي');
  await expect(page.getByLabel('تاريخ الوفاة')).toHaveValue('2021-03-04');
  // "رجوع" leaves without saving
  await page.getByLabel('الاسم', { exact: true }).fill('لن يُحفظ');
  await page.getByRole('button', { name: 'رجوع' }).click();
  await expect(page.locator('.big-row')).toContainText('أحمد علي');

  await page.getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('button', { name: 'نعم، احذف' }).click();
  await expect(page.locator('.big-row')).toHaveCount(0);
});

test('deceased: add needs a name and a date', async ({ page, request }) => {
  const k = await createKhatma(request);
  await openManageScreen(page, k, /الإهداء للمتوفين/);
  await page.getByLabel('اسم المتوفى').fill('أحمد محمد');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(page.getByText('الرجاء كتابة الاسم وتاريخ الوفاة')).toBeVisible();
  await page.getByLabel('تاريخ الوفاة').fill('2020-01-15');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await expect(page.locator('.big-row')).toHaveCount(1);
  await expect(page.getByLabel('اسم المتوفى')).toHaveValue('');
});

test('deceased: edit with an empty name is refused and nothing is saved', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addDeceased(request, k, 'أحمد محمد', '2020-01-15');
  await openManageScreen(page, k, /الإهداء للمتوفين/);
  await page.getByRole('button', { name: 'تعديل' }).click();
  await page.getByLabel('الاسم', { exact: true }).fill('');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('الرجاء كتابة الاسم وتاريخ الوفاة')).toBeVisible();
  await page.getByRole('button', { name: 'رجوع' }).click();
  await expect(page.locator('.big-row')).toContainText('أحمد محمد');
});

test('settings: changing only the name does not ask the schedule confirmation', async ({ page, request }) => {
  const k = await createKhatma(request);
  await openManageScreen(page, k, /الإعدادات/);
  await page.getByLabel('اسم الختمة').fill('اسم آخر');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.getByText('تم الحفظ')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await getKhatmaData(request, k)).name).toBe('اسم آخر');
  await expect(page.getByRole('heading', { name: 'إدارة: اسم آخر' })).toBeVisible();
});

test('settings: an empty name is refused', async ({ page, request }) => {
  const k = await createKhatma(request);
  await openManageScreen(page, k, /الإعدادات/);
  await page.getByLabel('اسم الختمة').fill('  ');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.getByText('الرجاء كتابة اسم الختمة')).toBeVisible();
  expect((await getKhatmaData(request, k)).name).toBe(k.name);
});

test('settings: changing the schedule asks first; "لا" does not save; "نعم" does', async ({ page, request }) => {
  const k = await createKhatma(request);
  await openManageScreen(page, k, /الإعدادات/);
  await page.getByLabel('كل شهر').check();
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'لا', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('تم الحفظ')).toHaveCount(0);
  expect((await getKhatmaData(request, k)).rotation_type).toBe('weekly');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.getByRole('button', { name: 'نعم، احفظ' }).click();
  await expect(page.getByText('تم الحفظ')).toBeVisible();
  expect((await getKhatmaData(request, k)).rotation_type).toBe('monthly');
  // saved: changing only the name now does not ask again
  await page.getByLabel('اسم الختمة').fill('بعد التغيير');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('settings: custom number of days is saved after confirmation', async ({ page, request }) => {
  const k = await createKhatma(request);
  await openManageScreen(page, k, /الإعدادات/);
  await page.getByRole('button', { name: /خيارات متقدمة/ }).click();
  await page.getByLabel('عدد أيام مخصص (بدل الاختيارات أعلاه)').fill('10');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.getByRole('button', { name: 'نعم، احفظ' }).click();
  await expect(page.getByText('تم الحفظ')).toBeVisible();
  const data = await getKhatmaData(request, k);
  expect(data.rotation_type).toBe('custom');
  expect(data.custom_days).toBe(10);

  // reopening shows the custom days, and clicking a standard schedule clears them
  await page.goto(manageUrl(k, 'settings'));
  await page.getByRole('button', { name: /خيارات متقدمة/ }).click();
  await expect(page.getByLabel('عدد أيام مخصص (بدل الاختيارات أعلاه)')).toHaveValue('10');
  await page.getByLabel('كل أسبوع', { exact: true }).check();
  await expect(page.getByLabel('عدد أيام مخصص (بدل الاختيارات أعلاه)')).toHaveValue('');
});

test('settings: quick khatma saves the name without any schedule confirmation', async ({ page, request }) => {
  const k = await createKhatma(request, { quick: true });
  await openManageScreen(page, k, /الإعدادات/);
  await expect(page.getByText('متى تتغير الأجزاء؟')).toHaveCount(0);
  await page.getByLabel('اسم الختمة').fill('ختمة سريعة جديدة');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.getByText('تم الحفظ')).toBeVisible();
  expect((await getKhatmaData(request, k)).name).toBe('ختمة سريعة جديدة');
});

test('pause validation: end before start and empty fields show a message and save nothing', async ({ page, request }) => {
  const k = await createKhatma(request);
  await openManageScreen(page, k, /إيقاف مؤقت/);
  await page.getByRole('button', { name: 'إيقاف الختمة' }).click();
  await expect(page.getByText('الرجاء اختيار اليومين')).toBeVisible();
  await page.getByLabel('من يوم').fill('2099-02-01');
  await page.getByRole('button', { name: 'إيقاف الختمة' }).click();
  await expect(page.getByText('الرجاء اختيار اليومين')).toBeVisible();
  await page.getByLabel('إلى يوم').fill('2099-01-01');
  await page.getByRole('button', { name: 'إيقاف الختمة' }).click();
  await expect(page.getByText('يوم النهاية يجب أن يكون بعد يوم البداية')).toBeVisible();
  expect((await dashboard(request, k)).paused).toBe(false);
  // a valid range works and the message goes away
  await page.getByLabel('إلى يوم').fill('2099-03-01');
  await page.getByRole('button', { name: 'إيقاف الختمة' }).click();
  await expect(page.getByRole('button', { name: 'استئناف الختمة' })).toBeVisible();
  await expect(page.getByText('يوم النهاية يجب أن يكون بعد يوم البداية')).toHaveCount(0);
});

test('pause: a future pause (not started yet) does not stop the khatma today', async ({ page, request }) => {
  const k = await createKhatma(request);
  await openManageScreen(page, k, /إيقاف مؤقت/);
  await page.getByLabel('من يوم').fill('2098-01-01');
  await page.getByLabel('إلى يوم').fill('2098-02-01');
  await page.getByRole('button', { name: 'إيقاف الختمة' }).click();
  // The screen shows what was saved; the participant side only pauses once the range starts
  await expect(page.getByRole('button', { name: /استئناف الختمة|إيقاف الختمة/ })).toBeVisible();
  expect((await dashboard(request, k)).paused).toBe(false);
});

test('send screen: no reminder link when everybody has finished', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['محمد أحمد']);
  await openManageScreen(page, k, /تسجيل من أنهى القراءة/);
  await page.getByRole('button', { name: 'سجّل أنه أنهى' }).click();
  await expect(page.getByText('✅ أنهى')).toBeVisible();
  await page.getByRole('link', { name: 'رجوع' }).click();
  await page.getByRole('link', { name: /إرسال للعائلة/ }).click();
  await expect(page.getByRole('link', { name: /تذكير/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /توزيع الأجزاء/ })).toBeVisible();
});

test('finished screen: nobody finished says it in words, not with a zero', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['محمد أحمد', 'فاطمة علي']);
  await openManageScreen(page, k, /تسجيل من أنهى القراءة/);
  await expect(page.getByText('لم يُسجِّل أحد إنهاء القراءة بعد')).toBeVisible();
  await page.getByRole('button', { name: 'سجّل أنه أنهى' }).first().click();
  await expect(page.getByText('١ من ٢ أنهوا القراءة')).toBeVisible();
});

test('history shows a finished cycle after everybody finished', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['محمد أحمد']);
  await openManageScreen(page, k, /تسجيل من أنهى القراءة/);
  await page.getByRole('button', { name: 'سجّل أنه أنهى' }).click();
  await expect(page.getByText('✅ أنهى')).toBeVisible();
  await page.getByRole('link', { name: 'رجوع' }).click();
  await page.getByRole('link', { name: /السجل والإحصائيات/ }).click();
  await expect(page.getByText('سجل الختمات السابقة')).toBeVisible();
  await expect(page.getByText('مكتملة')).toBeVisible();
});

test('delete khatma: "لا" at either step keeps the khatma', async ({ page, request }) => {
  const k = await createKhatma(request);
  await openManageScreen(page, k, /الإعدادات/);
  await page.getByRole('button', { name: /خيارات متقدمة/ }).click();
  await page.getByRole('button', { name: 'حذف الختمة' }).click();
  await page.getByRole('button', { name: 'لا', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'حذف الختمة' }).click();
  await page.getByRole('button', { name: 'نعم، احذف' }).click();
  await page.getByRole('button', { name: 'لا', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await getKhatmaData(request, k)).name).toBe(k.name);
});

test('manage back buttons return to the menu from every screen', async ({ page, request }) => {
  const k = await createKhatma(request);
  await openManage(page, k);
  for (const link of [/الأسماء/, /الإهداء للمتوفين/, /تسجيل من أنهى القراءة/, /إرسال للعائلة/, /إيقاف مؤقت/, /الإعدادات/]) {
    await page.getByRole('link', { name: link }).click();
    await page.getByRole('link', { name: 'رجوع' }).click();
    await expect(page.locator('.tile')).toHaveCount(7);
  }
});
