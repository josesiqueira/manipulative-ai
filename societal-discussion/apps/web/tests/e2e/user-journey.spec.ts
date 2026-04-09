import { test, expect } from '@playwright/test';

test.describe('User Journey', () => {
  test('should display consent page in English', async ({ page }) => {
    await page.goto('/en');

    // Check title and consent text
    await expect(page.getByText('Societal Discussion Research')).toBeVisible();
    await expect(page.getByText('Research Participation')).toBeVisible();
    await expect(page.getByText('I have read and understood')).toBeVisible();

    // Start button should be disabled without consent
    const startButton = page.getByRole('button', { name: 'Start Discussion' });
    await expect(startButton).toBeDisabled();
  });

  test('should display consent page in Finnish', async ({ page }) => {
    await page.goto('/fi');

    // Check Finnish text
    await expect(page.getByText('Yhteiskunnallinen keskustelututkimus')).toBeVisible();
    await expect(page.getByText('Tutkimukseen osallistuminen')).toBeVisible();
  });

  test('should switch language', async ({ page }) => {
    await page.goto('/en');

    // Click Finnish language button
    await page.getByRole('button', { name: 'Suomi' }).click();

    // Should redirect to Finnish page
    await expect(page).toHaveURL('/fi');
    await expect(page.getByText('Yhteiskunnallinen keskustelututkimus')).toBeVisible();
  });

  test('should enable start button after consent', async ({ page }) => {
    await page.goto('/en');

    // Check consent checkbox
    const checkbox = page.getByRole('checkbox');
    await checkbox.check();

    // Start button should be enabled
    const startButton = page.getByRole('button', { name: 'Start Discussion' });
    await expect(startButton).toBeEnabled();
  });

  test('should navigate to topic selection after consent', async ({ page }) => {
    // Mock API response
    await page.route('**/api/participants', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-participant-id',
          session_token: 'test-session-token',
          language: 'en',
          consent_given: true,
        }),
      });
    });

    await page.goto('/en');

    // Give consent and click start
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Start Discussion' }).click();

    // Should navigate to chat page with topic selection
    await expect(page).toHaveURL('/en/chat');
    await expect(page.getByText('Choose a Discussion Topic')).toBeVisible();
  });

  test('should show warning badge on healthcare topic', async ({ page }) => {
    // Setup localStorage with participant
    await page.addInitScript(() => {
      localStorage.setItem('participantId', 'test-participant-id');
      localStorage.setItem('sessionToken', 'test-session-token');
    });

    // Mock topics API
    await page.route('**/api/topics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          topics: [
            { id: 'immigration', label_en: 'Immigration', label_fi: 'Maahanmuutto' },
            { id: 'healthcare', label_en: 'Healthcare', label_fi: 'Terveydenhuolto', warning: true },
          ],
        }),
      });
    });

    await page.goto('/en/chat');

    // Healthcare should have warning badge
    await expect(page.getByText('Limited data available')).toBeVisible();
  });
});

test.describe('Admin Panel', () => {
  test('should require password', async ({ page }) => {
    await page.goto('/en/admin');

    await expect(page.getByText('Admin Access')).toBeVisible();
    await expect(page.getByPlaceholder('Admin password')).toBeVisible();
  });

  test('should show error for invalid password', async ({ page }) => {
    // Mock admin API to return 401
    await page.route('**/api/admin/stats', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Invalid admin password' }),
      });
    });

    await page.goto('/en/admin');

    // Enter wrong password
    await page.getByPlaceholder('Admin password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Login' }).click();

    // Should show error
    await expect(page.getByText('Invalid password')).toBeVisible();
  });

  test('should show stats after valid login', async ({ page }) => {
    // Mock admin API
    await page.route('**/api/admin/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_participants: 10,
          total_chats: 25,
          completed_chats: 20,
          total_messages: 150,
          chats_by_block: { conservative: 5, 'red-green': 7, moderate: 6, dissatisfied: 7 },
          chats_by_topic: { immigration: 5, economy: 8, technology: 12 },
          correct_guesses: 8,
          incorrect_guesses: 12,
          avg_persuasiveness: 3.5,
          avg_naturalness: 4.0,
        }),
      });
    });

    await page.goto('/en/admin');

    // Enter correct password
    await page.getByPlaceholder('Admin password').fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();

    // Should show stats dashboard
    await expect(page.getByText('Research Admin Panel')).toBeVisible();
    await expect(page.getByText('10')).toBeVisible(); // total participants
    await expect(page.getByText('25')).toBeVisible(); // total chats
  });
});
