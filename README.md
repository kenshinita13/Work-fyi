# Work.fyi

AI-assisted work operations platform for secure, multi-tenant teams.

## Stack

- Next.js App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui
- Supabase Auth, PostgreSQL, Storage, and RLS
- Vitest

## Local Development

Install dependencies and start the app:

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` and fill in local values. Keep server-only
values out of `NEXT_PUBLIC_*` variables.

Required public values:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Required server-only values:

- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_API_KEY`
- `AI_MODEL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `ENCRYPTION_KEY`

## Verification

Before considering a change complete, run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Database

Supabase migrations live in `supabase/migrations`. All user-accessible tables
must keep row-level security enabled with explicit policies.

The migrations must be applied to the linked project before onboarding and
project operations can use the live workspace. Google sign-in also requires
the Google provider to be enabled in Supabase Auth and the application callback
URL to be allowlisted.

## Current Phase

Phase 3 adds workspace-scoped task creation and editing, assignment, priority,
due dates, subtasks, comments, completion and reopen flows, cancellation,
list and Kanban views, dashboard metrics, and trigger-backed activity history.

## Roles

Workspace roles are authorization boundaries: `owner`, `admin`, `member`, and
`viewer`. Professional categories such as Virtual Assistant, Cybersecurity
Analyst, Freelancer, and Project Manager personalize the product but never
grant access by themselves. Authorization always uses workspace membership and
database row-level security.

Demo accounts can be provisioned idempotently with `npm run seed:demo`. The
command creates one shared demo workspace, covers every professional category,
and prints the generated password once without writing it to the repository.
