import { test, expect } from '@playwright/test';
import { createKhatma, addMany, addDeceased, markCompleteAsAdmin, updateKhatma } from './api.js';
import { checkPage, claimAs, manageUrl, openManage } from './ui.js';

// Each entry shows one screen, waits until it is really rendered, then the same sweep runs on it:
// overflow, body font, control heights, banned words, accessible names, lang/dir.
async function regular(request, extra = {}) {
  const k = await createKhatma(request, { phone: '97336123456', ...extra });
  const [a, b] = await addMany(request, k, ['محمد أحمد', 'فاطمة علي']);
  await addDeceased(request, k, 'أحمد محمد', '2020-01-15');
  return { k, a, b };
}

const SCREENS = [
  { name: 'home (fresh phone)', legacyWords: true, run: async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /إنشاء ختمة جديدة/ })).toBeVisible();
  } },
  { name: 'home (returning, code form open)', legacyWords: true, run: async ({ page, request }) => {
    const { k } = await regular(request);
    await page.goto(`/k/${encodeURIComponent(k.code)}`);
    await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('link', { name: /العودة إلى/ })).toBeVisible();
    await page.getByRole('button', { name: /عندك رمز الختمة/ }).click();
    await expect(page.getByLabel('رمز الختمة')).toBeVisible();
  } },
  { name: 'create step 1', run: async ({ page }) => {
    await page.goto('/create');
    await expect(page.getByText('كيف تريد الختمة؟')).toBeVisible();
  } },
  { name: 'create form (regular)', run: async ({ page }) => {
    await page.goto('/create');
    await page.getByRole('button', { name: /أنا أكتب الأسماء/ }).click();
    await expect(page.getByLabel('اسم الختمة')).toBeVisible();
  } },
  { name: 'create form (regular, more options)', run: async ({ page }) => {
    await page.goto('/create');
    await page.getByRole('button', { name: /أنا أكتب الأسماء/ }).click();
    await page.getByRole('button', { name: /خيارات إضافية/ }).click();
    await expect(page.getByLabel('عدد أيام مخصص (بدل الاختيارات أعلاه)')).toBeVisible();
  } },
  { name: 'create form (quick)', run: async ({ page }) => {
    await page.goto('/create');
    await page.getByRole('button', { name: /كل شخص يختار جزءه بنفسه/ }).click();
    await expect(page.getByLabel('اسم الختمة')).toBeVisible();
  } },
  ...[['regular', /أنا أكتب الأسماء/], ['quick', /كل شخص يختار جزءه بنفسه/]].map(([type, choice]) => ({
    name: `create success (${type})`, run: async ({ page }) => {
      await page.goto('/create');
      await page.getByRole('button', { name: choice }).click();
      await page.getByLabel('اسم الختمة').fill('ختمة عائلة الأحمد');
      await page.getByRole('button', { name: 'إنشاء الختمة' }).click();
      await expect(page.getByText('تم إنشاء الختمة بنجاح 🌷')).toBeVisible();
    }
  })),
  { name: 'participant: who are you', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await page.goto(`/k/${encodeURIComponent(k.code)}`);
    await expect(page.getByText('مَن أنت؟ اضغط على اسمك')).toBeVisible();
  } },
  { name: 'participant: are you X?', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await page.goto(`/k/${encodeURIComponent(k.code)}`);
    await page.getByRole('button', { name: 'محمد أحمد', exact: true }).click();
    await expect(page.getByText('هل أنت محمد أحمد؟')).toBeVisible();
  } },
  { name: 'participant: main', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await claimAs(page, k, 'محمد أحمد');
    await expect(page.getByText('جزؤك الحالي')).toBeVisible();
  } },
  { name: 'participant: main, list open', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await claimAs(page, k, 'محمد أحمد');
    await page.getByRole('button', { name: /عرض المشاركين/ }).click();
    await expect(page.getByText('الجزء ٢ — فاطمة علي')).toBeVisible();
  } },
  { name: 'participant: done', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await claimAs(page, k, 'محمد أحمد');
    await page.getByRole('button', { name: /أنهيت قراءة الجزء/ }).click();
    await expect(page.getByText('تم تسجيل أنك أنهيت الجزء ١.')).toBeVisible();
  } },
  { name: 'participant: undo dialog', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await claimAs(page, k, 'محمد أحمد');
    await page.getByRole('button', { name: /أنهيت قراءة الجزء/ }).click();
    await page.getByRole('button', { name: 'تراجع' }).click();
    await expect(page.getByText('هل تريد التراجع عن تسجيل القراءة؟')).toBeVisible();
  } },
  { name: 'participant: all finished', run: async ({ page, request }) => {
    const { k, b } = await regular(request);
    await markCompleteAsAdmin(request, k, b._id);
    await claimAs(page, k, 'محمد أحمد');
    await page.getByRole('button', { name: /أنهيت قراءة الجزء/ }).click();
    await expect(page.getByText('🎉 تمت الختمة بحمد الله')).toBeVisible();
  } },
  { name: 'participant: paused', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await updateKhatma(request, k, { pausedFrom: '2020-01-01', pausedTo: '2099-01-01' });
    await page.goto(`/k/${encodeURIComponent(k.code)}`);
    await expect(page.getByText(/الختمة متوقفة مؤقتًا/)).toBeVisible();
  } },
  { name: 'participant: no names yet', run: async ({ page, request }) => {
    const k = await createKhatma(request);
    await page.goto(`/k/${encodeURIComponent(k.code)}`);
    await expect(page.getByText(/لم يُضِف منظم الختمة الأسماء بعد/)).toBeVisible();
  } },
  { name: 'quick: picker', run: async ({ page, request }) => {
    const k = await createKhatma(request, { quick: true, phone: '97336123456' });
    await page.goto(`/k/${encodeURIComponent(k.code)}`);
    await expect(page.getByText('اختر الجزء الذي ستقرؤه')).toBeVisible();
  } },
  { name: 'quick: name form', run: async ({ page, request }) => {
    const k = await createKhatma(request, { quick: true });
    await page.goto(`/k/${encodeURIComponent(k.code)}`);
    await page.getByRole('button', { name: 'اختر هذا الجزء' }).first().click();
    await expect(page.getByLabel('اكتب اسمك')).toBeVisible();
  } },
  { name: 'quick: participant main', run: async ({ page, request }) => {
    const k = await createKhatma(request, { quick: true });
    await page.goto(`/k/${encodeURIComponent(k.code)}`);
    await page.getByRole('button', { name: 'اختر هذا الجزء' }).first().click();
    await page.getByLabel('اكتب اسمك').fill('سعيد علي');
    await page.getByRole('button', { name: 'تأكيد' }).click();
    await expect(page.getByText('جزؤك الحالي')).toBeVisible();
  } },
  { name: 'manage: menu (regular)', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await openManage(page, k);
    await expect(page.getByRole('link', { name: /السجل والإحصائيات/ })).toBeVisible();
  } },
  { name: 'manage: menu (quick)', run: async ({ page, request }) => {
    const k = await createKhatma(request, { quick: true });
    await openManage(page, k);
    await expect(page.getByRole('link', { name: /الأسماء/ })).toBeVisible();
  } },
  ...[
    ['names', /الأسماء/, 'اسم جديد'],
    ['deceased', /الإهداء للمتوفين/, 'اسم المتوفى'],
    ['finished', /تسجيل من أنهى القراءة/, null, 'سجّل أنه أنهى'],
    ['send', /إرسال للعائلة/, null, 'إرسال توزيع الأجزاء كاملًا'],
    ['pause', /إيقاف مؤقت/, 'من يوم'],
    ['settings', /الإعدادات/, 'اسم الختمة'],
    ['history', /السجل والإحصائيات/, null, 'سجل الختمات السابقة']
  ].map(([id, link, label, text]) => ({
    name: `manage: ${id}`, run: async ({ page, request }) => {
      const { k, a } = await regular(request);
      await markCompleteAsAdmin(request, k, a._id);
      await openManage(page, k);
      await page.getByRole('link', { name: link }).first().click();
      if (label) await expect(page.getByLabel(label)).toBeVisible();
      else await expect(page.getByText(text).first()).toBeVisible();
    }
  })),
  { name: 'manage: names (quick)', run: async ({ page, request }) => {
    const k = await createKhatma(request, { quick: true });
    await addMany(request, k, ['محمد أحمد', 'فاطمة علي']);
    await openManage(page, k);
    await page.getByRole('link', { name: /الأسماء/ }).click();
    await expect(page.getByText('١. محمد أحمد')).toBeVisible();
  } },
  { name: 'manage: names bulk', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await openManage(page, k);
    await page.getByRole('link', { name: /الأسماء/ }).click();
    await page.getByRole('button', { name: 'إضافة عدة أسماء مرة واحدة' }).click();
    await expect(page.getByLabel('اكتب كل اسم في سطر')).toBeVisible();
  } },
  { name: 'manage: names edit', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await openManage(page, k);
    await page.getByRole('link', { name: /الأسماء/ }).click();
    await page.getByRole('button', { name: 'تعديل' }).first().click();
    await expect(page.getByLabel('الاسم الجديد')).toBeVisible();
  } },
  { name: 'manage: names delete dialog', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await openManage(page, k);
    await page.getByRole('link', { name: /الأسماء/ }).click();
    await page.getByRole('button', { name: 'حذف' }).first().click();
    await expect(page.getByText('هل أنت متأكد أنك تريد حذف محمد أحمد؟')).toBeVisible();
  } },
  { name: 'manage: deceased edit', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await openManage(page, k);
    await page.getByRole('link', { name: /الإهداء للمتوفين/ }).click();
    await page.getByRole('button', { name: 'تعديل' }).first().click();
    await expect(page.getByLabel('تاريخ الوفاة')).toBeVisible();
  } },
  { name: 'manage: finished (quick)', run: async ({ page, request }) => {
    const k = await createKhatma(request, { quick: true });
    await addMany(request, k, ['محمد أحمد']);
    await openManage(page, k);
    await page.getByRole('link', { name: /تسجيل من أنهى القراءة/ }).click();
    await expect(page.getByRole('button', { name: 'سجّل أنه أنهى' })).toBeVisible();
  } },
  { name: 'manage: pause (paused)', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await updateKhatma(request, k, { pausedFrom: '2020-01-01', pausedTo: '2099-01-01' });
    await openManage(page, k);
    await page.getByRole('link', { name: /إيقاف مؤقت/ }).click();
    await expect(page.getByRole('button', { name: 'استئناف الختمة' })).toBeVisible();
  } },
  { name: 'manage: settings (advanced, regular)', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await openManage(page, k);
    await page.getByRole('link', { name: /الإعدادات/ }).click();
    await page.getByRole('button', { name: /خيارات متقدمة/ }).click();
    await expect(page.getByRole('button', { name: /تنزيل ملف Excel/ })).toBeVisible();
  } },
  { name: 'manage: settings (advanced, quick)', run: async ({ page, request }) => {
    const k = await createKhatma(request, { quick: true });
    await openManage(page, k);
    await page.getByRole('link', { name: /الإعدادات/ }).click();
    await page.getByRole('button', { name: /خيارات متقدمة/ }).click();
    await expect(page.getByRole('button', { name: /تنزيل ملف Excel/ })).toBeVisible();
  } },
  { name: 'manage: settings (advanced, after copy)', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await openManage(page, k);
    await page.getByRole('link', { name: /الإعدادات/ }).click();
    await page.getByRole('button', { name: /خيارات متقدمة/ }).click();
    await page.getByRole('button', { name: /نسخ الختمة/ }).click();
    await expect(page.getByRole('link', { name: /فتح النسخة/ })).toBeVisible();
  } },
  { name: 'manage: settings delete dialog', run: async ({ page, request }) => {
    const { k } = await regular(request);
    await openManage(page, k);
    await page.getByRole('link', { name: /الإعدادات/ }).click();
    await page.getByRole('button', { name: /خيارات متقدمة/ }).click();
    await page.getByRole('button', { name: 'حذف الختمة' }).click();
    await expect(page.getByText(/هل أنت متأكد أنك تريد حذف الختمة كلها/)).toBeVisible();
  } },
  { name: 'manage: stats', run: async ({ page, request }) => {
    const { k, a } = await regular(request);
    await markCompleteAsAdmin(request, k, a._id);
    await openManage(page, k);
    await page.getByRole('link', { name: /السجل والإحصائيات/ }).click();
    await page.getByRole('link', { name: 'الإحصائيات' }).click();
    await expect(page.getByText('ترتيب المشاركين')).toBeVisible();
  } },
  { name: 'legacy login', legacyWords: true, run: async ({ page }) => {
    await page.goto('/manage-login');
    await expect(page.getByLabel('رمز الختمة')).toBeVisible();
  } },
  { name: 'not found', run: async ({ page }) => {
    await page.goto('/no/such/page');
    await expect(page.getByText('الصفحة غير موجودة')).toBeVisible();
  } },
  { name: 'wrong participant link', run: async ({ page }) => {
    await page.goto('/k/does-not-exist');
    await expect(page.getByText('لم نجد هذه الختمة.')).toBeVisible();
  } },
  { name: 'wrong manage link', run: async ({ page }) => {
    await page.goto('/m/does-not-exist#whatever');
    await expect(page.getByText(/رابط الإدارة غير صحيح/)).toBeVisible();
  } }
];

for (const screen of SCREENS) {
  test(`sweep: ${screen.name}`, async ({ page, request }) => {
    await screen.run({ page, request });
    await checkPage(page, { legacyWords: !!screen.legacyWords });
  });
}

test('sweep: key screens at a very narrow phone width (320px) do not overflow', async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const { k } = await regular(request);
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  for (const u of ['/', '/create', `/k/${encodeURIComponent(k.code)}`, '/manage-login', '/nope']) {
    await page.goto(u);
    await page.waitForLoadState('networkidle');
    expect(await fits(), u).toBe(true);
  }
  await openManage(page, k);
  for (const sub of ['names', 'deceased', 'finished', 'send', 'pause', 'settings', 'history', 'stats']) {
    await page.goto(manageUrl(k, sub));
    await page.waitForLoadState('networkidle');
    expect(await fits(), sub).toBe(true);
  }
});
