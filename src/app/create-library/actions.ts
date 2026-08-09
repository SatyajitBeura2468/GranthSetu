"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeLibraryCode, validLibraryCode } from "@/lib/library/code";
import { asOperatorRpcClient } from "@/lib/operator/rpc";

function value(form: FormData, key: string) { return String(form.get(key) ?? "").trim(); }

export async function createLibraryAction(formData: FormData) {
  const name = value(formData, "displayName"); const code = normalizeLibraryCode(value(formData, "libraryCode"));
  const person = value(formData, "personName"); const email = value(formData, "email"); const password = value(formData, "password");
  if (name.length < 3 || name.length > 160 || !validLibraryCode(code) || person.length < 2) redirect(`/create-library?error=${encodeURIComponent("Check the library name, code, and your display name.")}`);
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    if (!email || password.length < 8) redirect(`/create-library?error=${encodeURIComponent("Enter a valid email and a password of at least 8 characters.")}`);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: person }, emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm?next=${encodeURIComponent(`/create-library?name=${name}&code=${code}&person=${person}`)}` } });
    if (error) redirect(`/create-library?error=${encodeURIComponent("Unable to create the account. Try signing in if you already have one.")}`);
    if (!data.session) redirect(`/create-library?confirmation=1`);
  }
  const { data, error } = await asOperatorRpcClient(supabase).rpc("create_library_room", { p_display_name: name, p_public_code: code, p_creator_display_name: person });
  if (error || !data) redirect(`/create-library?error=${encodeURIComponent(error?.message === "GS_LIBRARY_CODE_TAKEN" ? "That Library Code is already in use." : "The Library Room could not be created.")}`);
  redirect(`/create-library/success?code=${code}&name=${encodeURIComponent(name)}`);
}
