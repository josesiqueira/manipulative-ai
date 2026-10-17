import { expect, test, type Page, type Route } from '@playwright/test';

// A fake backend for the three endpoints the consent flow uses. Every test
// starts with it; the real API is covered by the backend tests.
interface Fake {
  sessions: Record<string, { id: string; consent_accepted_at: string | null }>;
  calls: { method: string; path: string; body: unknown }[];
}

async function fakeApi(page: Page, seed: Fake['sessions'] = {}): Promise<Fake> {
  const fake: Fake = { sessions: { ...seed }, calls: [] };
  await page.route('**/api/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postDataJSON?.() ?? null;
    fake.calls.push({ method: req.method(), path: url.pathname, body });
    const json = (status: number, data: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (req.method() === 'POST' && url.pathname === '/api/sessions') {
      const id = `s${Object.keys(fake.sessions).length + 1}-0000-0000-0000-000000000000`;
      const consented = body && body.age_confirmed === true;
      fake.sessions[id] = { id, consent_accepted_at: consented ? '2026-10-23T16:00:00+03:00' : null };
      return json(201, { ...fake.sessions[id], created_at: '2026-10-23T16:00:00+03:00' });
    }
    const m = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (req.method() === 'GET' && m) {
      const s = fake.sessions[m[1]];
      return s ? json(200, { ...s, created_at: '2026-10-23T16:00:00+03:00' }) : json(404, { detail: 'Session not found' });
    }
    if (req.method() === 'POST' && url.pathname === '/api/conversations') {
      const s = fake.sessions[body?.session_id];
      if (!s) return json(404, { detail: 'Session not found' });
      if (!s.consent_accepted_at) return json(403, { detail: 'Consent required' });
      return json(201, { id: 'c1', starter_topic: null, is_complete: false });
    }
    return json(500, { detail: `unexpected ${req.method()} ${url.pathname}` });
  });
  return fake;
}

const sessionCalls = (fake: Fake) => fake.calls.filter((c) => c.path === '/api/sessions' && c.method === 'POST');
const conversationCalls = (fake: Fake) => fake.calls.filter((c) => c.path === '/api/conversations');

