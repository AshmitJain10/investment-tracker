import { test, expect } from "@playwright/test";

test.describe("Investment Tracker E2E Flows", () => {
  
  test.beforeEach(async ({ page }) => {
    // Intercept NextAuth session checking to simulate an authenticated active user
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            name: "Mock Test User",
            email: "mocktestuser@gmail.com",
            image: "https://lh3.googleusercontent.com/a/mock-avatar-hash",
            id: "mock-user-id",
          },
          expires: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        }),
      });
    });
  });

  test("should load the dashboard and verify initial structural widgets", async ({ page }) => {
    // Navigate to local dashboard
    await page.goto("/");

    // 1. Verify Header exists
    await expect(page.locator("h2:has-text('Financial Analysis Desk')")).toBeVisible();

    // 2. Verify Sidebar elements exist
    await expect(page.locator("text=Portfolio Overview")).toBeVisible();
    await expect(page.locator("text=Rebalancing Engine")).toBeVisible();

    // 3. Verify total portfolio value calculations exist
    await expect(page.locator("span:has-text('Total Portfolio Value')")).toBeVisible();
  });

  test("should toggle through all visual analytics and indicator workspaces", async ({ page }) => {
    await page.goto("/");

    // Switch to Rebalancing Engine
    await page.click("text=Rebalancing Engine");
    await expect(page.locator("text=Target Allocation Matrix")).toBeVisible();
    await expect(page.locator("text=Drift Analysis & Suggestions")).toBeVisible();

    // Switch to Advanced Analytics
    await page.click("text=Advanced Analytics");
    await expect(page.locator("text=Capital Gains Tax")).toBeVisible();
    await expect(page.locator("text=SIP Health Score")).toBeVisible();

    // Switch to Watchlist & Technicals
    await page.click("text=Watchlist & Technicals");
    await expect(page.locator("text=RSI (14)")).toBeVisible();

    // Switch to Price Target Alerts
    await page.click("text=Price Target Alerts");
    await expect(page.locator("text=Price Target Alerts Config")).toBeVisible();
  });

  test("should display the Add Asset purchase logger modal successfully", async ({ page }) => {
    await page.goto("/");

    // Scroll to table and click Add Asset
    const addAssetBtn = page.locator("button:has-text('Add Asset')");
    await expect(addAssetBtn).toBeVisible();
    await addAssetBtn.click();

    // Verify modal overlay opens
    await expect(page.locator("h3:has-text('Record Asset Purchase')")).toBeVisible();
    
    // Check close action
    await page.click("button:has-text('Record Asset Purchase') >> xpath=../button");
    await expect(page.locator("h3:has-text('Record Asset Purchase')")).not.toBeVisible();
  });
});
