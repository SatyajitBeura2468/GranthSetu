"use client";

import { useEffect, useState } from "react";
import { OnboardingSubmitButton } from "./onboarding-submit-button";

export function ResendVerificationButton({ disabled, pendingLabel = "Sending verification email…" }: { disabled: boolean; pendingLabel?: string }) {
  const [seconds, setSeconds] = useState(60);
  useEffect(() => { if (!seconds) return; const id = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(id); }, [seconds]);
  return <OnboardingSubmitButton idleLabel={seconds ? `Resend available in ${seconds}s` : "Resend verification email"} pendingLabel={pendingLabel} disabled={disabled || seconds > 0} />;
}
