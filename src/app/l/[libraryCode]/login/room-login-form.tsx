"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { roomLoginAction } from "./actions";

export function RoomLoginForm({ code, configured }: { code: string; configured: boolean }) {
  const [state, action, pending] = useActionState(roomLoginAction, null);
  return <form className="auth-form" action={action}><input type="hidden" name="libraryCode" value={code} /><label>Email<input name="email" type="email" autoComplete="email" required disabled={!configured} /></label><label>Password<input name="password" type="password" autoComplete="current-password" required disabled={!configured} /></label>{state?.error ? <p className="notice notice-error" role="alert">{state.error}</p> : null}{!configured ? <p className="notice" role="status">Staff authentication is not configured in this environment.</p> : null}<button className="button button-primary button-full" type="submit" disabled={pending || !configured}>{pending ? "Signing in…" : "Sign in"}<ArrowRight aria-hidden="true" /></button></form>;
}
