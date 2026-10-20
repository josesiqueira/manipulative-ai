import { expect, test, type Page, type Route } from '@playwright/test';

// Survey entry, survey and thank-you with the debrief, against a fake API.
// The real backend is covered by the API tests and by real-flow.spec.ts.

interface Call { method: string; path: string; body: unknown }

interface FakeOptions {
  surveyRow?: boolean; // a survey row already exists (debrief allowed)
  deleted?: boolean;
}

async function fakeApi(page: Page, options: FakeOptions = {}): Promise<Call[]> {
  const calls: Call[] = [];
  let surveyRow = options.surveyRow ?? false;
  let deleted = options.deleted ?? false;
  await page.route('**/api/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postDataJSON?.() ?? null;
    calls.push({ method: req.method(), path: url.pathname, body });
    const json = (status: number, data: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (req.method() === 'GET' && url.pathname === '/api/sessions/ok') {
      return json(200, { id: 'ok', created_at: 'x', consent_accepted_at: '2026-10-23T16:00:00+03:00' });
    }
    if (req.method() === 'POST' && url.pathname === '/api/conversations') return json(201, { id: 'c2', starter_topic: null, is_complete: false });
    if (req.method() === 'PUT' && url.pathname === '/api/conversations/c1/end') return json(200, { status: 'ok' });
    if (req.method() === 'POST' && url.pathname === '/api/survey') {
      surveyRow = true;
      return json(201, { id: 'sv1', session_id: body?.session_id });
    }
    if (req.method() === 'GET' && url.pathname === '/api/sessions/ok/debrief') {
      // As the backend: the survey row gates the debrief, except for a deleted session.
      if (!surveyRow && !deleted) return json(403, { detail: 'Survey not submitted' });
      return json(200, {
        session_code: '3F2A-9C11',
        data_deleted: deleted,
        conversations: [
          { id: 'c1', party_display_name: 'Kokoomus', is_populist: false, framing: 'antipopulist', started_at: '2026-10-23T16:05:00' },
          { id: 'c2', party_display_name: 'Vihreät', is_populist: true, framing: 'populist', started_at: '2026-10-23T16:12:00' },
        ],
      });
    }
    if (req.method() === 'DELETE' && url.pathname === '/api/sessions/ok/data') {
      deleted = true;
      surveyRow = false; // the backend removes the survey rows
      return route.fulfill({ status: 204, body: '' });
    }
    return json(500, { detail: `unexpected ${req.method()} ${url.pathname}` });
  });
  return calls;
}

async function withSession(page: Page, path: string) {
  await page.goto('/fi/');
  await page.evaluate(() => localStorage.setItem('sessionId', 'ok'));
  await page.goto(path);
}

const scale = (page: Page, name: string, value: number) => page.locator(`input[name="${name}"][value="${value}"]`).check();

