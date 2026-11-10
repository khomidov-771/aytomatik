import { expect, test } from "@playwright/test";

test("registration, login and real-provider empty states", async ({ page }) => {
  const unique = Date.now();
  const email = `e2e-${unique}@example.com`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Commentni/ })).toBeVisible();
  await expect(page.getByText(/Mock rejim/)).toHaveCount(0);
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Foydalanish shartlari" })).toBeVisible();

  await page.goto("/register");
  await page.getByLabel("Ism").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parol", { exact: true }).fill("E2Epass123!");
  await page.getByLabel("Parolni takrorlang").fill("E2Epass123!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Ro‘yxatdan o‘tish" }).click();
  await page.getByRole("link", { name: "Development tasdiqlash havolasi" }).click();
  await page.getByRole("button", { name: "Emailni tasdiqlash" }).click();
  await expect(page.getByText(/Email tasdiqlandi/)).toBeVisible();

  await page.getByRole("link", { name: "Kirish", exact: true }).click();
  await page.getByLabel("Email").fill(email);
  await page.locator('input[autocomplete="current-password"]').fill("E2Epass123!");
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: /Xush kelibsiz/ })).toBeVisible();
  await expect(page.getByText("Akkaunt ulanmagan")).toBeVisible();

  await page.goto("/app/automations/new");
  await expect(page.getByText(/Avval Instagram akkaunt ulang/)).toBeVisible();
  await page.goto("/app/settings");
  await expect(page.getByRole("heading", { name: "Webhook diagnostikasi" })).toBeVisible();
  await expect(page.getByText(/Mock comment event/)).toHaveCount(0);
});
