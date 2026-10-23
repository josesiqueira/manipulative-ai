import { expect, test, type Page, type Route } from '@playwright/test';

// A fake backend for the endpoints the consent flow uses. Every test starts
// with it; the real API is covered by the backend tests. GET /api/provider
// answers gptlab (the model on Tampere University's servers: two checkboxes)
// and is counted apart from the calls, since it sends nothing about the
// participant.
interface Fake {
  // finished: the survey is done, so the API refuses new conversations.
  sessions: Record<string, { id: string; consent_accepted_at: string | null; finished?: boolean }>;
  calls: { method: string; path: string; body: unknown }[];
  providerCalls: number;
}

async function fakeApi(page: Page, seed: Fake['sessions'] = {}): Promise<Fake> {
  const fake: Fake = { sessions: { ...seed }, calls: [], providerCalls: 0 };
  await page.route('**/api/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postDataJSON?.() ?? null;
    const json = (status: number, data: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (req.method() === 'GET' && url.pathname === '/api/provider') {
      fake.providerCalls++;
      return json(200, { provider: 'gptlab', model: 'qwen3.8-27b', model_name: 'Qwen3.8 27B' });
    }
    fake.calls.push({ method: req.method(), path: url.pathname, body });

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
      if (s.finished) return json(403, { detail: 'Session finished' });
      return json(201, { id: 'c1', starter_topic: null, is_complete: false });
    }
    // The chat page reads the stored conversation and its (empty) history.
    if (req.method() === 'GET' && url.pathname === '/api/conversations/c1') return json(200, { id: 'c1', starter_topic: null, is_complete: false });
    if (req.method() === 'GET' && url.pathname === '/api/conversations/c1/messages') return json(200, []);
    return json(500, { detail: `unexpected ${req.method()} ${url.pathname}` });
  });
  return fake;
}