test.describe('survey and debrief', () => {
  test('survey-entry without a session goes back to the start', async ({ page }) => {
    const calls = await fakeApi(page);
    await page.goto('/fi/survey-entry');
    await expect(page).toHaveURL(/\/fi\/$/);
    expect(calls).toHaveLength(0);
  });

  test('survey-entry leads to the survey or back to a new conversation', async ({ page }) => {
    await fakeApi(page);
    await withSession(page, '/fi/survey-entry');
    await expect(page.getByTestId('survey-entry-title')).toHaveText('Kiitos keskustelusta!');
    await page.getByTestId('survey-entry-back').click();
    await expect(page).toHaveURL(/\/fi\/chat$/);
    await withSession(page, '/en/survey-entry');
    await page.getByTestId('survey-entry-start').click();
    await expect(page).toHaveURL(/\/en\/survey$/);
    await expect(page.getByTestId('survey-title')).toHaveText('Survey');
  });

  test('the survey posts the eleven keys, answered and unanswered, then shows the debrief', async ({ page }) => {
    const calls = await fakeApi(page);
    await withSession(page, '/fi/survey');
    await page.locator('textarea[name="chatbot_usage"]').fill('Päivittäin töissä.');
    await page.locator('input[name="political_chatbot"][value="Kyllä"]').check();
    await scale(page, 'chatbot_perception', 4);
    await scale(page, 'response_speed', 5);
    await scale(page, 'detected_bias', 2);
    await page.locator('textarea[name="notice_anything"]').fill('Puhui "eliitistä".');
    await page.getByTestId('survey-submit').click();
    await expect(page).toHaveURL(/\/fi\/thank-you$/);

    const survey = calls.find((c) => c.path === '/api/survey');
    expect(survey?.body).toEqual({
      session_id: 'ok',
      responses: {
        chatbot_usage: 'Päivittäin töissä.',
        chatbot_which: '',
        political_chatbot: 'Kyllä',
        chatbot_perception: 4,
        conversation_reflection: '',
        response_speed: 5,
        topic_variety: null,
        detected_bias: 2,
        detected_terminology: null,
        detected_persuasion: null,
        notice_anything: 'Puhui "eliitistä".',
      },
    });

    // The debrief: one entry per conversation, the framing sentence varies.
    await expect(page.getByTestId('debrief')).toBeVisible();
    await expect(page.getByTestId('thank-you-plain')).toBeHidden();
    await expect(page.getByTestId('debrief-party')).toHaveText(['Kokoomus', 'Vihreät']);
    const entries = page.getByTestId('debrief-conversation');
    await expect(entries.nth(0).getByTestId('antipopulist-on')).toContainText('antipopulistista');
    await expect(entries.nth(1).getByTestId('populist-on')).toContainText('populistista');
    await expect(page.getByTestId('session-code')).toHaveText('3F2A-9C11');
    // The party is never requested before the survey row exists.
    const debriefCalls = calls.filter((c) => c.path === '/api/sessions/ok/debrief');
    expect(debriefCalls).toHaveLength(1);
    expect(calls.indexOf(debriefCalls[0])).toBeGreaterThan(calls.indexOf(survey!));
  });

  test('a failed submit keeps the answers and shows the error', async ({ page }) => {
    const calls = await fakeApi(page);
    await page.route('**/api/survey', (route) => route.fulfill({ status: 500, body: '{}' }));
    await withSession(page, '/fi/survey');
    await scale(page, 'topic_variety', 3);
    await page.getByTestId('survey-submit').click();
    await expect(page.locator('#error')).toBeVisible();
    await expect(page).toHaveURL(/\/fi\/survey$/);
    await expect(page.locator('input[name="topic_variety"][value="3"]')).toBeChecked();
    await expect(page.getByTestId('survey-submit')).toBeEnabled();
    expect(calls.filter((c) => c.path.endsWith('/debrief'))).toHaveLength(0);
  });

  test('a second visit to the survey after a submit goes to the thank-you page, no second row', async ({ page }) => {
    const calls = await fakeApi(page);
    await withSession(page, '/fi/survey');
    await page.getByTestId('survey-submit').click();
    await expect(page).toHaveURL(/\/fi\/thank-you$/);
    await page.goto('/fi/survey');
    await expect(page).toHaveURL(/\/fi\/thank-you$/);
    expect(calls.filter((c) => c.path === '/api/survey')).toHaveLength(1);
  });

  test('a failed debrief request shows an error with a retry, never the plain text', async ({ page }) => {
    await fakeApi(page, { surveyRow: true });
    let failures = 1;
    await page.route('**/api/sessions/ok/debrief', (route) => {
      if (failures-- > 0) return route.fulfill({ status: 500, body: '{}' });
      return route.fallback();
    });
    await withSession(page, '/fi/thank-you');
    await expect(page.getByTestId('debrief-error')).toBeVisible();
    await expect(page.getByTestId('thank-you-plain')).toBeHidden();
    await page.getByTestId('debrief-retry').click();
    await expect(page.getByTestId('debrief')).toBeVisible();
    await expect(page.getByTestId('debrief-conversation')).toHaveCount(2);
  });

  test('copy puts the code on the clipboard', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are a Chromium feature');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await fakeApi(page, { surveyRow: true });
    await withSession(page, '/en/thank-you');
    await page.getByTestId('copy-code').click();
    await expect(page.getByTestId('copy-code')).toHaveText('Copied');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe('3F2A-9C11');
  });

  test('delete asks on the page, calls DELETE once, then shows the deleted text', async ({ page }) => {
    const calls = await fakeApi(page, { surveyRow: true });
    await withSession(page, '/fi/thank-you');
    await page.getByTestId('delete-data').click();
    // A change of mind first.
    await page.getByTestId('delete-no').click();
    await expect(page.getByTestId('delete-data')).toBeVisible();
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    await page.getByTestId('delete-data').click();
    await page.getByTestId('delete-yes').click();
    await expect(page.getByTestId('data-deleted')).toHaveText('Tietosi on poistettu. Kiitos, että osallistuit.');
    await expect(page.getByTestId('session-code')).toBeHidden();
    await expect(page.getByTestId('delete-data')).toBeHidden();
    expect(calls.filter((c) => c.method === 'DELETE' && c.path === '/api/sessions/ok/data')).toHaveLength(1);
    // The debrief itself (the party) stays readable after deletion, also on a reload.
    await expect(page.getByTestId('debrief-party').first()).toHaveText('Kokoomus');
    await page.reload();
    await expect(page.getByTestId('data-deleted')).toBeVisible();
    await expect(page.getByTestId('debrief-party').first()).toHaveText('Kokoomus');
    await expect(page.getByTestId('session-code')).toBeHidden();
  });

  test('a session already deleted shows the deleted text, never the code', async ({ page }) => {
    await fakeApi(page, { surveyRow: true, deleted: true });
    await withSession(page, '/en/thank-you');
    await expect(page.getByTestId('data-deleted')).toBeVisible();
    await expect(page.getByTestId('session-code')).toBeHidden();
  });

  test('thank-you before the survey, or without a session, shows the plain text and no party', async ({ page }) => {
    await fakeApi(page);
    await withSession(page, '/fi/thank-you');
    await expect(page.getByTestId('thank-you-plain')).toBeVisible();
    await expect(page.getByTestId('debrief')).toBeHidden();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/en/thank-you');
    await expect(page.getByTestId('thank-you-plain')).toContainText('Thank you for participating!');
  });

  for (const path of ['/fi/survey-entry', '/fi/survey', '/fi/thank-you']) {
    test(`${path} fits a phone screen`, async ({ page }) => {
      await fakeApi(page, { surveyRow: true });
      await page.setViewportSize({ width: 360, height: 640 });
      await withSession(page, path);
      const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
      await expect(page.getByTestId('tau-logo')).toBeVisible();
    });
  }
});
