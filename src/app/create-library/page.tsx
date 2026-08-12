import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CheckCircle2, MailCheck, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getOperatorContextFromClient } from "@/lib/auth/authorization";
import { getOptionalPublicSupabaseEnv } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createLibraryAction, resendLibraryVerificationAction, resumeLibraryOnboardingAction } from "./actions";
import { LocalizationFields } from "./localization-fields";
import { OnboardingSubmitButton } from "./onboarding-submit-button";

export const metadata: Metadata = { title: "Create a library", robots: { index: false, follow: false } };
type Query = { error?: string; confirmation?: string; signin?: string; name?: string; code?: string; person?: string; currencyCode?: string; localeCode?: string; timeZone?: string };
type Carry = { personName: string; displayName: string; libraryCode: string; currencyCode: string; localeCode: string; timeZone: string };

function carryFrom(query: Query): Carry { return { personName: query.person ?? "", displayName: query.name ?? "", libraryCode: query.code ?? "", currencyCode: query.currencyCode ?? "INR", localeCode: query.localeCode ?? "en-IN", timeZone: query.timeZone ?? "Asia/Kolkata" }; }
function hiddenCarry(carry: Carry) { return <><input type="hidden" name="personName" value={carry.personName} /><input type="hidden" name="displayName" value={carry.displayName} /><input type="hidden" name="libraryCode" value={carry.libraryCode} /><input type="hidden" name="currencyCode" value={carry.currencyCode} /><input type="hidden" name="localeCode" value={carry.localeCode} /><input type="hidden" name="timeZone" value={carry.timeZone} /></>; }
function continuation(carry: Carry, extra = "") { const query = new URLSearchParams({ name: carry.displayName, code: carry.libraryCode, person: carry.personName, currencyCode: carry.currencyCode, localeCode: carry.localeCode, timeZone: carry.timeZone }); return `/create-library?${query.toString()}${extra}`; }

function Intro() { return <section className="onboarding-intro"><p>Start a Library Room</p><h1>Give your institution a focused place to discover and operate.</h1><ul><li><Building2 aria-hidden="true" /><span><strong>One room identity</strong> for the public catalogue and staff workspace.</span></li><li><ShieldCheck aria-hidden="true" /><span><strong>Tenant-scoped from the first record</strong>, with no global administrator access.</span></li><li><CheckCircle2 aria-hidden="true" /><span><strong>Short onboarding</strong>, then configure policy and catalogue data inside the workspace.</span></li></ul></section>; }
function LibraryFields({ carry }: { carry: Carry }) { return <><fieldset><legend>Library Room</legend><label>Institution or library name<input name="displayName" defaultValue={carry.displayName} required minLength={3} maxLength={160} /></label><label>Library Code<input className="code-field" name="libraryCode" defaultValue={carry.libraryCode} required minLength={5} maxLength={16} pattern="[A-Za-z0-9](?:[A-Za-z0-9-]{3,14})[A-Za-z0-9]" autoCapitalize="characters" /><small>5–16 letters, numbers, or internal hyphens. Reserved codes and consecutive hyphens are unavailable.</small></label></fieldset><LocalizationFields currencyCode={carry.currencyCode} localeCode={carry.localeCode} timeZone={carry.timeZone} /></>; }

export default async function CreateLibraryPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams; const carry = carryFrom(query); const configured = Boolean(getOptionalPublicSupabaseEnv());
  let verified = false;
  if (configured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims(); verified = Boolean(data?.claims?.sub);
    if (verified && await getOperatorContextFromClient(supabase)) redirect("/operator");
  }
  const error = query.error ? <p className="notice notice-error" role="alert">{query.error}</p> : null;
  return <main className="onboarding-shell"><header><Brand /><ThemeToggle compact /></header><div className="onboarding-grid"><Intro /><section className="onboarding-form">
    {query.confirmation ? <Verification carry={carry} configured={configured} error={error} /> : query.signin ? <SignIn carry={carry} configured={configured} error={error} /> : verified ? <VerifiedAccount carry={carry} configured={configured} error={error} /> : <Registration carry={carry} configured={configured} error={error} />}
    <Link className="back-link" href="/">Back to GranthSetu</Link>
  </section></div></main>;
}

function Registration({ carry, configured, error }: { carry: Carry; configured: boolean; error: ReactNode }) { return <><div><span>1</span>Account</div><div><span>2</span>Library</div><form action={createLibraryAction} noValidate><fieldset disabled={!configured}><legend>Your account</legend><label>Your display name<input name="personName" defaultValue={carry.personName} required minLength={2} maxLength={120} /></label><label>Email<input name="email" type="email" autoComplete="email" required maxLength={320} /></label><label>Password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={1024} /></label></fieldset><LibraryFields carry={carry} />{error}{!configured ? <p className="notice" role="status">Library creation is temporarily unavailable because the production data service is not configured.</p> : null}<OnboardingSubmitButton idleLabel="Create Library Room" pendingLabel="Creating account…" disabled={!configured} /></form><p className="onboarding-switch">Already have a GranthSetu account? <Link href={continuation(carry, "&signin=1")}>Sign in to continue</Link>.</p></>; }
function Verification({ carry, configured, error }: { carry: Carry; configured: boolean; error: ReactNode }) { return <div className="onboarding-state"><MailCheck aria-hidden="true" /><p className="step-label">Email verification</p><h2>Verify your email</h2><p>Check the email address you entered and follow the verification link to finish creating your Library Room.</p>{error}<form action={resendLibraryVerificationAction} noValidate>{hiddenCarry(carry)}<label>Email address<input name="email" type="email" autoComplete="email" required maxLength={320} /></label><OnboardingSubmitButton idleLabel="Resend verification email" pendingLabel="Sending verification email…" disabled={!configured} /></form><div className="onboarding-state-links"><Link href={continuation(carry, "&signin=1")}>Sign in to continue</Link><Link href={continuation(carry)}>Use a different email</Link></div></div>; }
function SignIn({ carry, configured, error }: { carry: Carry; configured: boolean; error: ReactNode }) { return <div className="onboarding-state"><p className="step-label">Continue onboarding</p><h2>Sign in to continue</h2><p>If your account is confirmed and does not have a Library Room yet, GranthSetu will finish the room you selected.</p><form action={resumeLibraryOnboardingAction} noValidate>{hiddenCarry(carry)}<label>Email<input name="email" type="email" autoComplete="email" required maxLength={320} /></label><label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={1024} /></label>{error}<OnboardingSubmitButton idleLabel="Continue onboarding" pendingLabel="Signing in…" disabled={!configured} /></form><div className="onboarding-state-links"><Link href={continuation(carry)}>Create a different account</Link><Link href="/forgot-password">Forgot password?</Link></div></div>; }
function VerifiedAccount({ carry, configured, error }: { carry: Carry; configured: boolean; error: ReactNode }) { return <><div><span>1</span>Account verified</div><div><span>2</span>Library</div><div className="notice notice-success" role="status"><h2>Account verified</h2><p>Finish your Library Room details below. You will not need to create your account again.</p></div><form action={createLibraryAction} noValidate><input type="hidden" name="personName" value={carry.personName} /><LibraryFields carry={carry} />{error}<OnboardingSubmitButton idleLabel="Create Library Room" pendingLabel="Creating Library Room…" disabled={!configured} /></form></>; }
