# AI Work Operations Platform — Web Application Implementation Specification

## 1. Purpose

Build a production-oriented, multi-tenant web application that combines:

- Workspaces and user roles
- Projects and task management
- AI-assisted work planning
- Document management and summarization
- Google Workspace integrations
- Notifications and audit logging
- Future automation and cybersecurity modules

The web application is the first product. Do **not** implement the Tauri desktop application yet. The architecture must remain reusable so that a Tauri client can be added later.

---

## 2. Product Vision

Create an AI-powered work operating system for:

- Virtual assistants
- Freelancers
- Administrative teams
- Project teams
- Cybersecurity professionals

The platform should help users organize work, summarize information, generate structured tasks, retrieve authorized documents, prepare reports, and perform approved actions through secure integrations.

The AI must act as an assistant, not as an unrestricted autonomous agent.

---

## 3. Initial MVP Goal

The first usable milestone is complete when a user can:

1. Register and log in.
2. Create or join a workspace.
3. Create a project.
4. Create, update, assign, filter, and complete tasks.
5. Ask the AI to generate a task plan or subtasks.
6. Review AI-generated output before saving it.
7. View a dashboard containing real workspace data.
8. See relevant activity and audit records.

Do not add advanced modules until this milestone works reliably.

---

## 4. Technology Stack

### Frontend

- Next.js with App Router
- TypeScript with strict mode
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- TanStack Query
- Zustand only for lightweight client state

### Backend

- Next.js server actions and route handlers
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime where useful

### AI

- AI provider accessed only from server-side code
- Structured JSON responses
- Zod validation for every structured response
- Tool/function calling only through approved backend functions
- Workspace and user authorization enforced before every AI action

### Deployment

- Vercel for the Next.js application
- Supabase for database, authentication, and storage
- Separate background worker later for long-running jobs

---

## 5. Non-Negotiable Security Rules

1. Never expose secret keys in browser code.
2. Never place the following values in `NEXT_PUBLIC_*` variables:
   - AI provider secret key
   - Supabase service-role key
   - Google client secret
   - OAuth refresh tokens
   - Database administrative credentials
3. Enable Row-Level Security on every user-accessible table.
4. Every business record must be associated with a `workspace_id`.
5. Every server-side mutation must verify:
   - The user is authenticated.
   - The user belongs to the target workspace.
   - The user has the required role or permission.
6. Treat all AI output as untrusted input.
7. Validate all request bodies, route parameters, and AI responses with Zod.
8. Require human confirmation before:
   - Sending email
   - Creating or changing calendar events
   - Deleting files
   - Performing destructive operations
   - Applying AI-generated changes in bulk
9. Do not log access tokens, refresh tokens, API keys, authorization headers, document contents, or secrets.
10. Add rate limiting to authentication-sensitive and AI endpoints.
11. Use least-privilege OAuth scopes.
12. Do not implement arbitrary shell execution, remote command execution, or unrestricted URL fetching.
13. Add audit records for security-sensitive and destructive actions.
14. Use secure, HTTP-only cookies for server-managed sessions where applicable.
15. Use separate development, staging, and production environments.

---

## 6. Environment Variables

Create `.env.example` with placeholders only:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

AI_API_KEY=
AI_MODEL=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

ENCRYPTION_KEY=
```

Rules:

- Never commit `.env.local`.
- Validate environment variables at startup.
- Fail clearly when required server variables are missing.
- Use a typed environment module instead of reading `process.env` throughout the codebase.

---

## 7. Recommended Repository Structure

```text
src/
├── app/
│   ├── (public)/
│   │   └── page.tsx
│   ├── (auth)/
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── auth/callback/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── projects/
│   │   ├── tasks/
│   │   ├── documents/
│   │   ├── assistant/
│   │   ├── integrations/
│   │   └── settings/
│   ├── api/
│   │   ├── ai/
│   │   ├── documents/
│   │   ├── integrations/
│   │   └── webhooks/
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/
│   ├── layout/
│   ├── dashboard/
│   ├── projects/
│   ├── tasks/
│   ├── assistant/
│   └── forms/
├── features/
│   ├── auth/
│   ├── workspaces/
│   ├── projects/
│   ├── tasks/
│   ├── documents/
│   ├── ai/
│   ├── notifications/
│   └── audit/
├── lib/
│   ├── supabase/
│   │   ├── browser.ts
│   │   ├── server.ts
│   │   └── admin.ts
│   ├── auth/
│   ├── permissions/
│   ├── validation/
│   ├── ai/
│   ├── rate-limit/
│   ├── env.ts
│   └── utils.ts
├── services/
├── types/
└── middleware.ts

