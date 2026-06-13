# [Twin Mile] Create A Linear Task For Twin Mile Driver Recruiting

## Agent Control Plane

This task was generated from a plain-language request by `business-ops/ops-agent.mjs`.

Original request:

> Codex, create a Linear task for Twin Mile driver recruiting

## Routing

- Business: Twin Mile
- Repo: /home/mjd/mjdsprojects/twinmile
- GitHub: mjd823/twinmile
- Linear project: Twin Mile Operating System
- Vercel project: prj_vAXbrQ95oJygFVGMWWijJa9ay2F0
- Work lane: `role:fleet`
- Task type: `type:ops`
- Approval: `approval:needed`
- Branch: `ops/twinmile-create-a-linear-task-for-twin-mile-driver-recrui`

## Parent Context

- Workspace operating guide: `/home/mjd/mjdsprojects/BUSINESS-OPS.md`
- Business spec: `/home/mjd/mjdsprojects/business-ops/specs/twinmile.md`
- Repo agent guide: `/home/mjd/mjdsprojects/twinmile/AGENTS.md`

## Likely Surfaces

- `app/drive-with-us`
- `app/api/driver-application`
- `app/admin/drivers`

## Execution Plan

1. Read /home/mjd/mjdsprojects/twinmile/AGENTS.md and the parent context spec at /home/mjd/mjdsprojects/business-ops/specs/twinmile.md.
2. Inspect the current implementation before editing.
3. Create or use branch ops/twinmile-create-a-linear-task-for-twin-mile-driver-recrui.
4. Focus lane: role:fleet, type:ops.
5. Start with these likely surfaces: app/drive-with-us, app/api/driver-application, app/admin/drivers.
6. Implement the smallest complete change that satisfies the ticket.
7. Run verification: npm run build | npm run lint.
8. For UI/admin work, run a browser smoke test on desktop and mobile when practical.
9. Update the Linear issue or local draft with result, checks, links, and any blockers.

## Acceptance Criteria

- Lead or driver workflow changes preserve form submission safety and do not mutate production records during testing.
- The task has a clear before/after result that can be reviewed from the repo or browser.
- No live action runs without explicit approval or an approved Linear issue.
- Relevant local checks pass, or any failures are documented with the exact error and next step.
- The final report includes changed files, verification commands, deployment status if relevant, and remaining risks.

## Verification Commands

- `npm run build`
- `npm run lint`

## Approval Gate

No live email, SMS, voice call, customer outreach, production database mutation, paid account change, publish action, or production deployment promotion may run until MJD explicitly approves it or the Linear issue is marked approved.

## Agent Notes

- Treat Linear as the source of truth once write access is available.
- Until then, this file is the local Linear-ready draft.
- Update this task with findings, links, screenshots, build output summaries, and final PR/deployment status.
