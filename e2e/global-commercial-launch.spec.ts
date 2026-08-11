import { expect, test } from "@playwright/test";

const adminEmail = "e2e-admin@granthsetu.invalid";
const librarianEmail = "e2e-librarian@granthsetu.invalid";
const password = "E2E-Global-Launch-2026!";

test("public room catalogue resolves only valid rooms", async ({ page }) => {
  await page.goto("/l/OAVMUSI/catalogue");
  await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();
  await expect(page.getByText("OAV Musiguda Library")).toBeVisible();
  await page.goto("/l/NOT-A-ROOM/catalogue");
  await expect(page.getByText(/not found|could not be found/i)).toBeVisible();
});

test("room authentication and tenancy boundaries hold in the browser", async ({ page }) => {
  await page.goto("/operator/OAVMUSI");
  await expect(page).toHaveURL(/\/staff\?next=%2Foperator%2FOAVMUSI/);
  await page.goto("/l/OAVMUSI/login");
  await page.getByLabel("Email").fill("wrong@example.invalid");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to sign in");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/operator\/OAVMUSI/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.goto("/operator/E2EROOM");
  await expect(page).toHaveURL(/\/l\/E2EROOM\/login/);
});

test("librarians cannot open room-administrator settings", async ({ page }) => {
  await page.goto("/l/OAVMUSI/login");
  await page.getByLabel("Email").fill(librarianEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/operator\/OAVMUSI/);
  await page.goto("/operator/OAVMUSI/settings");
  await expect(page).toHaveURL(/\/operator\/OAVMUSI(?:\?error=forbidden)?$/);
});
