"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updatePasswordAction, type PasswordState } from "@/app/update-password/actions";

function PasswordSubmit() {
  const { pending } = useFormStatus();
  return <button className="auth-submit" type="submit" disabled={pending}>{pending ? "Updating…" : "Update password"}</button>;
}

export function PasswordForm() {
  const [state, action] = useActionState<PasswordState, FormData>(updatePasswordAction, null);
  return (
    <form className="auth-form" action={action}>
      <div className="auth-field"><label htmlFor="password">New password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required autoFocus /></div>
      <div className="auth-field"><label htmlFor="confirmation">Confirm new password</label><input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required /></div>
      {state?.error ? <p className="auth-error" role="alert">{state.error}</p> : null}
      <PasswordSubmit />
    </form>
  );
}
