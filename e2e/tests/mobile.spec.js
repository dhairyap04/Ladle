// Phone layout: bottom navigation and no sideways scrolling.
const { test, expect } = require("@playwright/test");
const { logIn } = require("./helpers");

test("signed-in phone users get the bottom navigation and no horizontal scroll", async ({ page }) => {
  await logIn(page, "foodbank");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Pickups" })).toBeVisible();
  await nav.getByRole("link", { name: "Impact" }).click();
  await expect(page.getByRole("heading", { name: "Your impact" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
