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

const thirdParty: string[] = [];
test.afterEach(() => {
  expect(thirdParty, 'requests to hosts other than the test origin').toEqual([]);
  thirdParty.length = 0;
});

interface FakeOptions {
  history?: { role: string; content: string }[]; // earlier messages of c1
  complete?: boolean; // c1 has ended on the server
  messageStatus?: number; // the answer to a message, when not 200
  messageDelayMs?: number; // how long the model "thinks"
  finished?: boolean; // the survey is done: no new conversation
  streamError?: boolean; // the model fails after part of the reply was sent
}

async function fakeApi(page: Page, reply = 'Hyvää iltaa. Tervetuloa keskustelemaan.', synthesizeDelayMs = 0, options: FakeOptions = {}) {
  const calls: Call[] = [];
  await page.route('**/*', async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') {
      thirdParty.push(url.href);
      return route.abort();
    }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const req = route.request();
    const raw = req.postDataBuffer();
    const ct = req.headers()['content-type'] ?? '';
    let body: unknown = null;
    if (ct.includes('json') && raw) body = JSON.parse(raw.toString());
    calls.push({ method: req.method(), path: url.pathname + url.search, body, contentType: ct, size: raw?.length ?? 0 });
    const json = (status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    const session = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (req.method() === 'GET' && session) return json(200, { id: session[1], created_at: 'x', consent_accepted_at: '2026-10-23T16:00:00+03:00' });
    if (req.method() === 'POST' && url.pathname === '/api/conversations') {
      if (options.finished) return json(403, { detail: 'Session finished' });
      return json(201, { id: 'c1', starter_topic: null, is_complete: false });
    }
    if (req.method() === 'GET' && url.pathname === '/api/conversations/c1') return json(200, { id: 'c1', starter_topic: null, is_complete: options.complete ?? false });
    if (req.method() === 'GET' && url.pathname === '/api/conversations/c1/messages') {
      return json(200, (options.history ?? []).map((m, i) => ({ id: `h${i}`, created_at: 'x', ...m })));
    }
    if (req.method() === 'POST' && url.pathname === '/api/conversations/c1/messages/stream') {
      if (options.messageDelayMs) await new Promise((resolve) => setTimeout(resolve, options.messageDelayMs));
      if (options.messageStatus) return json(options.messageStatus, { detail: 'refused' });
      // The reply as the server streams it: a keep-alive comment, the text
      // in pieces of a few words, then 'done' (or 'error').
      const pieces = reply.match(/\S+\s*/g) ?? [];
      const events = [': ping\n\n'];
      for (let i = 0; i < pieces.length; i += 3) {
        events.push(`event: delta\ndata: ${JSON.stringify({ text: pieces.slice(i, i + 3).join('') })}\n\n`);
      }
      if (options.streamError) events.push(`event: error\ndata: ${JSON.stringify({ detail: 'failed' })}\n\n`);
      else events.push(`event: done\ndata: ${JSON.stringify({ id: 'm2', content: reply, created_at: 'x' })}\n\n`);
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: events.join('') });
    }
    if (req.method() === 'PUT' && url.pathname === '/api/conversations/c1/end') return json(200, { status: 'ok' });
    if (req.method() === 'POST' && url.pathname === '/api/speech/transcribe') return json(200, { text: 'Mitä mieltä olette veroista?' });
    if (req.method() === 'POST' && url.pathname === '/api/speech/synthesize') {
      const text = (body as { text: string }).text;
      const words = text.split(' ');
      if (synthesizeDelayMs) await new Promise((resolve) => setTimeout(resolve, synthesizeDelayMs));
      return json(200, { audio_base64: silentWavBase64(), sample_rate: 16000, words, wtimes: words.map((_, i) => i * 100), wdurations: words.map(() => 90) });
    }
    return json(500, { detail: `unexpected ${req.method()} ${url.pathname}` });
  });
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
    const message = calls.find((c) => c.method === 'POST' && c.path === '/api/conversations/c1/messages/stream');
    expect(message?.body).toEqual({ content: 'Hei', input_mode: 'typed' });
    expect(calls.filter((c) => c.path === '/api/speech/synthesize').map((c) => (c.body as { text: string; language: string }))).toEqual([
      { conversation_id: 'c1', text: 'Hyvää iltaa.', language: 'fi' },
      { conversation_id: 'c1', text: 'Tervetuloa keskustelemaan.', language: 'fi' },
    ]);
    await expect(page.getByTestId('send')).toBeEnabled();
  });

  test('typing during playback interrupts the voice and sends the new message', async ({ page }) => {
    const long = Array.from({ length: 8 }, (_, i) => `Lause numero ${i + 1} on tässä.`).join(' ');
    const calls = await fakeApi(page, long);
    await openChat(page);
    await expect(page.getByTestId('stage')).toHaveAttribute('data-avatar-mode', 'live', { timeout: 60_000 });
    await page.getByTestId('message').fill('Hei');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('status')).toHaveText(/Puhun/, { timeout: 20_000 });
    await expect(page.getByTestId('send')).toBeEnabled();
    await page.getByTestId('message').fill('Toinen');
    await page.getByTestId('send').click();
    await expect(page.locator('.bubble-user').nth(1)).toHaveText('Toinen');
    await expect(page.locator('.bubble-assistant')).toHaveCount(2, { timeout: 20_000 });
    const sent = calls.filter((c) => c.method === 'POST' && c.path === '/api/conversations/c1/messages/stream').map((c) => (c.body as { content: string }).content);
    expect(sent).toEqual(['Hei', 'Toinen']);
    // The first reply was cut short: fewer than its 8 sentences were requested before the second turn.
    const firstTurnSynth = calls.filter((c) => c.path === '/api/speech/synthesize').length;
    expect(firstTurnSynth).toBeLessThan(16);
  });

  test('a long reply leaves the question in view and never slides under the avatar', async ({ page }) => {
    // Seen on an Android phone, 2026-10-17: the spoken question "did not
    // appear"; it had scrolled under the avatar card, which has no visible
    // boundary against the transcript.
    const long = Array.from({ length: 12 }, (_, i) => `Pitkä vastauslause numero ${i + 1} kertoo kannastani perusteellisesti.`).join(' ');
    // The voice answers slowly, so the positions are measured before playback scrolls the transcript along.
    await fakeApi(page, long, 1500);
    await openChat(page);
    await expect(page.getByTestId('stage')).toHaveAttribute('data-avatar-mode', /live|still/, { timeout: 60_000 });
    await page.getByTestId('message').fill('Mitä mieltä olette maahanmuutosta?');
    await page.getByTestId('send').click();
    await expect(page.locator('.bubble-assistant')).toContainText('numero 12', { timeout: 20_000 });
    // All four boxes in one read, so a scroll between reads cannot mix two layouts.
    const { stage, transcript, question, reply } = await page.evaluate(() => {
      const r = (s: string) => {
        const b = document.querySelector(s)!.getBoundingClientRect();
        return { y: b.y, height: b.height };
      };
      return { stage: r('[data-testid=stage]'), transcript: r('[data-testid=transcript]'), question: r('.bubble-user'), reply: r('.bubble-assistant') };
    });
    // The avatar card ends above the transcript, with a gap.
    expect(stage.y + stage.height).toBeLessThanOrEqual(transcript.y);
    // The question stays fully inside the visible transcript when the reply arrives.
    expect(question.y).toBeGreaterThanOrEqual(transcript.y);
    expect(question.y + question.height).toBeLessThanOrEqual(transcript.y + transcript.height);
    // The reply starts in view, below the question.
    expect(reply.y).toBeGreaterThanOrEqual(question.y + question.height);
    expect(reply.y).toBeLessThan(transcript.y + transcript.height);
    // The transcript has room for several lines on a phone.
    expect(transcript.height).toBeGreaterThan(160);
    // While the head speaks, the transcript follows the highlighted words:
    // it scrolls down from where the reply started, by itself.
    const scrollTop = () => page.evaluate(() => document.querySelector('[data-testid=transcript]')!.scrollTop);
    const start = await scrollTop();
    await expect
      .poll(scrollTop, { timeout: 60_000, message: 'the transcript scrolls along with the spoken words' })
      .toBeGreaterThan(start + 40);
  });

  test('a held microphone button records, transcribes and sends the text as spoken', async ({ page }) => {
    const calls = await fakeApi(page);
    await openChat(page);
    const mic = page.getByTestId('mic');
    const box = await mic.boundingBox();
    if (!box) throw new Error('no mic button');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(mic).toHaveClass(/recording/, { timeout: 15_000 });
    await page.waitForTimeout(1500);
    await page.mouse.up();
    await expect(page.locator('.bubble-user')).toHaveText('Mitä mieltä olette veroista?', { timeout: 15_000 });
    const upload = calls.find((c) => c.path.startsWith('/api/speech/transcribe'));
    expect(upload?.path).toBe('/api/speech/transcribe?conversation_id=c1&language=fi');
    expect(upload?.contentType).toMatch(/^audio\/webm/);
    expect(upload?.size ?? 0).toBeGreaterThan(1000);
    const message = calls.find((c) => c.method === 'POST' && c.path === '/api/conversations/c1/messages/stream');
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

  test('a reload shows the earlier messages again, in plain text and without speaking them', async ({ page }) => {
    const calls = await fakeApi(page, undefined, 0, {
      history: [
        { role: 'user', content: 'Mitä mieltä olette veroista?' },
        { role: 'assistant', content: '## Verot\n**Verotuksen pitää olla reilua.** Se on *selvä* asia.\n- Palkkaveroa kevennetään\n- Arvonlisävero pysyy' },
      ],
    });
    await openChat(page);
    // The page loads the history while three browsers render the head: allow time.
    await expect(page.locator('.bubble-user')).toHaveText('Mitä mieltä olette veroista?', { timeout: 20_000 });
    const reply = page.locator('.bubble-assistant');
    // textContent, not toHaveText: the line breaks themselves are checked.
    await expect.poll(() => reply.evaluate((el) => el.textContent), { timeout: 20_000 }).toBe('Verot\nVerotuksen pitää olla reilua. Se on selvä asia.\n• Palkkaveroa kevennetään\n• Arvonlisävero pysyy');
    await expect(page.getByTestId('stage')).toHaveAttribute('data-avatar-mode', /live|still/, { timeout: 60_000 });
    expect(calls.some((c) => c.path === '/api/speech/synthesize')).toBe(false);
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/conversations')).toBe(false);
  });

  test('a stored conversation that has ended is replaced by a new one', async ({ page }) => {
    const calls = await fakeApi(page, undefined, 0, { complete: true, history: [{ role: 'user', content: 'Vanha viesti' }] });
    await openChat(page);
    await expect.poll(() => calls.some((c) => c.method === 'POST' && c.path === '/api/conversations')).toBe(true);
    await expect(page.locator('.bubble')).toHaveCount(0);
  });

  test('Markdown in a reply is shown and spoken as plain text, the highlight keeps working', async ({ page }) => {
    const reply = '**Koulutus on oikeus.** Se on *selvä* asia.\n\n- Ensimmäinen kohta\n- Toinen kohta';
    const calls = await fakeApi(page, reply, 300);
    await openChat(page);
    await expect(page.getByTestId('stage')).toHaveAttribute('data-avatar-mode', 'live', { timeout: 60_000 });
    await page.getByTestId('message').fill('Hei');
    await page.getByTestId('send').click();
    const bubble = page.locator('.bubble-assistant');
    await expect(bubble).toContainText('Koulutus on oikeus.');
    // While speaking, the spoken words are lit up word by word.
    await expect(bubble.locator('.spoken')).not.toHaveText('', { timeout: 20_000 });
    await expect.poll(() => calls.filter((c) => c.path === '/api/speech/synthesize').length, { timeout: 20_000 }).toBe(4);
    await expect(page.getByTestId('status')).toHaveText('', { timeout: 20_000 });
    expect(await bubble.evaluate((el) => el.textContent)).toBe('Koulutus on oikeus. Se on selvä asia.\n\n• Ensimmäinen kohta\n• Toinen kohta');
    const spoken = calls.filter((c) => c.path === '/api/speech/synthesize').map((c) => (c.body as { text: string }).text);
    expect(spoken).toEqual(['Koulutus on oikeus.', 'Se on selvä asia.', 'Ensimmäinen kohta', 'Toinen kohta']);
  });

  test('while the reply is on its way a waiting bubble shows, with a note after a while', async ({ page }) => {
    await fakeApi(page, undefined, 0, { messageDelayMs: 14_000 });
    await openChat(page);
    await page.getByTestId('message').fill('Hei');
    await page.getByTestId('send').click();
    const waiting = page.getByTestId('waiting');
    await expect(waiting).toBeVisible();
    await expect(waiting).toHaveAttribute('aria-label', 'Mietin...');
    await expect(page.getByTestId('status')).toHaveText('Mietin...');
    await expect(waiting).toContainText('Vastaus voi viedä puoli minuuttia.', { timeout: 12_000 });
    await expect(page.locator('.bubble-assistant:not(.bubble-waiting)')).toContainText('Tervetuloa', { timeout: 15_000 });
    await expect(waiting).toHaveCount(0);
  });

  test('a failed send puts the text back into the input and says why', async ({ page }) => {
    await fakeApi(page, undefined, 0, { messageStatus: 504 });
    await openChat(page);
    await page.getByTestId('message').fill('Kerro verotuksesta');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('hint')).toHaveText('Viestin lähetys epäonnistui. Viestisi on yhä kentässä: yritä uudelleen.');
    await expect(page.getByTestId('hint')).toHaveClass(/is-error/);
    await expect(page.getByTestId('message')).toHaveValue('Kerro verotuksesta');
    await expect(page.locator('.bubble')).toHaveCount(0);
    await expect(page.getByTestId('waiting')).toHaveCount(0);
    await expect(page.getByTestId('send')).toBeEnabled();
  });

  test('a reply that breaks off midway is removed and the question goes back into the input', async ({ page }) => {
    await fakeApi(page, 'Hyvä kysymys. Verotus on tärkeä asia meille kaikille.', 0, { streamError: true });
    await openChat(page);
    await page.getByTestId('message').fill('Kerro verotuksesta');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('hint')).toHaveText('Viestin lähetys epäonnistui. Viestisi on yhä kentässä: yritä uudelleen.');
    await expect(page.getByTestId('message')).toHaveValue('Kerro verotuksesta');
    await expect(page.locator('.bubble')).toHaveCount(0);
  });

  test('the message limit gets its own message', async ({ page }) => {
    await fakeApi(page, undefined, 0, { messageStatus: 429 });
    await openChat(page);
    await page.getByTestId('message').fill('Vielä yksi');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('hint')).toContainText('enimmäismäärä viestejä');
    await expect(page.getByTestId('message')).toHaveValue('Vielä yksi');
  });

  test('an ended conversation offers a new one', async ({ page }) => {
    const calls = await fakeApi(page, undefined, 0, { messageStatus: 400 });
    await openChat(page);
    await page.getByTestId('message').fill('Hei');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('hint')).toContainText('Tämä keskustelu on jo päättynyt.');
    await page.getByRole('button', { name: 'Aloita uusi keskustelu' }).click();
    await expect.poll(() => calls.some((c) => c.method === 'POST' && c.path === '/api/conversations')).toBe(true);
  });

  test('a finished session is sent to consent as a new participant', async ({ page }) => {
    await fakeApi(page, undefined, 0, { finished: true });
    await page.goto('/fi/');
    await page.evaluate(() => localStorage.setItem('sessionId', 'ok'));
    await page.goto('/fi/chat');
    await expect(page).toHaveURL(/\/fi\/consent$/);
    expect(await page.evaluate(() => localStorage.getItem('sessionId'))).toBeNull();
  });

  test('the session code is shown on the chat page and can be copied', async ({ page, context, browserName }) => {
    await fakeApi(page);
    await page.goto('/en/');
    await page.evaluate(() => {
      localStorage.setItem('sessionId', '3f2a9c11-1234-4abc-8def-000000000000');
      localStorage.setItem('conversationId', 'c1');
    });
    await page.goto('/en/chat');
    await expect(page.getByTestId('chat-session')).toContainText('Your session code for data requests:');
    await expect(page.getByTestId('chat-session-code')).toHaveText('3F2A-9C11');
    if (browserName !== 'chromium') return;
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByTestId('chat-copy-code').click();
    await expect(page.getByTestId('chat-copy-code')).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('3F2A-9C11');
  });
});
