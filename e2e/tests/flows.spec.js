// Main flows for each kind of user, run in order against the demo data.
const { test, expect } = require("@playwright/test");
const { logIn } = require("./helpers");

// A tiny PNG, standing in for a phone photo of the food.
const PHOTO = {
  name: "food.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
};

test.describe.configure({ mode: "serial" });

test("guests see the landing page and open pickups", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Good food");
  await page.getByRole("link", { name: "Browse open pickups" }).click();
  await expect(page.getByRole("heading", { name: "Food waiting for pickup" })).toBeVisible();
  await expect(page.getByText("20 boxed dinners")).toBeVisible();
});

test("a restaurant posts surplus food", async ({ page }) => {
  await logIn(page, "restaurant");
  await page.getByRole("button", { name: "Post surplus food" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Bread & bakery" }).click();
  await dialog.getByLabel("Quantity").fill("E2E test croissants");
  await dialog.getByRole("button", { name: "None of these" }).click();
  await dialog.getByLabel("Street address").fill("10150 Jasper Ave");
  await dialog.getByLabel("City").fill("Edmonton");
  await dialog.getByLabel("From").fill("20:00");
  await dialog.getByLabel("Until").fill("23:00");
  // Tomorrow, so the window hasn't ended whatever time the tests run.
  const d = new Date(Date.now() + 86400e3);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await dialog.getByLabel("Pickup date").fill(ymd);
  await dialog.getByRole("button", { name: "Post it" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "E2E test croissants" })).toBeVisible();
});

test("a food bank claims it", async ({ page }) => {
  await logIn(page, "foodbank");
  await page.getByPlaceholder("Search restaurants, food or notes").fill("E2E test");
  await page.getByText("E2E test croissants").first().click();
  await page.getByRole("button", { name: "I can pick this up" }).click();
  await page.getByRole("button", { name: "Yes, claim it" }).click();
  await expect(page.getByRole("heading", { name: "Pickup reserved!" })).toBeVisible();
});

test("a volunteer driver accepts, collects and delivers", async ({ page }) => {
  await logIn(page, "driver");
  await expect(page.getByRole("heading", { name: "Deliveries that need a driver" })).toBeVisible();
  await page.getByRole("button", { name: "Accept delivery" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Accept delivery" }).click();
  // The driver doesn't know the restaurant's or food bank's code here, so
  // they add a photo at each stop instead.
  const dialog = page.getByRole("dialog");
  await page.getByRole("button", { name: "I've collected the food" }).first().click();
  await dialog.locator("input[type=file]").setInputFiles(PHOTO);
  await expect(dialog.getByRole("img", { name: "Photo of the food" })).toBeVisible();
  await dialog.getByRole("button", { name: "I've collected the food" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Mark delivered" }).first().click();
  await dialog.locator("input[type=file]").setInputFiles(PHOTO);
  await dialog.getByRole("button", { name: "Mark delivered" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Recent deliveries" })).toBeVisible();
  await expect(page.getByText("Waiting for the food bank to confirm").first()).toBeVisible();
});

test("the food bank confirms the delivery arrived", async ({ page }) => {
  await logIn(page, "foodbank");
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await page.getByText(/^Did the food from .* arrive\?$/).first().click();
  await page.getByRole("button", { name: "Yes, it arrived" }).click();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
});

test("an admin verifies the food bank", async ({ page }) => {
  await logIn(page, "admin");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Verify" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("No food banks are waiting for verification.")).toBeVisible();
});

test("forgot password answers without revealing accounts", async ({ page }) => {
  await page.goto("/auth?mode=login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await page.getByLabel(/^Email address/).fill("nobody@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If there's an account for that email/)).toBeVisible();
});

test("unknown pages show a way back", async ({ page }) => {
  await page.goto("/definitely-not-a-page");
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
});
