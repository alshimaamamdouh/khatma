import { test, expect } from '@playwright/test';
import { createKhatma, joinQuick } from './api.js';

test('quick khatma: pick a free juz, type name, land on my juz', async ({ page, request }) => {
  const k = await createKhatma(request, { quick: true });
  await joinQuick(request, k, 'خالد', 2);
  await page.goto(`/k/${k.code}`);
  await expect(page.getByText('اختر الجزء الذي ستقرؤه')).toBeVisible();
  await expect(page.getByText('الجزء ٢ — خالد')).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/quick-list.png', fullPage: true });

  await page.locator('.big-row', { hasText: 'الجزء ١ — متاح' }).getByRole('button', { name: 'اختر هذا الجزء' }).click();
  await page.getByLabel('اكتب اسمك').fill('محمد');
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.getByText('السلام عليكم يا محمد')).toBeVisible();
  await expect(page.locator('.juz-hero-number')).toHaveText('الجزء ١');
  await expect(page.getByText(/يتغير الجزء يوم/)).toHaveCount(0);
});

test('quick khatma: juz taken meanwhile shows a clear message', async ({ page, request }) => {
  const k = await createKhatma(request, { quick: true });
  await page.goto(`/k/${k.code}`);
  await page.locator('.big-row', { hasText: 'الجزء ٣ — متاح' }).getByRole('button', { name: 'اختر هذا الجزء' }).click();
  await joinQuick(request, k, 'سارة', 3);
  await page.getByLabel('اكتب اسمك').fill('محمد');
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.getByText('هذا الجزء أخذه شخص آخر، اختر جزءًا آخر')).toBeVisible();
  await expect(page.getByText('الجزء ٣ — سارة')).toBeVisible();
});
