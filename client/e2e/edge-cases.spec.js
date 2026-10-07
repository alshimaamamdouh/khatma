import { test, expect } from '@playwright/test';
import {
  createKhatma, addParticipant, addMany, joinQuick, updateKhatma, deleteParticipant,
  markCompleteAsAdmin, completedCount
} from './api.js';
import { claimAs, manageUrl, openManage } from './ui.js';

const kUrl = k => `/k/${encodeURIComponent(k.code)}`;
const FINISH = /أنهيت قراءة الجزء/;

test('paused khatma: participant sees the paused banner and no juz card; unpausing restores it', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['محمد أحمد', 'فاطمة علي']);
  await claimAs(page, k, 'محمد أحمد');
  await expect(page.locator('.juz-hero-number')).toBeVisible();

  await updateKhatma(request, k, { pausedFrom: '2020-01-01', pausedTo: '2099-01-01' });
  await page.reload();
  await expect(page.locator('.paused-banner')).toContainText('الختمة متوقفة مؤقتًا');
  await expect(page.locator('.juz-hero')).toHaveCount(0);
  await expect(page.getByRole('button', { name: FINISH })).toHaveCount(0);

  await updateKhatma(request, k, { pausedFrom: '', pausedTo: '' });
  await page.reload();
  await expect(page.locator('.paused-banner')).toHaveCount(0);
  await expect(page.locator('.juz-hero-number')).toBeVisible();
  await expect(page.getByRole('button', { name: FINISH })).toBeVisible();
});

test('all finished: last person finishing shows the celebration and the khatma dua', async ({ page, request }) => {
  const k = await createKhatma(request);
  const [, b] = await addMany(request, k, ['محمد أحمد', 'فاطمة علي']);
  await claimAs(page, k, 'محمد أحمد');
  await expect(page.getByText('🎉 تمت الختمة بحمد الله')).toHaveCount(0);
  await markCompleteAsAdmin(request, k, b._id);
  await page.getByRole('button', { name: FINISH }).click();
  await expect(page.getByText('🎉 تمت الختمة بحمد الله')).toBeVisible();
  await expect(page.getByText('دعاء ختم القرآن')).toBeVisible();
  await expect(page.getByText('أنهى جميع المشاركين قراءتهم')).toBeVisible();
  await expect(page.getByText('٢ من ٢ شخصًا أنهوا القراءة')).toBeVisible();

  // Undoing takes the celebration away again
  await page.getByRole('button', { name: 'تراجع' }).click();
  await page.getByRole('button', { name: 'نعم، تراجع' }).click();
  await expect(page.getByText('🎉 تمت الختمة بحمد الله')).toHaveCount(0);
});

test('organizer deletes a remembered participant: next visit asks "مَن أنت؟" again', async ({ page, request }) => {
  const k = await createKhatma(request);
  const [a] = await addMany(request, k, ['محمد أحمد', 'فاطمة علي']);
  await claimAs(page, k, 'محمد أحمد');
  await deleteParticipant(request, k, a._id);
  await page.reload();
  await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
  await expect(page.getByRole('button', { name: 'محمد أحمد', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'فاطمة علي', exact: true })).toBeVisible();
  // and it stays forgotten
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('khatmas')));
  expect(Object.values(stored)[0].participantToken).toBeUndefined();
});

test('empty regular khatma tells the visitor the organizer has not added names yet', async ({ page, request }) => {
  const k = await createKhatma(request);
  await page.goto(kUrl(k));
  await expect(page.getByText(/لم يُضِف منظم الختمة الأسماء بعد/)).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
});

test('quick khatma with all 30 juz taken offers no "اختر هذا الجزء" button', async ({ page, request }) => {
  const k = await createKhatma(request, { quick: true });
  for (let i = 1; i <= 30; i++) await joinQuick(request, k, `شخص ${i}`, i);
  await page.goto(kUrl(k));
  await expect(page.getByText('اختر الجزء الذي ستقرؤه')).toBeVisible();
  await expect(page.locator('.big-row.taken')).toHaveCount(30);
  await expect(page.getByRole('button', { name: 'اختر هذا الجزء' })).toHaveCount(0);
  await expect(page.getByText('متاح')).toHaveCount(0);
});

