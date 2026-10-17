import { expect, test, type Page, type Route } from '@playwright/test';

// The chat page against a fake API: typed and spoken turns, sentence-by-
// sentence speech, the still-face fallback, leaving. No request may go to any
// host but the test origin.

function silentWavBase64(seconds = 0.4, rate = 16000): string {
  const n = Math.round(seconds * rate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  return buf.toString('base64');
}

interface Call { method: string; path: string; body: unknown; contentType: string; size: number }

async function fakeApi(page: Page, reply = 'Hyvää iltaa. Tervetuloa keskustelemaan.') {
  const calls: Call[] = [];
  const origin = new URL(page.context().browser()?.version() ? 'http://127.0.0.1' : 'http://127.0.0.1').host;
  await page.route('**/*', async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') {
      await route.abort();
      throw new Error(`request to a third party: ${url.href}`);
    }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const req = route.request();
    const raw = req.postDataBuffer();
    const ct = req.headers()['content-type'] ?? '';
    let body: unknown = null;
    if (ct.includes('json') && raw) body = JSON.parse(raw.toString());
    calls.push({ method: req.method(), path: url.pathname + url.search, body, contentType: ct, size: raw?.length ?? 0 });
    const json = (status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (req.method() === 'GET' && url.pathname === '/api/sessions/ok') return json(200, { id: 'ok', created_at: 'x', consent_accepted_at: '2026-10-23T16:00:00+03:00' });
    if (req.method() === 'POST' && url.pathname === '/api/conversations') return json(201, { id: 'c1', starter_topic: null, is_complete: false });
    if (req.method() === 'POST' && url.pathname === '/api/conversations/c1/messages') return json(200, { id: 'm2', role: 'assistant', content: reply, created_at: 'x' });
    if (req.method() === 'PUT' && url.pathname === '/api/conversations/c1/end') return json(200, { status: 'ok' });
    if (req.method() === 'POST' && url.pathname === '/api/speech/transcribe') return json(200, { text: 'Mitä mieltä olette veroista?' });
    if (req.method() === 'POST' && url.pathname === '/api/speech/synthesize') {
      const text = (body as { text: string }).text;
      const words = text.split(' ');
      return json(200, { audio_base64: silentWavBase64(), sample_rate: 16000, words, wtimes: words.map((_, i) => i * 100), wdurations: words.map(() => 90) });
    }
    return json(500, { detail: `unexpected ${req.method()} ${url.pathname}` });
  });
  void origin;
  return calls;
}

async function openChat(page: Page) {
  await page.goto('/fi/');
  await page.evaluate(() => {
    localStorage.setItem('sessionId', 'ok');
    localStorage.setItem('conversationId', 'c1');
  });
  await page.goto('/fi/chat');
  await expect(page.getByTestId('transcript')).toBeVisible();
}

test.describe('chat page', () => {
  test.setTimeout(90_000);
  test('a typed turn is sent as typed, shown, and spoken sentence by sentence by the live head', async ({ page }) => {
    const calls = await fakeApi(page);
    await openChat(page);
    await expect(page.getByTestId('stage')).toHaveAttribute('data-avatar-mode', 'live', { timeout: 60_000 });
    await page.getByTestId('message').fill('Hei');
    await page.getByTestId('send').click();
    await expect(page.locator('.bubble-user')).toHaveText('Hei');
    await expect(page.locator('.bubble-assistant')).toContainText('Tervetuloa keskustelemaan.');
    await expect.poll(() => calls.filter((c) => c.path === '/api/speech/synthesize').length, { timeout: 20_000 }).toBe(2);
    const message = calls.find((c) => c.path === '/api/conversations/c1/messages');
    expect(message?.body).toEqual({ content: 'Hei', input_mode: 'typed' });
    expect(calls.filter((c) => c.path === '/api/speech/synthesize').map((c) => (c.body as { text: string; language: string }))).toEqual([
      { conversation_id: 'c1', text: 'Hyvää iltaa.', language: 'fi' },
      { conversation_id: 'c1', text: 'Tervetuloa keskustelemaan.', language: 'fi' },
    ]);
    await expect(page.getByTestId('send')).toBeEnabled();
  });

  test('a held microphone button records, transcribes and sends the text as spoken', async ({ page }) => {
    const calls = await fakeApi(page);
    await openChat(page);
    const mic = page.getByTestId('mic');
    const box = await mic.boundingBox();
    if (!box) throw new Error('no mic button');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(mic).toHaveClass(/recording/);
    await page.waitForTimeout(1500);
    await page.mouse.up();
    await expect(page.locator('.bubble-user')).toHaveText('Mitä mieltä olette veroista?', { timeout: 15_000 });
    const upload = calls.find((c) => c.path.startsWith('/api/speech/transcribe'));
    expect(upload?.path).toBe('/api/speech/transcribe?conversation_id=c1&language=fi');
    expect(upload?.contentType).toMatch(/^audio\/webm/);
    expect(upload?.size ?? 0).toBeGreaterThan(1000);
    const message = calls.find((c) => c.path === '/api/conversations/c1/messages');
    expect(message?.body).toEqual({ content: 'Mitä mieltä olette veroista?', input_mode: 'spoken' });
    await expect(page.locator('.bubble-assistant')).toBeVisible();
  });

  test('without the head file the still face is used and the reply is still spoken', async ({ page }) => {
    const calls = await fakeApi(page);
    await page.route('**/avatar/man.glb', (route) => route.fulfill({ status: 404, body: 'gone' }));
    await openChat(page);
    await expect(page.getByTestId('stage')).toHaveAttribute('data-avatar-mode', 'still', { timeout: 60_000 });
    await expect(page.locator('#still')).toBeVisible();
    await page.getByTestId('message').fill('Hei');
    await page.getByTestId('send').click();
    await expect.poll(() => calls.filter((c) => c.path === '/api/speech/synthesize').length, { timeout: 20_000 }).toBe(2);
  });

  test('end conversation ends it on the server and leaves for the survey', async ({ page }) => {
    const calls = await fakeApi(page);
    await openChat(page);
    await page.getByTestId('chat-end').click();
    await page.waitForURL(/\/fi\/survey-entry$/);
    expect(calls.some((c) => c.method === 'PUT' && c.path === '/api/conversations/c1/end')).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('conversationId'))).toBeNull();
  });

  test('chat without a stored conversation creates one', async ({ page }) => {
    const calls = await fakeApi(page);
    await page.goto('/fi/');
    await page.evaluate(() => localStorage.setItem('sessionId', 'ok'));
    await page.goto('/fi/chat');
    await expect(page.getByTestId('transcript')).toBeVisible();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/conversations')).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('conversationId'))).toBe('c1');
  });
});
