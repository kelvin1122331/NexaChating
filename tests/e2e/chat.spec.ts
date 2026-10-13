import { expect, test } from '@playwright/test';

test('a user can open a chat and send a message in the local-first workspace', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chat');

  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
  await page.getByRole('link', { name: 'Open chat with Olivia Chen' }).click();
  await expect(page.getByText('Olivia Chen', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Write a message' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Write a message' }).fill('Hello from the NexaChat test');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Hello from the NexaChat test', { exact: true })).toBeVisible();
});