test('quick khatma: a taken juz is not offered; with one left only that one is', async ({ page, request }) => {
  const k = await createKhatma(request, { quick: true });
  for (let i = 1; i <= 29; i++) await joinQuick(request, k, `شخص ${i}`, i);
  await page.goto(kUrl(k));
  await expect(page.getByRole('button', { name: 'اختر هذا الجزء' })).toHaveCount(1);
  await expect(page.getByText('الجزء ٣٠ — متاح')).toBeVisible();
});

test('quick khatma: someone grabs the juz first -> friendly message and a fresh picker', async ({ page, request }) => {
  const k = await createKhatma(request, { quick: true });
  await page.goto(kUrl(k));
  await page.getByRole('button', { name: 'اختر هذا الجزء' }).first().click();
  await expect(page.getByText('الجزء ١', { exact: true })).toBeVisible();
  await joinQuick(request, k, 'سبقني', 1);
  await page.getByLabel('اكتب اسمك').fill('سعيد علي');
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.getByText('هذا الجزء أخذه شخص آخر، اختر جزءًا آخر')).toBeVisible();
  await expect(page.getByText('الجزء ١ — سبقني')).toBeVisible();
});

test('quick khatma: empty name is refused; "رجوع" goes back to the picker', async ({ page, request }) => {
  const k = await createKhatma(request, { quick: true });
  await page.goto(kUrl(k));
  await page.getByRole('button', { name: 'اختر هذا الجزء' }).first().click();
  await page.getByLabel('اكتب اسمك').fill('   ');
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.getByText('الرجاء كتابة اسمك')).toBeVisible();
  await page.getByRole('button', { name: 'رجوع' }).click();
  await expect(page.getByText('اختر الجزء الذي ستقرؤه')).toBeVisible();
});

test('quick khatma: "غيّر الاسم" goes back to the picker, and joining again works', async ({ page, request }) => {
  const k = await createKhatma(request, { quick: true });
  await page.goto(kUrl(k));
  await page.getByRole('button', { name: 'اختر هذا الجزء' }).first().click();
  await page.getByLabel('اكتب اسمك').fill('سعيد علي');
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.getByText('السلام عليكم يا سعيد')).toBeVisible();
  await expect(page.locator('.juz-hero-number')).toHaveText('الجزء ١');

  await page.getByRole('button', { name: /لست سعيد؟ غيّر الاسم/ }).click();
  await expect(page.getByText('اختر الجزء الذي ستقرؤه')).toBeVisible();
  await expect(page.getByText('الجزء ١ — سعيد علي')).toBeVisible();

  // pick a different juz under a new name
  await page.getByRole('button', { name: 'اختر هذا الجزء' }).first().click();
  await expect(page.getByText('الجزء ٢', { exact: true })).toBeVisible();
  await page.getByLabel('اكتب اسمك').fill('خالد عمر');
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.locator('.juz-hero-number')).toHaveText('الجزء ٢');
});

test('quick khatma: the joined person can finish and it is remembered after reload', async ({ page, request }) => {
  const k = await createKhatma(request, { quick: true });
  await page.goto(kUrl(k));
  await page.getByRole('button', { name: 'اختر هذا الجزء' }).nth(4).click();
  await page.getByLabel('اكتب اسمك').fill('سعيد علي');
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.locator('.juz-hero-number')).toHaveText('الجزء ٥');
  await page.getByRole('button', { name: FINISH }).click();
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ٥.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ٥.')).toBeVisible();
  expect(await completedCount(request, k)).toBe(1);
});

test('organizer who is also a participant on the same phone: marks own juz and sees the manage link', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['محمد أحمد', 'فاطمة علي']);
  await openManage(page, k); // organizer password is now stored on this phone
  await claimAs(page, k, 'محمد أحمد');
  const manage = page.getByRole('link', { name: /إدارة الختمة/ });
  await expect(manage).toBeVisible();
  await page.getByRole('button', { name: FINISH }).click();
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toBeVisible();
  expect(await completedCount(request, k)).toBe(1);
  await manage.click();
  await expect(page.getByRole('link', { name: /الإعدادات/ })).toBeVisible();
});

