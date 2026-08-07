"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "@/app/login/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="auth-submit" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>;
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, null);

  return (
    <form className="auth-form" action={action}>
      <input type="hidden" name="next" value={next} />
      <div className="auth-field">
        <label htmlFor="email">Operator email</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={320} autoFocus />
      </div>
      <div className="auth-field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} />
      </div>
      {state?.error ? <p className="auth-error" role="alert">{state.error}</p> : null}
      <SubmitButton />
      <Link className="auth-secondary-link" href="/forgot-password">Forgot password?</Link>
    </form>
  );
}
