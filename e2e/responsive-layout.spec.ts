import { expect, test, type Page } from "@playwright/test";

const admin = { email: "e2e-admin@granthsetu.invalid", password: "E2E-Global-Launch-2026!" };
const viewports = [{ name: "360 portrait", width: 360, height: 640 }, { name: "390 portrait", width: 390, height: 844 }, { name: "667 landscape", width: 667, height: 375 }, { name: "768 tablet", width: 768, height: 1024 }] as const;

async function expectNoPageOverflow(page: Page, label: string) {
  const dimensions = await page.evaluate(() => ({ root: document.documentElement.scrollWidth, body: document.body.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.root, `${label}: document overflow`).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, `${label}: body overflow`).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test("public routes remain within representative small viewports", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const path of ["/", "/l/OAVMUSI", "/l/OAVMUSI/catalogue", "/create-library", "/l/OAVMUSI/login"]) { await page.goto(path); await expectNoPageOverflow(page, `${viewport.name} ${path}`); }
    await page.goto("/l/OAVMUSI/catalogue");
    const firstBook = page.locator(".book-card a, .book-card").first();
    if (await firstBook.count()) { await firstBook.click(); await expectNoPageOverflow(page, `${viewport.name} public book detail`); }
  }
});

test("operator shell, tables, popovers, and navigation fit small viewports", async ({ page }) => {
  await page.goto("/l/OAVMUSI/login"); await page.getByLabel("Email").fill(admin.email); await page.getByLabel("Password").fill(admin.password); await page.getByRole("button", { name: "Sign in" }).click(); await expect(page).toHaveURL(/\/operator\/OAVMUSI/);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const path of ["/operator/OAVMUSI", "/operator/OAVMUSI/catalogue", "/operator/OAVMUSI/inventory", "/operator/OAVMUSI/members", "/operator/OAVMUSI/circulation", "/operator/OAVMUSI/reports", "/operator/OAVMUSI/settings", "/operator/OAVMUSI/admin/operators", "/operator/OAVMUSI/admin/audit", "/operator/OAVMUSI/search?q=book"]) { await page.goto(path); await expectNoPageOverflow(page, `${viewport.name} ${path}`); }
    await page.goto("/operator/OAVMUSI/members"); await page.getByRole("button", { name: "Open navigation" }).click(); await expect(page.getByRole("complementary", { name: "Operator navigation" })).toBeVisible(); await page.getByRole("button", { name: "Close navigation" }).first().click(); await expect(page.getByRole("complementary", { name: "Operator navigation" })).not.toHaveClass(/is-open/);
  }
});

test("Shelf creation opens in a viewport-level drawer across desktop and mobile", async ({ page }) => {
  await page.goto("/l/OAVMUSI/login");
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Password").fill(admin.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/operator\/OAVMUSI/);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/operator/OAVMUSI/inventory/shelves");
  await page.getByRole("button", { name: "Add shelf", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Add shelf" });
  await expect(drawer).toBeVisible();
  await expect(page.getByLabel("Shelf name")).toBeFocused();
  const desktopBounds = await drawer.boundingBox();
  expect(desktopBounds?.x, "desktop drawer should be right-aligned to the viewport").toBeGreaterThan(0);
  expect(Math.round((desktopBounds?.x ?? 0) + (desktopBounds?.width ?? 0))).toBeGreaterThanOrEqual(1439);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Add shelf", exact: true }).click();
  await expect(drawer).toBeVisible();
  const mobileBounds = await drawer.boundingBox();
  expect(mobileBounds?.width, "mobile drawer should become an edge-to-edge sheet").toBeGreaterThanOrEqual(389);
  await expectNoPageOverflow(page, "mobile Shelf drawer");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
});
