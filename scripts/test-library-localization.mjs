import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { canonicalizeCurrencyCode, formatDateOnly, libraryDateKey, moneyInputStep, parseMoneyToMinorUnits } from "../src/lib/i18n/library-localization.ts";
import { getLibraryOnboardingContinuation } from "../src/lib/onboarding/continuation.ts";
assert.equal(canonicalizeCurrencyCode(" usd "), "USD");
assert.equal(parseMoneyToMinorUnits("12.34", "USD"), 1234);
assert.equal(parseMoneyToMinorUnits("12", "JPY"), 12);
assert.equal(parseMoneyToMinorUnits("12.1", "JPY"), null);
assert.equal(parseMoneyToMinorUnits("12.345", "BHD"), 12345);
assert.equal(parseMoneyToMinorUnits("12.3456", "BHD"), null);
assert.equal(parseMoneyToMinorUnits("0", "USD"), 0);
assert.equal(parseMoneyToMinorUnits("-1", "USD"), null);
assert.equal(parseMoneyToMinorUnits("-1", "USD", true), -100);
assert.equal(moneyInputStep("JPY"), "1");
assert.equal(moneyInputStep("USD"), "0.01");
assert.equal(moneyInputStep("BHD"), "0.001");
const instant = "2026-08-11T02:30:00.000Z";
assert.equal(libraryDateKey(instant, "America/New_York"), "2026-08-10");
assert.equal(libraryDateKey(instant, "Asia/Kolkata"), "2026-08-11");
assert.equal(libraryDateKey(instant, "Asia/Tokyo"), "2026-08-11");
assert.match(formatDateOnly("2026-08-11", "en-US"), /2026/);
assert.match(formatDateOnly("2026-08-11", "ja-JP"), /2026/);
const continuation = new URL(getLibraryOnboardingContinuation({
  displayName: "Tokyo Library",
  libraryCode: "TOKYO-01",
  personName: "Sakura",
  currencyCode: "JPY",
  localeCode: "ja-JP",
  timeZone: "Asia/Tokyo",
  confirmation: true,
}), "https://granthsetu.test");
assert.equal(continuation.searchParams.get("currencyCode"), "JPY");
assert.equal(continuation.searchParams.get("localeCode"), "ja-JP");
assert.equal(continuation.searchParams.get("timeZone"), "Asia/Tokyo");
assert.equal(continuation.searchParams.get("confirmation"), "1");
assert.equal(continuation.searchParams.has("password"), false);
const migration = await readFile(new URL("../supabase/migrations/20260811110000_global_commercial_localization_and_idempotency.sql", import.meta.url), "utf8");
assert.match(migration, /drop constraint if exists library_settings_one_typed_value_check;/, "the legacy INR-only setting constraint must be removed before global currency support is enabled");
console.log("Library localization money contract passed.");
