import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.API_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? "";
if ((!url.includes("127.0.0.1") && !url.includes("localhost")) || !serviceKey) throw new Error("E2E seeding is local-Supabase only.");
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const password = "E2E-Global-Launch-2026!";
const rooms = [{ code: "OAVMUSI", name: "OAV Musiguda Library", currency: "INR", locale: "en-IN", zone: "Asia/Kolkata" }, { code: "E2EROOM", name: "E2E US Room", currency: "USD", locale: "en-US", zone: "America/New_York" }];
const role = async (roleKey) => { const { data, error } = await admin.from("roles").select("id").eq("role_key", roleKey).single(); if (error || !data) throw error ?? new Error(`Missing ${roleKey} role`); return data.id; };
const ensureRoom = async (room) => { const { data: existing } = await admin.from("libraries").select("id").eq("public_code", room.code).maybeSingle(); if (existing) { await admin.from("libraries").update({ currency_code: room.currency, locale_code: room.locale, time_zone: room.zone }).eq("id", existing.id); return existing.id; } const { data, error } = await admin.from("libraries").insert({ public_code: room.code, display_name: room.name, currency_code: room.currency, locale_code: room.locale, time_zone: room.zone }).select("id").single(); if (error || !data) throw error ?? new Error("Could not create E2E room"); return data.id; };
const roomIds = Object.fromEntries(await Promise.all(rooms.map(async (room) => [room.code, await ensureRoom(room)])));
async function ensureOperator(email, displayName, roomCode, roleKey) { let user; for (let page = 1; ; page += 1) { const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 }); if (error) throw error; user = data.users.find((item) => item.email === email); if (user || !data.nextPage) break; } if (!user) { const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (error || !data.user) throw error ?? new Error("Could not create E2E user"); user = data.user; }
  let { data: profile } = await admin.from("profiles").select("id").eq("auth_user_id", user.id).maybeSingle(); if (!profile) { const { data, error } = await admin.from("profiles").insert({ auth_user_id: user.id, display_name: displayName, status: "active" }).select("id").single(); if (error || !data) throw error ?? new Error("Could not create E2E profile"); profile = data; }
  const roleId = await role(roleKey); const { error } = await admin.from("profile_roles").upsert({ profile_id: profile.id, library_id: roomIds[roomCode], role_id: roleId, status: "active" }, { onConflict: "profile_id,library_id,role_id" }); if (error) throw error;
}
await ensureOperator("e2e-admin@granthsetu.invalid", "E2E Administrator", "OAVMUSI", "administrator");
await ensureOperator("e2e-librarian@granthsetu.invalid", "E2E Librarian", "OAVMUSI", "librarian");
await ensureOperator("e2e-room-b-admin@granthsetu.invalid", "E2E Room B Administrator", "E2EROOM", "administrator");
console.log("Local E2E users and localized rooms are ready.");
