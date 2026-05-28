import { expect, test } from "@playwright/test";

test("carrega a aplicacao local", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/RC|Molina|React|Vite/i);
});