supabase/
├── migrations/
├── seed.sql
└── config.toml

tests/
├── unit/
├── integration/
└── e2e/
```

---

## 8. Core Data Model

Use UUID primary keys and `timestamptz` timestamps.

### 8.1 Profiles

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  timezone text not null default 'Asia/Manila',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.2 Workspaces

```sql
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.3 Workspace Members

```sql
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
```

### 8.4 Projects

```sql
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'on_hold', 'completed', 'archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.5 Tasks

```sql
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'review', 'done', 'cancelled')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid references auth.users(id),
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.6 Task Comments

```sql
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.7 Activity Logs

```sql
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### 8.8 AI Conversations

```sql
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.9 AI Messages

```sql
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id),
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### 8.10 AI Usage

```sql
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric(12,6),
  status text not null,
  created_at timestamptz not null default now()
);
```

---

## 9. Row-Level Security Strategy

Create a helper function:

```sql
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
  );
$$;
```

Create a role helper:

```sql
create or replace function public.has_workspace_role(
  target_workspace uuid,
  accepted_roles text[]
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
      and role = any(accepted_roles)
  );
$$;
```

RLS expectations:

- `viewer`: read only
- `member`: create and edit normal work records
- `admin`: manage members and most workspace settings
- `owner`: full workspace control

Every table must receive explicit policies for:

- `select`
- `insert`
- `update`
- `delete`

Do not rely on one permissive policy for all operations.

---

## 10. Authentication and Onboarding

### Required Authentication Features

- Email/password registration
- Email verification
- Login
- Logout
- Forgot password
- Password reset
- Session refresh
- Google OAuth
- Protected routes

### Onboarding Flow

After first successful authentication:

1. Ensure the user has a profile.
2. Ask for:
   - Full name
   - Workspace name
   - Primary role
   - Primary use case
   - Time zone
3. Create the workspace.
4. Add the user as workspace owner.
5. Redirect to the dashboard.

### Supported Use Cases

- Virtual assistance
- Freelancing
- Cybersecurity
- Project management
- Administration
- Personal productivity

---

## 11. Application Shell

### Sidebar

- Dashboard
- Projects
- Tasks
- Documents
- AI Assistant
- Calendar
- Email
- Automations
- Monitoring
- Integrations
- Settings

Only completed routes should be enabled. Incomplete modules should display a clear “Coming soon” state.

### Header

- Workspace selector
- Global search
- Quick create button
- Notifications
- User menu

### Dashboard Widgets

Use real database queries.

- Tasks due today
- Overdue tasks
- Active projects
- Tasks by status
- Recent activity
- Recently updated projects
- AI daily briefing placeholder

---

## 12. Project Management Requirements

### Project Actions

- Create project
- Read project
- Update project
- Archive project
- Restore archived project
- Filter by status
- Search by name
- View project tasks
- View project activity

### Project Validation

- Name: 2–100 characters
- Description: maximum 5,000 characters
- Status must match the database enum
- Workspace membership required
- Archive instead of permanent deletion for normal UI actions

---

## 13. Task Management Requirements

### Task Actions

- Create task
- Edit task
- Assign task
- Change status
- Set priority
- Set due date
- Add description
- Add subtasks
- Add comments
- Mark complete
- Reopen task
- Archive or cancel task
- Search and filter

### Required Views

- All tasks
- My tasks
- Due today
- Overdue
- Completed
- List view
- Kanban view

### Task Rules

- A completed task receives `completed_at`.
- Reopening a task clears `completed_at`.
- A task cannot be assigned to a non-member of the workspace.
- A project-linked task must belong to the same workspace as the project.
- A subtask must belong to the same workspace as its parent.
- All mutations must write an activity record.

---

## 14. AI Assistant Scope

The first AI implementation supports:

1. General work assistant
2. Task-plan generation
3. Subtask generation
4. Task-description improvement
5. Daily briefing generation

