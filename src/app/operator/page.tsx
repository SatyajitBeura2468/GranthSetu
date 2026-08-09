import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { Brand } from "@/components/brand/brand";
import { getOptionalPublicSupabaseEnv } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { asOperatorRpcClient } from "@/lib/operator/rpc";

export default async function OperatorChooserPage() {
  if (!getOptionalPublicSupabaseEnv()) return <main className="state-page"><Brand /><Building2 aria-hidden="true" /><h1>Choose a Library Room</h1><p>Staff access needs the Supabase environment for this deployment.</p><Link className="button button-primary" href="/staff">Staff access</Link></main>;
  const supabase = await createSupabaseServerClient(); const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/staff");
  const { data } = await asOperatorRpcClient(supabase).rpc("operator_accessible_libraries");
  const rooms = (data ?? []) as unknown as Array<{ library_code: string; library_name: string; roles: string[] }>;
  if (rooms.length === 1) redirect(`/operator/${rooms[0].library_code}`);
  return <main className="room-chooser"><Brand /><div><h1>Your Library Rooms</h1><p>Choose a workspace. Only rooms where you hold an active staff role are shown.</p></div>{rooms.length ? <div>{rooms.map((room) => <Link key={room.library_code} href={`/operator/${room.library_code}`}><Building2 aria-hidden="true" /><span><strong>{room.library_name}</strong><small>{room.roles.join(" · ")}</small></span></Link>)}</div> : <div className="empty-state"><h2>No staff access</h2><p>This account is valid, but it has no active role in a Library Room.</p><Link className="button button-secondary" href="/staff">Return to Staff access</Link></div>}</main>;
}