test('a plain participant (no organizer password) never sees the manage link', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['محمد أحمد']);
  await claimAs(page, k, 'محمد أحمد');
  await expect(page.getByRole('link', { name: /إدارة الختمة/ })).toHaveCount(0);
});

test('two khatmas on one phone: home returns to the last opened; switching and marking work both ways', async ({ page, request }) => {
  const a = await createKhatma(request, { name: 'ختمة الأولى' });
  const b = await createKhatma(request, { name: 'ختمة الثانية' });
  await addParticipant(request, a, 'محمد أحمد', 1);
  await addParticipant(request, b, 'سعيد علي', 1);

  await claimAs(page, a, 'محمد أحمد');
  await claimAs(page, b, 'سعيد علي');

  await page.goto('/');
  await expect(page.getByRole('link', { name: /العودة إلى: ختمة الثانية/ })).toBeVisible();
  await page.getByRole('link', { name: /العودة إلى: ختمة الثانية/ }).click();
  await expect(page.getByRole('heading', { name: 'ختمة الثانية' })).toBeVisible();
  await expect(page.getByText('السلام عليكم يا سعيد')).toBeVisible();
  await page.getByRole('button', { name: FINISH }).click();
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toBeVisible();
  expect(await completedCount(request, b)).toBe(1);
  expect(await completedCount(request, a)).toBe(0);

  // switch to A: it is remembered with its own participant
  await page.goto(kUrl(a));
  await expect(page.getByRole('heading', { name: 'ختمة الأولى' })).toBeVisible();
  await expect(page.getByText('السلام عليكم يا محمد')).toBeVisible();
  await page.getByRole('button', { name: FINISH }).click();
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toBeVisible();
  expect(await completedCount(request, a)).toBe(1);

  await page.goto('/');
  await expect(page.getByRole('link', { name: /العودة إلى: ختمة الأولى/ })).toBeVisible();
  await page.getByRole('link', { name: /العودة إلى: ختمة الأولى/ }).click();
  await expect(page.getByRole('heading', { name: 'ختمة الأولى' })).toBeVisible();
});

test('two khatmas: organizer of one, participant of the other', async ({ page, request }) => {
  const a = await createKhatma(request, { name: 'ختمة المنظم' });
  const b = await createKhatma(request, { name: 'ختمة الضيف' });
  await addParticipant(request, b, 'سعيد علي', 1);
  await openManage(page, a);
  await claimAs(page, b, 'سعيد علي');
  await expect(page.getByRole('link', { name: /إدارة الختمة/ })).toHaveCount(0);
  await page.goto(kUrl(a));
  await expect(page.getByRole('link', { name: /إدارة الختمة/ })).toBeVisible();
});

test('undo after reload works', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['محمد أحمد']);
  await claimAs(page, k, 'محمد أحمد');
  await page.getByRole('button', { name: FINISH }).click();
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toBeVisible();
  await page.getByRole('button', { name: 'تراجع' }).click();
  await page.getByRole('button', { name: 'نعم، تراجع' }).click();
  await expect(page.getByRole('button', { name: FINISH })).toBeVisible();
  expect(await completedCount(request, k)).toBe(0);
  await page.reload();
  await expect(page.getByRole('button', { name: FINISH })).toBeVisible();
});

test('triple tap on "نعم" in "هل أنت…؟" claims the name once', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['محمد أحمد']);
  await page.goto(kUrl(k));
  await page.getByRole('button', { name: 'محمد أحمد', exact: true }).click();
  let claims = 0;
  page.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/claim')) claims++; });
  await page.getByRole('button', { name: 'نعم', exact: true }).click({ clickCount: 3 });
  await expect(page.getByText('السلام عليكم يا محمد')).toBeVisible();
  expect(claims).toBe(1);
});

