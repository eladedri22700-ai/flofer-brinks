import { test, expect, type Page } from "@playwright/test";

/**
 * Smoke E2E — real backend behind the Vite proxy (API_PROXY_TARGET, default :8000)
 * and the isolated TEST pilot account from `python -m src.seed`.
 */
const USER = process.env.E2E_USER ?? "TEST";
const PASS = process.env.E2E_PASS ?? "1234";

async function signIn(page: Page) {
  const res = await page.request.post("/api/auth/login", {
    data: { username: USER, password: PASS },
  });
  expect(res.ok()).toBeTruthy();
  const { access_token, user } = await res.json();
  await page.goto("/");
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem("rm_token", token);
      localStorage.setItem("rm_user", JSON.stringify(user));
      localStorage.setItem(
        `flofer_onboarding_v3_${user.username.toLowerCase()}`,
        JSON.stringify({ done: true, permissionsDone: true, installSeen: true }),
      );
      localStorage.setItem("rm_sandbox", "1");
    },
    { token: access_token, user },
  );
}

test("login screen renders for signed-out visitors", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /כניסה/ })).toBeVisible({ timeout: 20_000 });
});

test("critical path: home → plan → map → live → more menu", async ({ page }) => {
  await signIn(page);

  await page.goto("/app/dashboard");
  await expect(page.getByRole("navigation", { name: "ניווט ראשי" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/טוב/);

  await page.goto("/app/plan");
  await expect(page.getByRole("heading", { name: /הוספת יעד/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("tablist", { name: "אופן הזנה" })).toBeVisible();

  await page.goto("/app/board");
  await expect(page.getByText(/לוח סבב|אין מסלול|סדר הכתובות/).first()).toBeVisible({
    timeout: 15_000,
  });

  await page.goto("/app/live");
  await expect(page.locator("body")).not.toBeEmpty();

  await page.goto("/app/dashboard");
  await page.getByRole("button", { name: "עוד", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "תפריט נוסף" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: /הגדרות/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});
