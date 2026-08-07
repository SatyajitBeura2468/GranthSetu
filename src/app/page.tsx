export default function Home() {
  const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local";
  const commit = process.env.VERCEL_GIT_COMMIT_SHA;

  return (
    <main className="foundation-shell">
      <section className="foundation-panel" aria-labelledby="foundation-title">
        <div className="foundation-mark" aria-hidden="true">G</div>
        <p className="foundation-kicker">GranthSetu</p>
        <h1 id="foundation-title">OAV Musiguda Library Management System</h1>
        <p className="foundation-stage">V3 Platform Foundation</p>
        <p className="foundation-copy">
          Modern application infrastructure is being established. The library
          workflows will arrive through separately reviewed phases.
        </p>
        <dl className="foundation-meta">
          <div><dt>Runtime</dt><dd>Next.js + React + TypeScript</dd></div>
          <div><dt>Environment</dt><dd>{environment}</dd></div>
          {commit ? <div><dt>Commit</dt><dd>{commit.slice(0, 12)}</dd></div> : null}
        </dl>
      </section>
    </main>
  );
}