test.describe('consent gate', () => {
  test('chat without a session goes to consent and makes no API call', async ({ page }) => {
    const fake = await fakeApi(page);
    await page.goto('/fi/chat');
    await expect(page).toHaveURL(/\/fi\/consent$/);
    expect(fake.calls).toHaveLength(0);
    await expect(page.getByTestId('chat-title')).toHaveCount(0);
  });

  test('chat with a stored session the server does not know goes to consent', async ({ page }) => {
    const fake = await fakeApi(page);
    await page.goto('/fi/');
    await page.evaluate(() => localStorage.setItem('sessionId', 'ghost'));
    await page.goto('/fi/chat');
    await expect(page).toHaveURL(/\/fi\/consent$/);
    expect(conversationCalls(fake)).toHaveLength(0);
    expect(await page.evaluate(() => localStorage.getItem('sessionId'))).toBeNull();
  });

  test('chat with a stored session without consent goes to consent', async ({ page }) => {
    const fake = await fakeApi(page, { s0: { id: 's0', consent_accepted_at: null } });
    await page.goto('/fi/');
    await page.evaluate(() => localStorage.setItem('sessionId', 's0'));
    await page.goto('/fi/chat');
    await expect(page).toHaveURL(/\/fi\/consent$/);
    expect(conversationCalls(fake)).toHaveLength(0);
  });

  test('start stays disabled until every box is ticked; a reload resets the boxes', async ({ page }) => {
    const fake = await fakeApi(page);
    await page.goto('/fi/consent');
    const start = page.getByTestId('consent-start');
    const boxes = page.locator('[data-consent-box]');
    await expect(boxes).toHaveCount(2); // PUBLIC_PROVIDER_BLOCK=finnish: no transfer checkbox
    await expect(start).toBeDisabled();
    await boxes.nth(0).check();
    await expect(start).toBeDisabled();
    await boxes.nth(1).check();
    await expect(start).toBeEnabled();
    await page.reload();
    await expect(page.locator('[data-consent-box]:checked')).toHaveCount(0);
    await expect(page.getByTestId('consent-start')).toBeDisabled();
    expect(fake.calls).toHaveLength(0);
  });

  test('consent text never claims encryption', async ({ page }) => {
    await fakeApi(page);
    for (const lang of ['fi', 'en']) {
      await page.goto(`/${lang}/consent`);
      const text = (await page.getByTestId('consent-bullets').innerText()).toLowerCase();
      expect(text).not.toContain('encrypted');
      expect(text).not.toContain('salattuna');
      expect(text).toContain(lang === 'fi' ? '31.12.2028' : '31 december 2028');
    }
  });

  test('declining stores nothing and sends nothing', async ({ page }) => {
    const fake = await fakeApi(page);
    await page.goto('/fi/consent');
    await page.getByTestId('consent-decline').click();
    await expect(page).toHaveURL(/\/fi\/declined$/);
    await expect(page.getByTestId('declined-title')).toBeVisible();
    expect(fake.calls).toHaveLength(0);
    expect(await page.evaluate(() => localStorage.getItem('sessionId'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('conversationId'))).toBeNull();
  });

  test('accepting creates the session with consent, then the conversation, then opens the chat', async ({ page }) => {
    const fake = await fakeApi(page);
    await page.goto('/en/consent');
    for (const box of await page.locator('[data-consent-box]').all()) await box.check();
    await page.getByTestId('consent-start').click();
    await expect(page).toHaveURL(/\/en\/chat$/);
    await expect(page.getByTestId('chat-title')).toBeVisible();

    const [sessionCall] = sessionCalls(fake);
    expect(sessionCall.body).toEqual({ consent_version: '2026-10-23-v1', age_confirmed: true, language: 'en' });
    const [conversationCall] = conversationCalls(fake);
    expect(conversationCall.body).toMatchObject({ session_id: sessionCall ? Object.keys(fake.sessions)[0] : '', language: 'en' });
    expect(fake.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/sessions',
      'POST /api/conversations',
      `GET /api/sessions/${Object.keys(fake.sessions)[0]}`,
    ]);
    expect(await page.evaluate(() => localStorage.getItem('conversationId'))).toBe('c1');
  });

  test('a consented session skips the consent page on the next start', async ({ page }) => {
    const fake = await fakeApi(page, { ok: { id: 'ok', consent_accepted_at: '2026-10-23T16:00:00+03:00' } });
    await page.goto('/fi/');
    await page.evaluate(() => localStorage.setItem('sessionId', 'ok'));
    await page.getByTestId('landing-start').click();
    await expect(page).toHaveURL(/\/fi\/chat$/);
    expect(sessionCalls(fake)).toHaveLength(0);
    expect(conversationCalls(fake)).toHaveLength(1);
    expect(conversationCalls(fake)[0].body).toMatchObject({ session_id: 'ok', language: 'fi' });
  });

  test('landing start without a session goes to consent', async ({ page }) => {
    const fake = await fakeApi(page);
    await page.goto('/en/');
    await expect(page.getByTestId('study-line')).toContainText('18+');
    await page.getByTestId('landing-start').click();
    await expect(page).toHaveURL(/\/en\/consent$/);
    expect(fake.calls).toHaveLength(0);
  });
});

test.describe('language', () => {
  test('logo and texts follow the language', async ({ page }) => {
    await fakeApi(page);
    await page.goto('/fi/consent');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ennen kuin aloitat');
    await expect(page.getByTestId('tau-logo')).toHaveAttribute('src', '/tampere/tau-fi-negative.svg');
    await page.getByRole('link', { name: 'In English' }).click();
    await expect(page).toHaveURL(/\/en\/consent$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Before you start');
    await expect(page.getByTestId('tau-logo')).toHaveAttribute('src', '/tampere/tau-en-negative.svg');
    expect(await page.evaluate(() => localStorage.getItem('language'))).toBe('en');
    await page.goto('/');
    await expect(page).toHaveURL(/\/en\/$/);
  });

  test('notices render in both languages with the provider text filled', async ({ page }) => {
    await fakeApi(page);
    await page.goto('/fi/info/privacy-notice');
    const fi = await page.getByTestId('notice').innerText();
    expect(fi).toContain('Tampereen yliopiston GPT-Lab');
    expect(fi).not.toContain('{{');
    expect(fi).toContain('31.12.2028');
    await page.goto('/en/info/research-notification');
    const en = await page.getByTestId('notice').innerText();
    expect(en).toContain("Tampere University's own servers");
    expect(en).not.toContain('{{');
  });
});

test.describe('phone width', () => {
  for (const path of ['/fi/', '/fi/consent', '/fi/declined', '/fi/info/privacy-notice', '/en/info/research-notification']) {
    test(`${path} does not scroll sideways`, async ({ page }) => {
      await fakeApi(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
    });
  }
});
