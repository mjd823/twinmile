# Twin Mile Codex Operating Guide

Twin Mile is managed by Codex + Linear, not Paperclip.

Use this guide when MJD asks for Twin Mile quotes, driver recruiting, loads, fleet, maintenance, admin, AI business dashboard, MongoDB, Resend, Groq, SEO, or deployment work.

## Business Context

- Business: Twin Mile
- Repo: `mjd823/twinmile`
- Vercel project: `prj_vAXbrQ95oJygFVGMWWijJa9ay2F0`
- Linear project: `Twin Mile Operating System`
- Package manager: npm
- Current production status: Vercel latest production deployment was `READY` when this guide was created.

## Codex Work Lanes

- `role:cto`: app code, APIs, auth, data models, deployment, integrations.
- `role:ops`: admin workflows, customers, contracts, inbox, operations dashboard.
- `role:dispatch`: quotes, loads, routes, delivery operations, customer follow-up drafts.
- `role:fleet`: trucks, drivers, fuel, maintenance, compliance support.
- `role:qa`: browser testing, regression checks, monitoring, production health.

These lanes are Linear labels and Codex routing categories. They are not Paperclip agents.

## Default Workflow

1. Create or link a Linear issue. If Linear write access is unavailable, create a local draft with the ops intake agent:
   `node ../business-ops/ops-agent.mjs --business twinmile "..."`
   For lower-level manual drafts:
   `node ../business-ops/create-linear-draft.mjs --business twinmile --title "..."`
2. Read the parent context spec: `../business-ops/specs/twinmile.md`.
3. Inspect the relevant admin/API/business logic before editing.
4. Keep work on a non-main branch or isolated workspace.
5. Prefer draft/read-only behavior for business actions.
6. Run relevant checks before reporting completion.
7. Check Vercel after deployment work before calling production healthy.

## Safety Gates

Do not send real emails, mutate production logistics data, change customer records, alter driver records, or promote deployments without explicit approval or an approved Linear issue.

Draft reports, local builds, read-only checks, and local code changes are allowed.

## Scheduled Jobs (Vercel Crons)

All scheduled jobs now run as Vercel crons (see `vercel.json`) — the old laptop "Hermes" jobs can be disabled. Routes live in `app/api/cron/*` and are gated by `CRON_SECRET` (`lib/cron-auth.ts`); job expectations are registered in `lib/cron-jobs.ts`. Schedules are UTC:

- `/api/cron/process-outreach` — every 15 min, sends queued outreach emails.
- `/api/cron/onboarding-invites` — every 2h 14:00–23:00 UTC, invites qualified prospects.
- `/api/cron/supervisor-report` — 12:00 UTC daily, pipeline/cron-health/bottleneck report (+ daily_ops heartbeat).
- `/api/cron/prospecting` — 13:00 UTC daily, Sofia's FMCSA Census prospecting.
- `/api/cron/agent-reviews` — 16:00 UTC daily, deterministic agent reviews (Marcus/David/Jennifer/Robert/Emily daily; Isabella/Alexandra Mondays America/Chicago).

Status/timesheet: `GET /api/admin/agent-status` with `x-cron-secret: <CRON_SECRET>` returns per-job last-run + on-time status plus headline business counts.

## Key Surfaces

- Admin: `app/admin`
- Outreach visibility + replies: `app/admin/outreach` (funnel, sent-email bodies, inbound replies + one-click draft send); inbound webhook `app/api/webhooks/resend-inbound` (env: `OUTREACH_REPLY_TO`, `RESEND_WEBHOOK_SECRET`, `OUTREACH_AUTOREPLY`)
- Lead capture: `app/get-a-quote`, `app/drive-with-us`, `app/api/quote`, `app/api/driver-application`
- Fleet/loads/maintenance: `app/admin/fleet`, `app/admin/loads`, `app/admin/maintenance`
- Business AI: `lib/business-organization.ts`, `lib/ai-agents.ts`, `lib/fmcsa-prospecting-core.ts`
- Data/API: `db`, `app/api/admin`
- Auth: `lib/auth`, `app/api/auth`

## Verification

Use the smallest meaningful set for the task:

- `npm run build`
- `npm run lint`
- Browser smoke tests for changed public/admin flows.
- Vercel deployment status check for production or deployment work.
