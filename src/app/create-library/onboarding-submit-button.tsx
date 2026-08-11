"use client";

import { useFormStatus } from "react-dom";

type OnboardingSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  disabled?: boolean;
};

export function OnboardingSubmitButton({ idleLabel, pendingLabel, disabled = false }: OnboardingSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return <button className="button button-primary button-full" type="submit" disabled={isDisabled} aria-disabled={isDisabled} aria-live="polite">
    {pending ? pendingLabel : idleLabel}
  </button>;
}
