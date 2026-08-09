"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeLibraryCode, validLibraryCode } from "@/lib/library/code";
import { asOperatorRpcClient } from "@/lib/operator/rpc";

export type RoomLoginState = { error: string } | null;
const generic = "Unable to sign in with those credentials or access this Library Room.";

export async function roomLoginAction(_state: RoomLoginState, formData: FormData): Promise<RoomLoginState> {
  const code = normalizeLibraryCode(String(formData.get("libraryCode") ?? ""));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!validLibraryCode(code) || !email || !password) return { error: generic };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: generic };
  const { data, error: accessError } = await asOperatorRpcClient(supabase).rpc("operator_context_for_library", { p_library_code: code });
  if (accessError || !Array.isArray(data) || !data[0]) { await supabase.auth.signOut(); return { error: "You do not have staff access to this library." }; }
  redirect(`/operator/${code}`);
}
