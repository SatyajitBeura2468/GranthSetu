"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordReset, type RecoveryState } from "@/app/forgot-password/actions";

function RecoverySubmit() {
  const { pending } = useFormStatus();
  return <button className="auth-submit" type="submit" disabled={pending}>{pending ? "Sending…" : "Send recovery email"}</button>;
}

export function RecoveryForm() {
  const [state, action] = useActionState<RecoveryState, FormData>(requestPasswordReset, { sent: false });
  return state.sent ? (
    <div className="auth-success" role="status">
      <p>If an eligible GranthSetu operator account exists for that email, a recovery message has been sent.</p>
      <Link className="auth-secondary-link" href="/login">Return to sign in</Link>
    </div>
  ) : (
    <form className="auth-form" action={action}>
      <div className="auth-field">
        <label htmlFor="email">Operator email</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={320} autoFocus />
      </div>
      {state.error ? <p className="auth-error" role="alert">{state.error}</p> : null}
      <RecoverySubmit />
      <Link className="auth-secondary-link" href="/login">Return to sign in</Link>
    </form>
  );
}