test('claiming the same name on a second phone shows the same completion state', async ({ browser, page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['محمد أحمد']);
  await claimAs(page, k, 'محمد أحمد');
  await page.getByRole('button', { name: FINISH }).click();
  await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toBeVisible();

  const ctx = await browser.newContext({ locale: 'ar', viewport: { width: 390, height: 844 } });
  const second = await ctx.newPage();
  await claimAs(second, k, 'محمد أحمد');
  // the completion belongs to the participant, so the second phone sees it as done
  await expect(second.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toBeVisible();
  await ctx.close();
});

test('Hijri toggle changes how dates are shown on the participant screen', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['محمد أحمد']);
  await openManage(page, k);
  await claimAs(page, k, 'محمد أحمد');
  const before = await page.locator('.juz-hero-next').innerText();
  expect(before).not.toMatch(/محرم|صفر|ربيع|جمادى|رجب|شعبان|رمضان|شوال|ذو الق|ذو الح/);

  await page.goto(manageUrl(k, 'settings'));
  await page.getByRole('button', { name: /خيارات متقدمة/ }).click();
  await page.getByLabel('عرض التواريخ بالتقويم الهجري').check();
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.getByText('تم الحفظ')).toBeVisible();
  // only the display changed, so no schedule confirmation was needed
  await expect(page.getByText(/سيغيّر جزء كل شخص/)).toHaveCount(0);

  await page.goto(kUrl(k));
  await expect(page.getByText('السلام عليكم يا محمد')).toBeVisible();
  const after = await page.locator('.juz-hero-next').innerText();
  expect(after).toMatch(/محرم|صفر|ربيع|جمادى|رجب|شعبان|رمضان|شوال|ذو الق|ذو الح/);
  expect(after).not.toBe(before);
});

test('clearing the help phone in settings hides the help link on the participant screen', async ({ page, request }) => {
  const k = await createKhatma(request, { phone: '97336123456' });
  await addMany(request, k, ['محمد أحمد']);
  await openManage(page, k);
  await claimAs(page, k, 'محمد أحمد');
  await expect(page.getByRole('link', { name: /تحتاج مساعدة/ })).toBeVisible();

  await page.goto(manageUrl(k, 'settings'));
  await expect(page.getByLabel(/رقم واتساب للمساعدة/)).toHaveValue('97336123456');
  await page.getByLabel(/رقم واتساب للمساعدة/).fill('');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.getByText('تم الحفظ')).toBeVisible();

  await page.goto(kUrl(k));
  await expect(page.getByText('السلام عليكم يا محمد')).toBeVisible();
  await expect(page.getByText(/تحتاج مساعدة/)).toHaveCount(0);
});

test('participant list marks finished people and keeps the order by juz', async ({ page, request }) => {
  const k = await createKhatma(request);
  const [, b] = await addMany(request, k, ['محمد أحمد', 'فاطمة علي', 'عمر خالد']);
  await markCompleteAsAdmin(request, k, b._id);
  await claimAs(page, k, 'محمد أحمد');
  await page.getByRole('button', { name: /عرض المشاركين/ }).click();
  const rows = page.locator('.status-list li');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('الجزء ١ — محمد أحمد');
  await expect(rows.nth(1)).toContainText('فاطمة علي');
  await expect(rows.nth(1)).toContainText('✅ أنهى');
  await expect(rows.nth(2)).toContainText('⏳ لم ينته بعد');
  await expect(page.getByText('١ من ٣ شخصًا أنهوا القراءة')).toBeVisible();
  await page.getByRole('button', { name: /إخفاء المشاركين/ }).click();
  await expect(page.locator('.status-list')).toHaveCount(0);
});

test('regular khatma shows the dedication line for the deceased; quick khatma does not', async ({ page, request }) => {
  const k = await createKhatma(request);
  await addMany(request, k, ['محمد أحمد']);
  await request.post('http://localhost:3000/api/khatma/' + k.id + '/deceased', {
    headers: { 'x-admin-password': encodeURIComponent(k.password) },
    data: { name: 'أحمد محمد', deathDate: '2020-01-15' }
  });
  await claimAs(page, k, 'محمد أحمد');
  await expect(page.getByText(/إهداءً إلى روح أحمد محمد/)).toBeVisible();

  const q = await createKhatma(request, { quick: true });
  await page.goto(kUrl(q));
  await expect(page.getByText('اختر الجزء الذي ستقرؤه')).toBeVisible();
  await expect(page.getByText(/إهداءً/)).toHaveCount(0);
});
