# GranthSetu V3 Deployment

## Repository and branch model

- GitHub repository: `SatyajitBeura2468/GranthSetu`
- Vercel project: `granthsetu`
- Vercel project ID: `prj_oRfwKM95K8o9fpdZxTCJaMB4A5jX`
- Vercel team: `Satyajit Beura's Projects` (`teamsatyajitbeura`)
- Production branch: `main`
- Feature branches, including `feat/v3-platform-foundation`, are Preview branches.
- A future reviewed pull request can reach Production only after an explicit merge to `main`.

## Local commands

```text
npm ci
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Vercel behavior

The Vercel project is connected to the GitHub repository at the repository root with the Next.js framework preset. Vercel Git integration creates Preview Deployments for feature-branch pushes and pull requests, while `main` remains the Production branch. No Production Deployment is being created intentionally in this foundation task.

## Environment strategy

`.env.example` documents variable names only. Local secrets belong in an untracked `.env.local`. Vercel values belong in Vercel’s environment-variable store, scoped to the appropriate Local, Preview, or Production environment. Privileged Supabase secrets must remain server-only.

Preview/Development must never point at a future Production Supabase project. No production Supabase project or school data is configured in this foundation.

## Preview verification

Open the generated Preview URL and verify `/`. Verify the health endpoint with:

```text
curl https://<preview-host>/api/health
```

The response should report `status: "ok"`, service `granthsetu`, and stage `v3-platform-foundation`. It must not contain secrets.