// The page knows which provider answers (its texts are shown, its boxes counted).
const providerReady = (page: Page, id = 'gptlab') => expect(page.locator('html')).toHaveAttribute('data-provider', id);

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
    await providerReady(page);
    const start = page.getByTestId('consent-start');
    const boxes = page.locator('[data-consent-box]');
    await expect(boxes).toHaveCount(2); // gptlab: no transfer checkbox
    await expect(start).toBeDisabled();
    await boxes.nth(0).check();
    await expect(start).toBeDisabled();
    await boxes.nth(1).check();
    await expect(start).toBeEnabled();
    await page.reload();
    await providerReady(page);
    await expect(page.locator('[data-consent-box]:checked')).toHaveCount(0);
    await expect(page.getByTestId('consent-start')).toBeDisabled();
    expect(fake.calls).toHaveLength(0);
    expect(fake.providerCalls).toBe(2); // once per page load
  });

  test('consent text never claims encryption', async ({ page }) => {
    await fakeApi(page);
    for (const lang of ['fi', 'en']) {
      await page.goto(`/${lang}/consent`);
      await providerReady(page);
      const text = (await page.getByTestId('consent-bullets').innerText()).toLowerCase();
      expect(text).not.toContain('encrypted');
      expect(text).not.toContain('salattuna');
      expect(text).toContain(lang === 'fi' ? '31.12.2028' : '31 december 2028');
      // Voice input is disclosed before consent.
      expect(text).toContain(lang === 'fi' ? 'mikrofonilla' : 'microphone');
    }
  });

  test('the notices never claim encryption at rest and disclose the microphone', async ({ page }) => {
    await fakeApi(page);
    for (const lang of ['fi', 'en']) {
      for (const doc of ['privacy-notice', 'research-notification']) {
        await page.goto(`/${lang}/info/${doc}`);
        await providerReady(page);
        const text = (await page.getByTestId('notice').innerText()).toLowerCase();
        for (const word of ['encrypted', 'salattu', 'salattuna', 'encryption at rest', 'salaus tallennuksessa', '[18]', 'if stored', 'jos tallennetaan', '10 tai 15']) {
          expect(text, `${lang} ${doc}`).not.toContain(word);
        }
        expect(text, `${lang} ${doc}`).toContain(lang === 'fi' ? 'mikrofonia' : 'microphone');
      }
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
    await providerReady(page);
    for (const box of await page.locator('[data-consent-box]').all()) await box.check();
    await page.getByTestId('consent-start').click();
    await expect(page).toHaveURL(/\/en\/chat$/);
    await expect(page.getByTestId('transcript')).toBeVisible();

    const [sessionCall] = sessionCalls(fake);
    expect(sessionCall.body).toEqual({ consent_version: '2026-10-23-v1+gptlab', age_confirmed: true, language: 'en' });
    const [conversationCall] = conversationCalls(fake);
    expect(conversationCall.body).toMatchObject({ session_id: Object.keys(fake.sessions)[0], language: 'en' });
    expect(fake.calls.map((c) => `${c.method} ${c.path}`).slice(0, 3)).toEqual([
      'POST /api/sessions',
      'POST /api/conversations',
      `GET /api/sessions/${Object.keys(fake.sessions)[0]}`,
    ]);
    expect(await page.evaluate(() => localStorage.getItem('conversationId'))).toBe('c1');
  });

  test('Start always shows the consent page, and consent makes a new session, even with a consented session stored', async ({ page }) => {
    const fake = await fakeApi(page, { ok: { id: 'ok', consent_accepted_at: '2026-10-23T16:00:00+03:00' } });
    await page.goto('/fi/');
    await page.evaluate(() => localStorage.setItem('sessionId', 'ok'));
    await page.getByTestId('landing-start').click();
    await expect(page).toHaveURL(/\/fi\/consent$/);
    expect(conversationCalls(fake)).toHaveLength(0);
    // The consent page forgets the stored session: another person may have left it.
    expect(await page.evaluate(() => localStorage.getItem('sessionId'))).toBeNull();
    await providerReady(page);
    for (const box of await page.locator('[data-consent-box]').all()) await box.check();
    await page.getByTestId('consent-start').click();
    await expect(page).toHaveURL(/\/fi\/chat$/);
    expect(sessionCalls(fake)).toHaveLength(1);
    const newId = await page.evaluate(() => localStorage.getItem('sessionId'));
    expect(newId).not.toBe('ok');
    expect(conversationCalls(fake).map((c) => (c.body as { session_id: string }).session_id)).toEqual([newId]);
  });

  test('consent with a stored finished session starts a new session instead', async ({ page }) => {
    const fake = await fakeApi(page, { done: { id: 'done', consent_accepted_at: '2026-10-23T16:00:00+03:00', finished: true } });
    await page.goto('/fi/');
    await page.evaluate(() => localStorage.setItem('sessionId', 'done'));
    await page.goto('/fi/consent');
    await providerReady(page);
    for (const box of await page.locator('[data-consent-box]').all()) await box.check();
    await page.getByTestId('consent-start').click();
    await expect(page).toHaveURL(/\/fi\/chat$/);
    await expect(page.getByTestId('transcript')).toBeVisible();
    expect(sessionCalls(fake)).toHaveLength(1);
    const newId = await page.evaluate(() => localStorage.getItem('sessionId'));
    expect(newId).not.toBe('done');
    expect(conversationCalls(fake).map((c) => (c.body as { session_id: string }).session_id)).toEqual([newId]);
  });

  test('a stored session whose survey is done never reaches the chat again', async ({ page }) => {
    const fake = await fakeApi(page, { done: { id: 'done', consent_accepted_at: '2026-10-23T16:00:00+03:00', finished: true } });
    await page.goto('/fi/');
    // Without the browser's survey note: the API's 403 "Session finished" is enough.
    await page.evaluate(() => localStorage.setItem('sessionId', 'done'));
    await page.goto('/fi/chat');
    await expect(page).toHaveURL(/\/fi\/consent$/);
    expect(await page.evaluate(() => localStorage.getItem('sessionId'))).toBeNull();
    // With the note, the landing page's Start goes straight to consent.
    await page.evaluate(() => {
      localStorage.setItem('sessionId', 'done');
      localStorage.setItem('surveySubmitted', '1');
    });
    await page.goto('/fi/');
    await page.getByTestId('landing-start').click();
    await expect(page).toHaveURL(/\/fi\/consent$/);
    expect(await page.evaluate(() => localStorage.getItem('sessionId'))).toBeNull();
    expect(conversationCalls(fake)).toHaveLength(1);
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
    await providerReady(page);
    const fi = await page.getByTestId('notice').innerText();
    expect(fi).toContain('Tampereen yliopiston GPT-Lab');
    expect(fi).toContain('kielimalli Qwen3.8 27B yliopiston');
    expect(fi).not.toContain('{{');
    expect(fi).toContain('31.12.2028');
    await page.goto('/en/info/research-notification');
    await providerReady(page);
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
      await expect(page.getByTestId('tau-logo')).toBeVisible();
    });
  }
});
