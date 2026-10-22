import { expect, test, type Page, type Route } from '@playwright/test';

// The model provider is chosen at run time: the pages ask GET /api/provider
// and show that provider's texts. Every provider shows its own consent bullet,
// boxes and notices; without an answer nobody can start; the consent records
// the provider; the thank-you page has one note per provider that answered.

type ProviderId = 'openai' | 'anthropic' | 'gptlab';

const MODEL: Record<ProviderId, { model: string; model_name: string }> = {
  openai: { model: 'gpt-6-astra', model_name: 'GPT-6 Astra' },
  anthropic: { model: 'claude-sonnet-5-5', model_name: 'Claude Sonnet 5.5' },
  gptlab: { model: 'qwen3.8-27b', model_name: 'Qwen3.8 27B' },
};

interface Call { method: string; path: string; body: unknown }

// provider: what GET /api/provider answers, or an HTTP status for a failure.
// models: the debrief's "models" for session 'ok'.
async function fakeApi(page: Page, provider: ProviderId | number, models: unknown[] = []): Promise<Call[]> {
  const calls: Call[] = [];
  await page.route('**/api/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postDataJSON?.() ?? null;
    calls.push({ method: req.method(), path: url.pathname, body });
    const json = (status: number, data: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (req.method() === 'GET' && url.pathname === '/api/provider') {
      if (typeof provider === 'number') return json(provider, { detail: 'No model provider is configured' });
      return json(200, { provider, ...MODEL[provider] });
    }
    if (req.method() === 'POST' && url.pathname === '/api/sessions') {
      return json(201, { id: 's1', created_at: 'x', consent_accepted_at: '2026-10-23T16:00:00+03:00' });
    }
    if (req.method() === 'GET' && /^\/api\/sessions\/(s1|ok)$/.test(url.pathname)) {
      return json(200, { id: url.pathname.split('/').pop(), created_at: 'x', consent_accepted_at: '2026-10-23T16:00:00+03:00' });
    }
    if (req.method() === 'POST' && url.pathname === '/api/conversations') return json(201, { id: 'c1', starter_topic: null, is_complete: false });
    if (req.method() === 'GET' && url.pathname === '/api/conversations/c1') return json(200, { id: 'c1', starter_topic: null, is_complete: false });
    if (req.method() === 'GET' && url.pathname === '/api/conversations/c1/messages') return json(200, []);
    if (req.method() === 'GET' && url.pathname === '/api/sessions/ok/debrief') {
      return json(200, {
        session_code: '3F2A-9C11',
        data_deleted: false,
        conversations: [{ id: 'c1', party_display_name: 'SDP', is_populist: false, framing: 'antipopulist', started_at: '2026-10-23T16:05:00' }],
        models,
      });
    }
    return json(500, { detail: `unexpected ${req.method()} ${url.pathname}` });
  });
  return calls;
}

const providerReady = (page: Page, id: ProviderId) => expect(page.locator('html')).toHaveAttribute('data-provider', id);

// A phrase only that provider's texts contain, per language and place.
const EXPECT: Record<ProviderId, { boxes: number; bullet: Record<'fi' | 'en', string>; notice13: Record<'fi' | 'en', string>; notification3: Record<'fi' | 'en', string> }> = {
  openai: {
    boxes: 3,
    bullet: { fi: 'lähettää viestisi OpenAI-yhtiölle', en: 'sends your messages to OpenAI, which processes them outside the EU' },
    notice13: { fi: 'OpenAI Ireland Ltd', en: 'OpenAI is not certified under the EU-US Data Privacy Framework' },
    notification3: { fi: 'OpenAI-yhtiön tekoälymallilla (GPT-6 Astra)', en: 'provided by OpenAI (GPT-6 Astra)' },
  },
  anthropic: {
    boxes: 3,
    bullet: { fi: 'lähettää viestisi Anthropic-yhtiölle', en: 'sends your messages to Anthropic, which processes them outside the EU' },
    notice13: { fi: 'Anthropic Ireland, Limited', en: 'Anthropic Ireland, Limited (Dublin, Ireland) acts as processor' },
    notification3: { fi: 'Anthropic-yhtiön tekoälymallilla (Claude Sonnet 5.5)', en: 'provided by Anthropic (Claude Sonnet 5.5)' },
  },
  gptlab: {
    boxes: 2,
    bullet: { fi: 'Tampereen yliopiston omilla palvelimilla Suomessa', en: "Tampere University's own servers in Finland" },
    notice13: { fi: 'kielimalli Qwen3.8 27B yliopiston omilla palvelimilla', en: 'the language model Qwen3.8 27B operated by the GPT-Lab research group' },
    notification3: { fi: 'kielimallilla Qwen3.8 27B, joka toimii', en: 'the language model Qwen3.8 27B, which runs' },
  },
};

