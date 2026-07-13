import { test, expect } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "operating system",
  );
  await expect(page.getByRole("link", { name: /get started|launch on ceverse/i }).first()).toBeVisible();
});
