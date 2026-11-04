/**
 * Theme Switching E2E Tests
 *
 * Verifies that toggling light/dark theme via the ThemeSwitcher
 * updates the `data-theme` attribute on `<html>`.
 */

import { test, expect } from '../../../fixtures';
import { goToSettings } from '../../../helpers/navigation';

test.describe('Theme Switching', () => {
  test.beforeEach(async ({ page }) => {
    await goToSettings(page, 'display');
  });

  test('switches from current theme to the other and back', async ({ page }) => {
    const lightCard = page.getByTestId('theme-card-light');
    const darkCard = page.getByTestId('theme-card-dark');
    await expect(lightCard).toBeVisible();
    await expect(darkCard).toBeVisible();

    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(initialTheme).toBeTruthy();

    const targetTheme = initialTheme === 'light' ? 'dark' : 'light';
    const targetButton = targetTheme === 'dark' ? darkCard : lightCard;
    await targetButton.click();

    await page.waitForFunction(
      (expected) => document.documentElement.getAttribute('data-theme') === expected,
      targetTheme,
      { timeout: 5_000 }
    );

    const newTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(newTheme).toBe(targetTheme);

    const revertButton = initialTheme === 'dark' ? darkCard : lightCard;
    await revertButton.click();

    await page.waitForFunction(
      (expected) => document.documentElement.getAttribute('data-theme') === expected,
      initialTheme,
      { timeout: 5_000 }
    );

    const restoredTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(restoredTheme).toBe(initialTheme);
  });

  test('account menu switches theme and can switch back', async ({ page }) => {
    // 主题切换在侧栏底部的个人菜单里(设计稿的「外观」分组)。
    const trigger = page.getByTestId('sider-account-trigger');
    await trigger.waitFor({ state: 'visible', timeout: 10_000 });

    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const targetTheme = initialTheme === 'light' ? 'dark' : 'light';
    const targetItem =
      targetTheme === 'dark' ? page.getByTestId('sider-account-theme-dark') : page.getByTestId('sider-account-theme-light');

    await trigger.click();
    await targetItem.waitFor({ state: 'visible', timeout: 10_000 });
    await targetItem.click();
    await page.waitForFunction(
      (expected) => document.documentElement.getAttribute('data-theme') === expected,
      targetTheme,
      { timeout: 5_000 }
    );

    const backItem =
      targetTheme === 'dark' ? page.getByTestId('sider-account-theme-light') : page.getByTestId('sider-account-theme-dark');
    await trigger.click();
    await backItem.waitFor({ state: 'visible', timeout: 10_000 });
    await backItem.click();
    await page.waitForFunction(
      (expected) => document.documentElement.getAttribute('data-theme') === expected,
      initialTheme,
      { timeout: 5_000 }
    );
  });

  test('dark button sets data-theme to dark', async ({ page }) => {
    const darkButton = page.getByTestId('theme-card-dark');
    await expect(darkButton).toBeVisible();
    await darkButton.click();

    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', {
      timeout: 5_000,
    });

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('dark');

    const arcoTheme = await page.evaluate(() => document.body.getAttribute('arco-theme'));
    expect(arcoTheme).toBe('dark');
  });

  test('light button sets data-theme to light', async ({ page }) => {
    const lightButton = page.getByTestId('theme-card-light');
    await expect(lightButton).toBeVisible();
    await lightButton.click();

    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', {
      timeout: 5_000,
    });

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('light');

    const arcoTheme = await page.evaluate(() => document.body.getAttribute('arco-theme'));
    expect(arcoTheme).toBe('light');
  });

  test('theme cards reflect the active selection', async ({ page }) => {
    const lightCard = page.getByTestId('theme-card-light');
    const darkCard = page.getByTestId('theme-card-dark');
    await lightCard.click();

    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', {
      timeout: 5_000,
    });

    await expect(lightCard).toHaveAttribute('data-active', 'true');
    await expect(darkCard).toHaveAttribute('data-active', 'false');

    await darkCard.click();

    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', {
      timeout: 5_000,
    });

    await expect(darkCard).toHaveAttribute('data-active', 'true');
    await expect(lightCard).toHaveAttribute('data-active', 'false');

    // Restore to light
    await lightCard.click();
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', {
      timeout: 5_000,
    });
  });
});
