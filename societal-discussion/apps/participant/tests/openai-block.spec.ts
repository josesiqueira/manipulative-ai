import { expect, test } from '@playwright/test';

// Built with PUBLIC_PROVIDER_BLOCK=openai: three checkboxes and the
// OpenAI texts on the consent page and in both notices.
test('openai block: three boxes, OpenAI bullet, OpenAI notice texts', async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ status: 500, body: '{}' }));
  await page.goto('/en/consent');
  await expect(page.locator('[data-consent-box]')).toHaveCount(3);
  await expect(page.getByTestId('consent-bullets')).toContainText('sends your messages to OpenAI in the United States');
  await expect(page.locator('label[for="cb-transfer"]')).toContainText("processed on OpenAI's servers in the United States");
  const start = page.getByTestId('consent-start');
  for (const box of (await page.locator('[data-consent-box]').all()).slice(0, 2)) await box.check();
  await expect(start).toBeDisabled();

  await page.goto('/en/info/privacy-notice');
  const notice = await page.getByTestId('notice').innerText();
  expect(notice).toContain('Personal data are transferred to the United States');
  expect(notice).not.toContain('{{');
  await page.goto('/fi/info/research-notification');
  const fi = await page.getByTestId('notice').innerText();
  expect(fi).toContain('OpenAI:n palvelimille Yhdysvaltoihin');
  expect(fi).toContain('[MALLIN NIMI]');
});
