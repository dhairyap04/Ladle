// Demo accounts from server/scripts/demo.js.
const PASSWORD = "demo-password";
const ACCOUNTS = {
  restaurant: "restaurant@demo.ladle",
  cafe: "cafe@demo.ladle",
  foodbank: "foodbank@demo.ladle",
  driver: "driver@demo.ladle",
  admin: "admin@demo.ladle",
};

// Logs in through the real form and waits for the home page.
async function logIn(page, who) {
  await page.goto("/auth?mode=login");
  // MUI marks required fields "Email address *", so match the start of the label.
  await page.getByLabel(/^Email address/).fill(ACCOUNTS[who]);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/main");
}

module.exports = { logIn, ACCOUNTS };
