import { test, expect } from '@playwright/test';

test('base text is at least 20px and there is no dark-mode toggle', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ختمة القرآن الكريم' })).toBeVisible();
  const size = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  expect(size).toBeGreaterThanOrEqual(20);
  await expect(page.getByText('الوضع الليلي')).toHaveCount(0);
});

test('old dark-mode preference is cleared', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('darkMode', 'true');
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('darkMode'))).toBeNull();
});