Do not implement unrestricted autonomous behavior.

### AI Request Flow

```text
Browser
  ↓
Authenticated server route
  ↓
Validate request
  ↓
Verify workspace membership
  ↓
Check feature quota and rate limit
  ↓
Build minimal authorized context
  ↓
Call AI provider
  ↓
Validate structured output
  ↓
Store usage record
  ↓
Return preview to user
  ↓
User confirms before database mutation
```

### AI Task-Plan Schema

```ts
import { z } from "zod";

export const aiTaskPlanSchema = z.object({
  title: z.string().min(2).max(150),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  estimatedEffort: z.string().max(100).optional(),
  subtasks: z
    .array(
      z.object({
        title: z.string().min(2).max(150),
        description: z.string().max(1000).optional(),
      })
    )
    .max(20),
});
```

### Example AI Input

```text
Prepare our web application for production deployment.
```

### Example AI Output

```json
{
  "title": "Prepare web application for production deployment",
  "description": "Complete security, configuration, testing, and deployment checks.",
  "priority": "high",
  "estimatedEffort": "1–2 days",
  "subtasks": [
    {
      "title": "Review production environment variables"
    },
    {
      "title": "Run the production build"
    },
    {
      "title": "Review Supabase RLS policies"
    },
    {
      "title": "Configure monitoring and error tracking"
    },
    {
      "title": "Complete deployment smoke tests"
    }
  ]
}
```

### AI Safety Requirements

- Never pass entire workspace databases to the model.
- Only send the minimum context required.
- Remove or mask secrets.
- Do not include OAuth tokens, API keys, passwords, private keys, or authorization headers.
- Reject oversized prompts.
- Add a request timeout.
- Return safe error messages.
- Store usage metadata, not hidden reasoning.
- Display AI output as a draft until approved.

---

## 15. API and Server Action Conventions

Every endpoint or server action should follow this sequence:

1. Authenticate user.
2. Parse input.
3. Validate with Zod.
4. Resolve workspace.
5. Verify workspace membership and permission.
6. Execute the operation.
7. Write an activity or audit record when required.
8. Return a typed response.
9. Handle errors without leaking internal details.

### Standard Error Shape

```ts
type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};
```

### Suggested Error Codes

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `RATE_LIMITED`
- `AI_PROVIDER_ERROR`
- `INTERNAL_ERROR`

---

## 16. UI and UX Requirements

- Responsive for desktop and tablet.
- Clear empty states.
- Loading skeletons for database-backed views.
- Optimistic updates only where rollback is safe.
- Confirmation dialogs for destructive operations.
- Keyboard-accessible controls.
- Proper labels for all inputs.
- Visible validation errors.
- Toasts for success and recoverable errors.
- Avoid hiding critical actions in ambiguous icons.
- Use consistent status and priority badges.
- Preserve filters in the URL where useful.
- Support light and dark mode later; do not block MVP on it.

---

## 17. Activity and Audit Logging

### Activity Log

Use for normal workspace events:

- Project created
- Project archived
- Task created
- Task status changed
- Task assigned
- Comment added
- AI plan accepted

### Security Audit Log

Add a separate audit table later for sensitive events:

- Role changed
- Member removed
- Integration connected
- Integration revoked
- Document deleted
- Authentication setting changed
- Bulk AI action approved
- OAuth token refreshed or revoked
- Export requested

Do not include secrets or complete confidential payloads in logs.

---

## 18. Testing Requirements

### Unit Tests

Cover:

- Zod schemas
- Permission helpers
- Task status transitions
- AI response parsing
- Workspace role rules
- Utility functions

### Integration Tests

Cover:

- Authentication-required routes
- Workspace isolation
- Project CRUD
- Task CRUD
- RLS behavior
- AI route authorization
- AI output validation failures

### End-to-End Tests

Minimum user journey:

1. Register.
2. Complete onboarding.
3. Create project.
4. Create task.
5. Ask AI for subtasks.
6. Accept generated subtasks.
7. Complete one task.
8. Verify dashboard updates.

### Security Tests

- User A cannot access User B’s workspace.
- Viewer cannot modify tasks.
- Member cannot manage workspace roles.
- Invalid workspace IDs are rejected.
- Browser cannot access server secret variables.
- Oversized AI prompts are rejected.
- Unvalidated AI output is not stored.
- API errors do not expose stack traces in production.

