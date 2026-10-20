import { expect, test } from '@playwright/test';

// The whole participant flow against a real API, nothing faked: consent, one
// typed turn, End, survey, debrief, delete; then the admin lookup by code
// shows the tombstone with no messages. Also the data-saving check after a
// deploy.
//
//   REAL_API=1 REAL_APP_URL=http://127.0.0.1:4321 REAL_API_URL=http://127.0.0.1:8000 \
//   ADMIN_PASSWORD=... npx playwright test tests/real-flow.spec.ts --project=desktop
//
// REAL_APP_URL is the participant app whose PUBLIC_API_URL points at
// REAL_API_URL (or at its own origin with a proxy, as the dev server does).

const REAL = process.env.REAL_API === '1';
const APP = process.env.REAL_APP_URL ?? 'http://127.0.0.1:4321';
const API = process.env.REAL_API_URL ?? 'http://127.0.0.1:8000';
const ADMIN = process.env.ADMIN_PASSWORD ?? 'admin';

test.describe('real flow', () => {
  test.skip(!REAL, 'set REAL_API=1 to run against a real API');
  test.setTimeout(240_000);

  test('consent, chat, survey, debrief, delete, admin tombstone', async ({ page, context, request }) => {
    await page.goto(`${APP}/fi/consent`);
    for (const box of await page.locator('input[type=checkbox]').all()) await box.check();
    await page.getByTestId('consent-start').click();
    await page.waitForURL(/\/fi\/chat/);
    const sessionId = await page.evaluate(() => localStorage.getItem('sessionId'));
    const conversationId = await page.evaluate(() => localStorage.getItem('conversationId'));
    expect(sessionId).toBeTruthy();
    expect(conversationId).toBeTruthy();

    await expect(page.getByTestId('stage')).toHaveAttribute('data-avatar-mode', /live|still/, { timeout: 90_000 });
    await page.getByTestId('message').fill('Mitä mieltä olette veroista?');
    await page.getByTestId('send').click();
    await expect(page.locator('.bubble-assistant')).toBeVisible({ timeout: 60_000 });
    const reply = (await page.locator('.bubble-assistant').textContent()) ?? '';
    expect(reply.length).toBeGreaterThan(10);

    await page.getByTestId('chat-end').click();
    await page.waitForURL(/\/fi\/survey-entry/);
    await page.getByTestId('survey-entry-start').click();
    await page.waitForURL(/\/fi\/survey$/);
    await page.locator('input[name="detected_persuasion"][value="4"]').check();
    await page.locator('textarea[name="notice_anything"]').fill('Testi: todellinen läpikulku.');
    await page.getByTestId('survey-submit').click();
    await page.waitForURL(/\/fi\/thank-you/);

    await expect(page.getByTestId('debrief')).toBeVisible();
    const party = await page.getByTestId('debrief-party').first().textContent();
    expect(party).toBeTruthy();
    const code = (await page.getByTestId('session-code').textContent()) ?? '';
    expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByTestId('copy-code').click();
    await expect(page.getByTestId('copy-code')).toHaveText('Kopioitu');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);

    // Stored before the deletion: the admin sees the messages with their input mode and model name.
    const headers = { 'X-Admin-Password': ADMIN };
    const before = await request.get(`${API}/api/admin/conversations/${conversationId}/detail`, { headers });
    expect(before.ok()).toBeTruthy();
    const detail = await before.json();
    expect(detail.messages.length).toBeGreaterThanOrEqual(2);
    // Input mode and model name live in the message export, not in the detail view.
    const messages = await request.get(`${API}/api/admin/export?format=messages-json`, { headers });
    expect(messages.ok()).toBeTruthy();
    const ours = (await messages.json()).filter((m: { conversation_id: string }) => m.conversation_id === conversationId);
    expect(ours.map((m: { input_mode: string }) => m.input_mode)).toEqual(['typed', 'typed']);
    expect(ours[1].model_name).toBeTruthy();
    const surveys = await request.get(`${API}/api/admin/export/surveys`, { headers });
    expect(surveys.ok()).toBeTruthy();
    expect(await surveys.text()).toContain(sessionId!);

    await page.getByTestId('delete-data').click();
    await page.getByTestId('delete-yes').click();
    await expect(page.getByTestId('data-deleted')).toBeVisible();
    // A reload after the deletion still shows the debrief, marked deleted.
    await page.reload();
    await expect(page.getByTestId('data-deleted')).toBeVisible();
    await expect(page.getByTestId('debrief-party').first()).toHaveText(party!);
    // The tombstone takes no new conversation: Start on the landing page goes to consent for a new session.
    await page.goto(`${APP}/fi/`);
    await page.getByTestId('landing-start').click();
    await page.waitForURL(/\/fi\/consent$/);

    // The tombstone: the session is found by its code with data_deleted_at set, the conversation has no messages.
    const byCode = await request.get(`${API}/api/admin/sessions/by-code/${code}`, { headers });
    expect(byCode.ok()).toBeTruthy();
    const sessions = await byCode.json();
    const found = sessions.find((s: { id: string }) => s.id === sessionId);
    expect(found).toBeTruthy();
    expect(found.data_deleted_at).toBeTruthy();
    const after = await request.get(`${API}/api/admin/conversations/${conversationId}/detail`, { headers });
    expect(after.ok()).toBeTruthy();
    expect((await after.json()).messages).toEqual([]);
    console.log(`real flow: session ${sessionId} code ${code} party "${party}" reply ${reply.length} chars`);
  });
});