const OTHERS = (id: ProviderId) => (['openai', 'anthropic', 'gptlab'] as ProviderId[]).filter((p) => p !== id);

for (const id of ['openai', 'anthropic', 'gptlab'] as ProviderId[]) {
  test(`${id}: the consent page and both notices show its texts and no other provider's`, async ({ page }) => {
    await fakeApi(page, id);
    for (const lang of ['fi', 'en'] as const) {
      await page.goto(`/${lang}/consent`);
      await providerReady(page, id);
      await expect(page.locator('[data-consent-box]')).toHaveCount(EXPECT[id].boxes);
      await expect(page.getByTestId(`provider-bullet-${id}`)).toBeVisible();
      for (const other of OTHERS(id)) await expect(page.getByTestId(`provider-bullet-${other}`)).toBeHidden();
      const bullets = await page.getByTestId('consent-bullets').innerText();
      expect(bullets).toContain(EXPECT[id].bullet[lang]);
      for (const other of OTHERS(id)) expect(bullets).not.toContain(EXPECT[other].bullet[lang]);
      if (EXPECT[id].boxes === 3) {
        await expect(page.locator(`label[for="cb-transfer-${id}"]`)).toBeVisible();
        await expect(page.locator(`label[for="cb-transfer-${id}"]`)).toContainText(lang === 'fi' ? 'EU:n ulkopuolella' : 'outside the EU');
      }
      // Every box is required: one short of all keeps Start disabled.
      const start = page.getByTestId('consent-start');
      const boxes = await page.locator('[data-consent-box]').all();
      for (const box of boxes.slice(0, -1)) await box.check();
      await expect(start).toBeDisabled();
      await boxes[boxes.length - 1].check();
      await expect(start).toBeEnabled();

      await page.goto(`/${lang}/info/privacy-notice`);
      await providerReady(page, id);
      const notice = await page.getByTestId('notice').innerText();
      expect(notice).toContain(EXPECT[id].notice13[lang]);
      for (const other of OTHERS(id)) expect(notice).not.toContain(EXPECT[other].notice13[lang]);
      for (const marker of ['{{', '[MODEL NAME]', '[MALLIN NIMI]']) expect(notice).not.toContain(marker);
      // The provider block itself carries no open item (the rest of the notice has the owner's own).
      await expect(page.getByTestId(`provider-notice-${id}`)).toBeVisible();
      for (const other of OTHERS(id)) await expect(page.getByTestId(`provider-notice-${other}`)).toBeHidden();
      const block = await page.getByTestId(`provider-notice-${id}`).innerText();
      expect(block).not.toMatch(/\[|tarkistettava|verify/);

      await page.goto(`/${lang}/info/research-notification`);
      await providerReady(page, id);
      const notification = await page.getByTestId('notice').innerText();
      expect(notification).toContain(EXPECT[id].notification3[lang]);
      for (const other of OTHERS(id)) expect(notification).not.toContain(EXPECT[other].notification3[lang].split(' (')[0]);
      for (const marker of ['{{', '[MODEL NAME]', '[MALLIN NIMI]']) expect(notification).not.toContain(marker);
    }
  });
}

for (const status of [503, 500]) {
  test(`a failed provider request (${status}) keeps Start disabled and says so`, async ({ page }) => {
    const calls = await fakeApi(page, status);
    await page.goto('/fi/consent');
    await expect(page.locator('html')).toHaveAttribute('data-provider-state', 'error');
    await expect(page.getByTestId('provider-error')).toHaveText('Palvelu ei ole juuri nyt käytettävissä. Yritä hetken päästä uudelleen.');
    for (const id of ['openai', 'anthropic', 'gptlab']) await expect(page.getByTestId(`provider-bullet-${id}`)).toBeHidden();
    for (const box of await page.locator('[data-consent-box]').all()) await box.check();
    await expect(page.getByTestId('consent-start')).toBeDisabled();
    await page.getByTestId('consent-start').click({ force: true });
    expect(calls.filter((c) => c.path === '/api/sessions')).toHaveLength(0);

    await page.goto('/en/info/privacy-notice');
    await expect(page.getByTestId('provider-error')).toHaveText('The service is not available right now. Please try again in a moment.');
  });
}

test('Start stays disabled while the provider is still loading', async ({ page }) => {
  await fakeApi(page, 'gptlab');
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/provider', async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto('/en/consent');
  await expect(page.locator('[data-provider-loading]')).toHaveText('Loading...');
  for (const box of await page.locator('[data-consent-box]').all()) await box.check();
  await expect(page.getByTestId('consent-start')).toBeDisabled();
  release();
  await providerReady(page, 'gptlab');
  await expect(page.locator('[data-provider-loading]')).toBeHidden();
  // The two boxes ticked while loading still count.
  await expect(page.getByTestId('consent-start')).toBeEnabled();
});

for (const id of ['openai', 'anthropic', 'gptlab'] as ProviderId[]) {
  test(`${id}: the session records the provider the participant consented to`, async ({ page }) => {
    const calls = await fakeApi(page, id);
    await page.goto('/en/consent');
    await providerReady(page, id);
    for (const box of await page.locator('[data-consent-box]').all()) await box.check();
    await page.getByTestId('consent-start').click();
    await expect(page).toHaveURL(/\/en\/chat$/);
    const session = calls.find((c) => c.method === 'POST' && c.path === '/api/sessions');
    expect(session?.body).toEqual({ consent_version: `2026-10-23-v1+${id}`, age_confirmed: true, language: 'en' });
    expect(`2026-10-23-v1+${id}`.length).toBeLessThanOrEqual(40);
  });
}

async function thankYou(page: Page, lang: 'fi' | 'en') {
  await page.goto(`/${lang}/`);
  await page.evaluate(() => localStorage.setItem('sessionId', 'ok'));
  await page.goto(`/${lang}/thank-you`);
  await expect(page.getByTestId('debrief')).toBeVisible();
}

test('thank-you: one note per provider that answered, in order of first use, naming its models', async ({ page }) => {
  await fakeApi(page, 'gptlab', [
    { provider: 'anthropic', model: 'claude-sonnet-5-5', model_name: 'Claude Sonnet 5.5' },
    { provider: 'openai', model: 'gpt-6-astra', model_name: 'GPT-6 Astra' },
    { provider: 'anthropic', model: 'claude-opus-5-5', model_name: 'Claude Opus 5.5' },
  ]);
  await thankYou(page, 'en');
  const notes = page.locator('[data-testid="provider-note"]:visible');
  await expect(notes).toHaveCount(2);
  await expect(notes.nth(0)).toHaveText(/^Technical note: the replies were generated by Anthropic's model Claude Sonnet 5\.5 and Claude Opus 5\.5 on servers that may be outside the EU\./);
  await expect(notes.nth(1)).toHaveText(/^Technical note: the replies were generated by OpenAI's model GPT-6 Astra on servers outside the EU\./);
  await expect(page.locator('[data-debrief-note="gptlab"]')).toBeHidden();

  await thankYou(page, 'fi');
  await expect(page.locator('[data-testid="provider-note"]:visible').nth(0)).toContainText('Anthropicin kielimalli Claude Sonnet 5.5 ja Claude Opus 5.5 palvelimilla');
});

test('thank-you: a provider without a model name (data deleted) reads cleanly; no models, no note', async ({ page }) => {
  await fakeApi(page, 'gptlab', [{ provider: 'anthropic', model: '', model_name: '' }]);
  await thankYou(page, 'fi');
  const note = page.locator('[data-testid="provider-note"]:visible');
  await expect(note).toHaveCount(1);
  await expect(note).toHaveText(/^Tekninen huomautus: vastaukset tuotti Anthropicin kielimalli palvelimilla, jotka voivat sijaita EU:n ulkopuolella\./);
  expect(await note.innerText()).not.toMatch(/ {2}|\[/);
  await thankYou(page, 'en');
  await expect(page.locator('[data-testid="provider-note"]:visible')).toHaveText(/^Technical note: the replies were generated by Anthropic's model on servers that may be outside the EU\./);

  await page.unrouteAll();
  await fakeApi(page, 'gptlab', [{ provider: 'gptlab', model: '', model_name: '' }]);
  await thankYou(page, 'en');
  await expect(page.locator('[data-testid="provider-note"]:visible')).toHaveText("Technical note: the replies were generated by the model on Tampere University's own servers in Finland. The messages did not reach any AI company's systems.");

  await page.unrouteAll();
  await fakeApi(page, 'gptlab', []);
  await thankYou(page, 'fi');
  await expect(page.locator('[data-testid="provider-note"]:visible')).toHaveCount(0);
});