---

## 19. Coding Standards

- Use TypeScript strict mode.
- Avoid `any`.
- Use named types for domain entities.
- Keep React components focused and small.
- Separate data access from presentation.
- Prefer server components for read-heavy pages.
- Use client components only where interactivity requires them.
- Do not duplicate authorization logic across many files; centralize it.
- Do not place Supabase service-role operations in reusable browser modules.
- Use database migrations for every schema change.
- Add comments only when the intent is not obvious.
- Keep functions short and testable.
- Handle errors explicitly.
- Do not silently swallow exceptions.
- Use consistent naming:
  - Database: `snake_case`
  - TypeScript: `camelCase`
  - React components: `PascalCase`
- Run linting, type checking, tests, and production build before considering a feature complete.

---

## 20. Development Phases

### Phase 0 — Repository Setup

Deliverables:

- Next.js project
- TypeScript strict mode
- Tailwind
- shadcn/ui
- Supabase clients
- Typed environment validation
- ESLint
- Prettier
- Basic test setup
- `.env.example`
- CI workflow

Exit criteria:

- `npm run lint` passes
- `npm run typecheck` passes
- `npm run test` passes
- `npm run build` passes

### Phase 1 — Authentication and Workspace Foundation

Deliverables:

- Registration
- Login
- Logout
- Password recovery
- Google OAuth
- Session handling
- Onboarding
- Workspace creation
- Workspace membership
- Initial RLS policies
- Protected dashboard layout

Exit criteria:

- A new user can register and reach an empty workspace dashboard.
- An unauthenticated user cannot access protected routes.
- One user cannot read another workspace.

### Phase 2 — Projects

Deliverables:

- Project list
- Create project
- Project details
- Edit project
- Archive project
- Search and filter
- Activity records

Exit criteria:

- Project CRUD works within the active workspace.
- Viewer role is read only.
- Archived projects are excluded by default.

### Phase 3 — Tasks

Deliverables:

- Task CRUD
- Task assignment
- Status and priority
- Due dates
- Subtasks
- Comments
- List and Kanban views
- Filters
- Activity records

Exit criteria:

- Task workflows function correctly.
- Cross-workspace task access is blocked.
- Dashboard metrics reflect real task data.

### Phase 4 — AI Task Planning

Deliverables:

- Secure AI server route
- AI usage records
- Prompt validation
- Structured task generation
- Preview screen
- User confirmation
- Save approved tasks and subtasks

Exit criteria:

- AI output is never written directly without confirmation.
- Invalid AI responses are rejected.
- API secrets remain server-side.
- Quota and rate-limit checks exist.

### Phase 5 — Documents

Deliverables:

- Supabase Storage bucket
- Upload form
- File validation
- Document records
- Project/task linking
- Manual summary generation
- Storage RLS

Exit criteria:

- Users can only access files in authorized workspaces.
- Unsupported files are rejected.
- Summaries are displayed as drafts.

### Phase 6 — Google Workspace

Implementation order:

1. Calendar
2. Drive
3. Gmail
4. Docs
5. Sheets

Initial capabilities:

- Calendar: read upcoming events
- Drive: browse and search metadata
- Gmail: summarize selected emails and create drafts
- Docs: create report drafts after confirmation

Exit criteria:

- OAuth tokens are stored server-side and encrypted.
- Only minimum required scopes are requested.
- Send/write actions require explicit user confirmation.

### Phase 7 — Notifications and Beta Release

Deliverables:

- In-app notifications
- Error monitoring
- Rate limiting review
- Security review
- Staging environment
- Beta deployment
- Basic user documentation

---

## 21. First Sprint Backlog

Execute these tasks in order.

### Task 1 — Initialize Project

- Create Next.js application.
- Enable TypeScript strict mode.
- Configure Tailwind.
- Initialize shadcn/ui.
- Add lint, format, type-check, and test scripts.

### Task 2 — Add Environment Validation

- Create `.env.example`.
- Create typed environment schema.
- Separate public and server-only variables.
- Fail startup when required values are absent.

### Task 3 — Configure Supabase Clients

Create:

- Browser client
- Server client
- Admin client restricted to server-only modules
- Session middleware

### Task 4 — Create Initial Migration

Add:

