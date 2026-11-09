import { expect, test } from "@playwright/test";

test("registration, mock automation and inbox critical flow", async ({ page }) => {
  const unique = Date.now();
  const email = `e2e-${unique}@example.com`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Instagram biznesingizni/ })).toBeVisible();
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
  await page.getByRole("button", { name: "Chiqish" }).click();

  await page.goto("/login?demo=1");
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/automations");
  await expect(page.getByText("Narx so‘rovi")).toBeVisible();

  await page.goto("/app/settings");
  await page.getByLabel("Comment ID").fill(`e2e-comment-${unique}`);
  await page.getByRole("button", { name: "Mock event yuborish" }).click();
  await expect(page.getByText(/Mock event: queued/)).toBeVisible();

  await page.getByRole("button", { name: "Mock event yuborish" }).click();
  await expect(page.getByText(/Mock event: duplicate/)).toBeVisible();

  await page.goto("/app/mock-lab");
  await page.getByRole("button", { name: "Inbound DM yuborish" }).click();
  await expect(page.getByText(/Inbound xabar: received/)).toBeVisible();

  await page.goto("/app/inbox");
  const conversation = page.locator(".conversation-list button").filter({ hasText: "@aziza" }).first();
  await expect(conversation).toBeVisible({ timeout: 15_000 });
  await conversation.click();
  await expect(page.locator(".thread-header").getByText("@aziza", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Xabar yozing...")).toBeEnabled();
  await page.getByPlaceholder("Xabar yozing...").fill("E2E manual reply");
  await page.getByRole("button", { name: "Yuborish" }).click();
  await expect(page.getByText("E2E manual reply", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo", { exact: true }).first()).toBeVisible();
});
