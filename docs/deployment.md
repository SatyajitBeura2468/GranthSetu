# GranthSetu V3 Deployment

## Repository and branch model

- GitHub repository: `SatyajitBeura2468/GranthSetu`
- Vercel project: `granthsetu`
- Vercel project ID: `prj_oRfwKM95K8o9fpdZxTCJaMB4A5jX`
- Vercel team: `Satyajit Beura's Projects` (`teamsatyajitbeura`)
- Production branch: `main`
- Development database: Supabase project `granthsetu-dev` (`jyvvxseeytjyhuinyzgn`) in `ap-south-1` (Mumbai)
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

Preview/Development may point only at the isolated `granthsetu-dev` Supabase project. Vercel Production has no Supabase credentials and must not receive Development values. No Production Supabase project or school data is configured.

Database migrations, local reset/testing, generated types, synthetic seed data, and the remote Development workflow are documented in [Database Development](database-development.md).

## Preview verification

Open the generated Preview URL and verify `/`. Verify the health endpoint with:

```text
curl https://<preview-host>/api/health
```

The response should report `status: "ok"`, service `granthsetu`, and stage `v3-platform-foundation`. It must not contain secrets.

## Verified foundation Preview

- Preview URL: `https://granthsetu-4q0dwr22v-teamsatyajitbeura.vercel.app`
- Homepage: HTTP 200 and foundation content verified.
- `/api/health`: HTTP 200 JSON verified with `environment: "preview"` and commit `c90776f8d5d94988d499cf061560e84677292171`.
- GitHub repository connection: connected to `SatyajitBeura2468/GranthSetu`.
- No successful Production Deployment was created intentionally; an initial automatic trigger failed before the framework preset was corrected and is not live.

The subsequent Git-triggered Preview for the documentation commit was also `READY`:
`https://granthsetu-git-feat-v3-platform-foundation-teamsatyajitbeura.vercel.app`, commit `40cdb68192396e1c90e2821541056b0f14dc6179`.
