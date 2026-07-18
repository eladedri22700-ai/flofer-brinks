import { test, expect } from "@playwright/test";

/**
 * Smoke E2E — backend :8000 + frontend :5180 (Vite proxies /api).
 */
test("critical path shell: plan → route → live → dashboard", async ({ page }) => {
  await page.goto("/app/plan", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: /תכנון/ })).toBeVisible({
    timeout: 20_000,
  });

  const optimize = page.getByRole("button", { name: /חשב מסלול/ });
  if (await optimize.isEnabled().catch(() => false)) {
    await optimize.click();
    await page.waitForTimeout(2500);
  }

  await page.goto("/app/route");
  await expect(page.locator("body")).toBeVisible();

  await page.goto("/app/live");
  await expect(
    page.getByRole("heading", { name: /מוכנים|נסיעה|אין מסלול|הושלמו|היעד/ }).or(
      page.getByText(/התחל סבב|נווט בוויז|אין מסלול/),
    ),
  ).toBeVisible({ timeout: 15_000 });

  await page.goto("/app/dashboard");
  await expect(page.getByRole("heading", { name: /לוח בקרה/ })).toBeVisible({
    timeout: 15_000,
  });

  await page.goto("/app/history");
  await expect(page.getByRole("heading", { name: /היסטוריה/ })).toBeVisible();
});