- profiles
- workspaces
- workspace_members
- projects
- tasks
- task_comments
- activity_logs
- ai_conversations
- ai_messages
- ai_usage

Add indexes for:

- `workspace_id`
- `created_at`
- `project_id`
- `assigned_to`
- task status and due date

### Task 5 — Add RLS

- Enable RLS on every table.
- Add membership and role helper functions.
- Add explicit policies.
- Test workspace isolation.

### Task 6 — Build Authentication Pages

- Register
- Login
- Forgot password
- Reset password
- Auth callback
- Logout

### Task 7 — Build Onboarding

- Create profile.
- Create workspace.
- Add owner membership.
- Set active workspace.

### Task 8 — Build Dashboard Shell

- Sidebar
- Header
- Workspace switcher
- User menu
- Empty dashboard state

### Task 9 — Implement Projects

- List
- Create
- Edit
- Archive
- Details

### Task 10 — Implement Tasks

- List
- Create
- Edit
- Assign
- Status
- Priority
- Due date
- Comments
- Subtasks

### Task 11 — Add Dashboard Metrics

- Due today
- Overdue
- Active projects
- Tasks by status
- Recent activity

### Task 12 — Implement AI Task Generator

- Secure server route
- Prompt validation
- Structured output
- Preview
- Confirm and save
- Usage tracking
- Rate limiting

---

## 22. Definition of Done

A feature is complete only when:

- Requirements are implemented.
- Authorization is enforced server-side.
- RLS policies support the intended access.
- Inputs are validated.
- Errors are handled.
- Loading and empty states exist.
- Unit or integration tests cover critical behavior.
- Accessibility basics are satisfied.
- No secrets are exposed.
- Linting passes.
- Type checking passes.
- Tests pass.
- Production build passes.
- Documentation is updated.

---

## 23. Features Explicitly Deferred

Do not implement these during the initial MVP:

- Tauri desktop application
- Mobile application
- Password vault
- Arbitrary local command execution
- Full SOC platform
- Automated penetration testing
- Employee screenshot monitoring
- Autonomous email sending
- Autonomous calendar changes
- Complex visual workflow designer
- Finance and payroll
- Advanced CRM
- Full RAG knowledge base
- Multi-provider AI routing
- Public plugin marketplace

These may be added only after the web MVP is stable.

---

## 24. Future Modules

### Automation Center

- Triggers
- Conditions
- Actions
- Approval steps
- Execution history
- Retry policy
- Scheduled workflows

### Cybersecurity Workspace

- Asset inventory
- Vulnerability imports
- Nmap XML parsing
- OWASP ZAP import
- Nessus import
- Burp report import
- Trivy and SARIF import
- Remediation tasks
- SSL monitoring
- Uptime monitoring
- Defensive alert analysis

### Knowledge Base

- Document ingestion
- Text extraction
- Chunking
- Embeddings
- Vector search
- Workspace-scoped retrieval
- Source citations
- Permission-aware RAG

### Tauri Desktop Client

After the web MVP:

- Reuse authentication and backend APIs.
- Reuse frontend components where practical.
- Add native notifications.
- Add approved local file access.
- Add offline task drafts.
- Add secure update support.
- Do not move server secrets into the desktop binary.

---

## 25. Instructions for the Coding AI

1. Read this entire file before changing code.
2. Implement only the current phase.
3. Do not skip authentication, permissions, validation, or RLS.
4. Do not create mock security that only exists in the UI.
5. Do not expose secrets to the client.
6. Do not introduce a new framework without documenting the reason.
7. Keep each pull request focused.
8. Before marking work complete, run:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
9. Report:
   - Files created
   - Files modified
   - Database migrations added
   - Tests added
   - Commands executed
   - Remaining risks
   - Next recommended task
10. Stop and request clarification only when a decision materially changes security, data ownership, billing, or external integrations.

---

## 26. Start Here

Begin with **Phase 0 — Repository Setup**.

The first response after inspecting the repository should contain:

1. Current repository assessment
2. Existing stack and structure
3. Missing prerequisites
4. Proposed file changes
5. Proposed database migration plan
6. Security concerns found
7. Exact first implementation steps

Do not begin Tauri development. Do not begin Google integrations. Do not begin the cybersecurity module. Establish the secure web foundation first.
