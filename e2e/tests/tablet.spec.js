// iPad layouts: what a restaurant or food bank sees on the counter tablet.
const { test, expect } = require("@playwright/test");
const { logIn } = require("./helpers");

const noSidewaysScroll = async (page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
};

// Visible buttons a finger has to hit, smaller than 44px tall.
const smallButtons = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("button, a.MuiButton-root")]
      // Layout size, not on-screen size, so a banner still animating in doesn't count.
      .filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0 && el.offsetHeight < 44)
      .map((el) => el.textContent.trim() || el.getAttribute("aria-label"))
  );

for (const orientation of ["portrait", "landscape"]) {
  test(`restaurant pages fit an iPad in ${orientation}, with finger-sized buttons`, async ({ page }) => {
    if (orientation === "landscape") await page.setViewportSize({ width: 1080, height: 810 });
    await logIn(page, "restaurant");
    await expect(page.getByRole("heading", { name: "Your postings" })).toBeVisible();
    await noSidewaysScroll(page);
    expect(await smallButtons(page)).toEqual([]);

    await page.getByText("3 trays of bread").first().click();
    await expect(page.getByRole("heading", { name: "Volunteer delivery" })).toBeVisible();
    await noSidewaysScroll(page);
    expect(await smallButtons(page)).toEqual([]);

    await page.goto("/view_profile");
    await expect(page.getByRole("heading", { name: "Your devices" })).toBeVisible();
    await noSidewaysScroll(page);
  });
}

test("on an iPad, Ladle explains how to add it to the home screen", async ({ page }) => {
  await logIn(page, "foodbank");
  await page.goto("/view_profile");
  await page.getByRole("button", { name: "Add Ladle to this device" }).click();
  const guide = page.getByRole("dialog", { name: "Add Ladle to your home screen" });
  await expect(guide.getByText("Add to Home Screen")).toBeVisible();
  await guide.getByRole("button", { name: "Got it" }).click();
  await expect(guide).toBeHidden();
});

test("on an iPad, the add-to-home-screen banner never covers an open dialog", async ({ page }) => {
  await logIn(page, "restaurant");
  const banner = page.getByRole("alert").filter({ hasText: "home screen" });
  await expect(banner).toBeVisible();
  const box = await banner.boundingBox(); // the dialog hides it from the accessibility tree, so measure first
  await page.getByRole("button", { name: "Post surplus food" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Whatever is on top at the banner's centre must not be the banner itself.
  const bannerOnTop = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return Boolean(el && el.closest("[role=alert]") && el.closest("[role=alert]").textContent.includes("home screen"));
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(bannerOnTop).toBe(false);
});
