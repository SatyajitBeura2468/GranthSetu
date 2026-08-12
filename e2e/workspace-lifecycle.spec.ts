import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const room = { code: "TOKYO-E2E", name: "Tokyo E2E Library", person: "Sakura E2E" };
const account = { email: "e2e-owner@granthsetu.test", password: "E2e-Owner-Password-2026!" };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Missing local E2E Supabase environment.");
  return createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function submitAndWait(page: Page, button: Locator) {
  await Promise.all([page.waitForURL(/success=/), button.click()]);
}

async function signInAsOperator(page: Page) {
  await page.goto(`/create-library?name=${encodeURIComponent(room.name)}&code=${room.code}&person=${encodeURIComponent(room.person)}&currencyCode=JPY&localeCode=ja-JP&timeZone=Asia%2FTokyo`);
  await page.getByRole("link", { name: "Sign in to continue" }).click();
  const recovery = page.locator("form");
  await recovery.getByLabel("Email").fill(account.email);
  await recovery.getByLabel("Password").fill(account.password);
  await Promise.all([page.waitForURL(/\/operator\//), recovery.getByRole("button", { name: "Continue onboarding" }).click()]);
}

async function libraryId() {
  const { data, error } = await adminClient().from("libraries").select("id").eq("public_code", room.code).single();
  expect(error).toBeNull();
  return data!.id;
}

async function localConfirmationLink(email: string) {
  const mailbox = email.split("@", 1)[0];
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`http://127.0.0.1:54324/api/v1/mailbox/${encodeURIComponent(mailbox)}`);
    if (response.ok) {
      const messages = await response.json() as Array<{ id: string }>;
      for (const message of messages) {
        const messageResponse = await fetch(`http://127.0.0.1:54324/api/v1/mailbox/${encodeURIComponent(mailbox)}/${encodeURIComponent(message.id)}`);
        if (!messageResponse.ok) continue;
        const body = JSON.stringify(await messageResponse.json()).replaceAll("\\u0026", "&").replaceAll("&amp;", "&");
        const link = body.match(/https?:\/\/[^\s"<>]+auth\/v1\/verify[^\s"<>]+/i)?.[0];
        if (link) return link.replaceAll("\\\\", "");
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No local Supabase confirmation link arrived for ${email}.`);
}

test.describe.configure({ mode: "serial", retries: 0 });

test("fresh signup confirms from the local email and creates one administrator room", async ({ page }) => {
  const suffix = Date.now().toString(36).toUpperCase();
  const code = `MAIL-${suffix}`;
  const email = `signup-${suffix.toLowerCase()}@granthsetu.test`;
  await page.goto("/create-library");
  const form = page.locator("form");
  await form.getByLabel("Your display name").fill("Mail E2E Owner");
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill("Mail-E2E-Password-2026!");
  await form.getByLabel("Institution or library name").fill("Mail E2E Library");
  await form.getByLabel("Library Code").fill(code);
  await form.getByLabel("Operating currency").fill("INR");
  await form.getByLabel("Display locale").fill("en-IN");
  await form.getByLabel("Library timezone").fill("Asia/Kolkata");
  await Promise.all([page.waitForURL(/confirmation=1/), form.getByRole("button", { name: "Create Library Room" }).click()]);
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await page.goto(await localConfirmationLink(email));
  await page.waitForURL(/\/create-library\/success\?/);
  const admin = adminClient();
  const { count } = await admin.from("libraries").select("id", { count: "exact", head: true }).eq("public_code", code);
  expect(count).toBe(1);
  await page.getByRole("link", { name: "Enter staff workspace" }).click();
  await page.waitForURL(new RegExp(`/operator/${code}`));
  await page.goto(`/l/${code}`);
  await expect(page.getByRole("heading", { name: "Mail E2E Library" })).toBeVisible();
});

test("confirmed no-room recovery preserves Tokyo localization without a password URL or CSP/hydration errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const response = await page.goto(`/create-library?name=${encodeURIComponent(room.name)}&code=${room.code}&person=${encodeURIComponent(room.person)}&currencyCode=JPY&localeCode=ja-JP&timeZone=Asia%2FTokyo`);
  expect(response?.headers()["content-security-policy"]).toBeTruthy();
  expect(response?.headers()["content-security-policy"]).not.toContain("unsafe-eval");
  await page.getByRole("link", { name: "Sign in to continue" }).click();
  const recovery = page.locator("form");
  await recovery.getByLabel("Email").fill(account.email);
  await recovery.getByLabel("Password").fill(account.password);
  await Promise.all([page.waitForURL(/\/create-library\/success\?/), recovery.getByRole("button", { name: "Continue onboarding" }).click()]);
  expect(new URL(page.url()).searchParams.has("password")).toBe(false);
  const admin = adminClient();
  const { data: library, error } = await admin.from("libraries").select("id,currency_code,locale_code,time_zone").eq("public_code", room.code).single();
  expect(error).toBeNull();
  expect(library).toMatchObject({ currency_code: "JPY", locale_code: "ja-JP", time_zone: "Asia/Tokyo" });
  const { data: rate } = await admin.from("library_settings").select("money_minor_value,currency_code").eq("library_id", library!.id).eq("setting_key", "daily_fine_rate_minor").single();
  expect(rate).toEqual({ money_minor_value: 0, currency_code: "JPY" });
  expect(await page.evaluate(() => new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(0))).not.toMatch(/[.,]00/);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("operator creates a session, grade, and section in the browser", async ({ page }) => {
  await signInAsOperator(page);
  await page.goto(`/operator/${room.code}/settings`);
  const session = page.locator("form").filter({ hasText: "Add academic session" });
  await session.getByLabel("Code").fill("E2E-2026");
  await session.getByLabel("Label").fill("E2E 2026");
  await session.getByLabel("Starts").fill("2026-01-01");
  await session.getByLabel("Ends").fill("2026-12-31");
  await session.getByLabel("Status").selectOption("active");
  await expect(session.getByRole("button", { name: "Save session" })).toBeEnabled();
  await submitAndWait(page, session.getByRole("button", { name: "Save session" }));
  const grade = page.locator("form").filter({ hasText: "Add grade / class" });
  await grade.getByLabel("Code").fill("E2E-10");
  await grade.getByLabel("Display name").fill("E2E Grade 10");
  await submitAndWait(page, grade.getByRole("button", { name: "Save grade / class" }));
  const section = page.locator("form").filter({ hasText: "Add section" });
  await section.getByLabel("Code").fill("E2E-A");
  await section.getByLabel("Display name").fill("E2E Section A");
  await submitAndWait(page, section.getByRole("button", { name: "Save section" }));
});

test("rapid duplicate member submission has exactly one logical effect", async ({ page }) => {
  await signInAsOperator(page);
  await page.goto(`/operator/${room.code}/members`);
  await page.getByText("Add member", { exact: true }).click();
  const member = page.locator("form.member-form");
  await member.getByLabel("Display name").fill("Tokyo Test Member");
  await member.getByLabel("Member kind").selectOption("staff");
  await Promise.all([page.waitForURL(/success=/), member.getByRole("button", { name: "Create member" }).dblclick()]);
  const { count } = await adminClient().from("members").select("id", { count: "exact", head: true }).eq("library_id", await libraryId()).eq("display_name", "Tokyo Test Member");
  expect(count).toBe(1);
});

test("rapid duplicate book submission and zero-cost copy creation have exactly one book effect", async ({ page }) => {
  await signInAsOperator(page);
  await page.goto(`/operator/${room.code}/catalogue`);
  await page.getByText("Add book", { exact: true }).click();
  const book = page.locator("form.book-form");
  await book.getByLabel("Title", { exact: true }).fill("Tokyo Zero Decimal Book");
  await book.getByLabel("Author names").fill("E2E Author");
  await Promise.all([page.waitForURL(/success=/), book.getByRole("button", { name: "Create book" }).dblclick()]);
  const admin = adminClient();
  const id = await libraryId();
  const { count } = await admin.from("books").select("id", { count: "exact", head: true }).eq("library_id", id).eq("title", "Tokyo Zero Decimal Book");
  expect(count).toBe(1);
  await page.goto(`/operator/${room.code}/inventory`);
  await page.getByText("Add copy", { exact: true }).click();
  const copy = page.locator("form.copy-form");
  await copy.getByLabel("Book").selectOption({ label: "Tokyo Zero Decimal Book" });
  await copy.getByLabel("Accession number").fill("TOKYO-E2E-001");
  await copy.getByLabel("Replacement cost (JPY)").fill("0");
  await submitAndWait(page, copy.getByRole("button", { name: "Create copy" }));
  const { data: zeroCostCopy, error: zeroCostCopyError } = await admin.from("book_copies").select("replacement_cost_minor,currency_code").eq("library_id", id).eq("accession_number", "TOKYO-E2E-001").single();
  expect(zeroCostCopyError).toBeNull();
  expect(zeroCostCopy).toEqual({ replacement_cost_minor: 0, currency_code: "JPY" });
});

test("browser issue action creates an active loan", async ({ page }) => {
  await signInAsOperator(page);
  await page.goto(`/operator/${room.code}/circulation`);
  await page.getByRole("tab", { name: "Issue" }).click();
  await page.getByPlaceholder("Name, member ID, class or roll").fill("Tokyo");
  await page.getByRole("button", { name: /Tokyo Test Member/ }).click();
  await page.getByPlaceholder("Title, author, ISBN, barcode or accession").fill("Tokyo");
  await page.getByRole("button", { name: /Tokyo Zero Decimal Book/ }).click();
  await submitAndWait(page, page.getByRole("button", { name: "Issue selected copy" }));
  const { count } = await adminClient().from("loans").select("id", { count: "exact", head: true }).eq("library_id", await libraryId()).eq("status", "active");
  expect(count).toBe(1);
});

test("rapid browser renew has one renewal and browser return closes the loan", async ({ page }) => {
  await signInAsOperator(page);
  await page.goto(`/operator/${room.code}/circulation`);
  await page.getByRole("tab", { name: "Renew" }).click();
  await page.getByPlaceholder("Member, title, accession or barcode").fill("Tokyo");
  await page.getByRole("button", { name: "Select" }).click();
  await Promise.all([page.waitForURL(/success=/), page.getByRole("button", { name: "Renew loan" }).dblclick()]);
  const admin = adminClient();
  const id = await libraryId();
  const { count: renewalCount } = await admin.from("loan_renewals").select("id", { count: "exact", head: true }).eq("library_id", id);
  expect(renewalCount).toBe(1);
  await page.goto(`/operator/${room.code}/circulation`);
  await page.getByRole("tab", { name: "Return" }).click();
  await page.getByPlaceholder("Member, title, accession or barcode").fill("Tokyo");
  await page.getByRole("button", { name: "Select" }).click();
  await submitAndWait(page, page.getByRole("button", { name: "Return copy" }));
  const { count: activeLoans } = await admin.from("loans").select("id", { count: "exact", head: true }).eq("library_id", id).eq("status", "active");
  expect(activeLoans).toBe(0);
});
