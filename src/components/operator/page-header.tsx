import type { ReactNode } from "react";

export function OperatorPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <header className="operator-page-header"><div><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{actions ? <div className="operator-page-actions">{actions}</div> : null}</header>;
}

export function Feedback({ error, success }: { error?: string; success?: string }) {
  return <>{error ? <p className="notice notice-error" role="alert">{error}</p> : null}{success ? <p className="notice notice-success" role="status">{success}</p> : null}</>;
}
