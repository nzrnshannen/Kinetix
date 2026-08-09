import { test, expect } from '@playwright/test';

test('has title and renders UI', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Kinetix Air-Drawing/);
  
  const video = page.locator('video');
  await expect(video).toBeAttached();
  
  const bottomBar = page.getByText('Gesture');
  await expect(bottomBar).toBeVisible();

  // Test toggle 3D mode
  const toggleBtn = page.getByRole('button', { name: /2D Mode/i });
  await toggleBtn.click();
  await expect(page.getByText('3D Mode')).toBeVisible();
});
