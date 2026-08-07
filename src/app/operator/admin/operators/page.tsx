import Link from "next/link";
import { requireAdministrator } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assignRoleAction, inviteOperatorAction, revokeRoleAction, setOperatorStatusAction } from "@/app/operator/admin/operators/actions";

export default async function OperatorsAdminPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  await requireAdministrator();
  const supabase = await createSupabaseServerClient();
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, status, created_at").order("created_at", { ascending: true }),
    supabase.from("profile_roles").select("profile_id, role_id, roles(role_key)")
  ]);
  const params = await searchParams;
  const roleByProfile = new Map<string, string[]>();
  for (const row of roles ?? []) {
    const role = Array.isArray(row.roles) ? row.roles[0]?.role_key : row.roles?.role_key;
    if (role) roleByProfile.set(row.profile_id, [...(roleByProfile.get(row.profile_id) ?? []), role]);
  }
  return (
    <section className="operator-page" aria-labelledby="operators-title">
      <Link className="auth-secondary-link" href="/operator">← Operator workspace</Link>
      <p className="auth-kicker">Administrator controls</p>
      <h1 id="operators-title">Operator access</h1>
      <p className="operator-lede">Invite approved staff and manage database-authoritative role and lifecycle state. Email addresses are handled by Supabase Auth and are not displayed here.</p>
      {params.error ? <p className="auth-error" role="alert">{params.error}</p> : null}
      {params.success ? <p className="auth-success" role="status">Operator access updated.</p> : null}
      <form className="operator-invite" action={inviteOperatorAction}>
        <h2>Invite an operator</h2>
        <div className="operator-form-grid"><label className="auth-field">Email<input name="email" type="email" autoComplete="email" required maxLength={320} /></label><label className="auth-field">Display name<input name="displayName" required maxLength={160} /></label><label className="auth-field">Initial role<select name="role" defaultValue="librarian"><option value="librarian">Librarian</option><option value="administrator">Administrator</option></select></label></div>
        <button className="button" type="submit">Send invitation</button>
      </form>
      <div className="operator-table-wrap"><table className="operator-table"><caption>Provisioned operator profiles</caption><thead><tr><th scope="col">Display name</th><th scope="col">Status</th><th scope="col">Roles</th><th scope="col">Controls</th></tr></thead><tbody>{(profiles ?? []).map((profile) => { const profileRoles = roleByProfile.get(profile.id) ?? []; return <tr key={profile.id}><th scope="row">{profile.display_name}</th><td>{profile.status}</td><td>{profileRoles.join(", ") || "—"}</td><td><div className="operator-controls">{profileRoles.map((role) => <form key={role} action={revokeRoleAction}><input type="hidden" name="profileId" value={profile.id} /><input type="hidden" name="role" value={role} /><button className="button button-small button-quiet" type="submit">Revoke {role}</button></form>)}{profile.status === "active" ? <form action={setOperatorStatusAction}><input type="hidden" name="profileId" value={profile.id} /><input type="hidden" name="status" value="inactive" /><button className="button button-small button-quiet" type="submit">Deactivate</button></form> : <form action={setOperatorStatusAction}><input type="hidden" name="profileId" value={profile.id} /><input type="hidden" name="status" value="active" /><button className="button button-small" type="submit">Reactivate</button></form>}<form action={assignRoleAction}><input type="hidden" name="profileId" value={profile.id} /><input type="hidden" name="role" value="librarian" /><button className="button button-small button-quiet" type="submit">Ensure librarian</button></form></div></td></tr>; })}</tbody></table></div>
    </section>
  );
}
