# Local issue draft: quote retry after an in-flight edit

- Business: Twin Mile
- Lane: role:cto
- Scope: one quote-form retry fix; no external issue created.
- Base: f9b46bc, the approved quote/GVAI bridge. Refreshed origin/main is
  b84d96b, its direct parent; starting there alone would omit the deployed bridge.
- Original checkout: C:/Users/mdaws/Projects/twinmile; its untracked
  docs/HANDOFF-twinmile.md and opencode.json are outside this change.

## Evidence

QuoteForm clears its submission ID on edits only while it is not submitting.
Its fields remain editable during submission. If the user edits while a response
is pending and that response is interrupted, retrying reuses the original ID
with changed details. saveQuoteIntake rejects that fingerprint mismatch when
the first request was saved.

## Acceptance

- An unchanged request reuses its ID after an interrupted response.
- An edit during submission invalidates that ID before the next attempt.
- Validate only with the real form component and injected fake responses;
  no browser, quote endpoint, database, provider, or message calls.
- No commit, push, deployment, or production changes.

The AGENTS.md business-ops draft helper and parent Twin Mile spec are absent
at the documented paths. This file records the local issue draft instead.

## Local result

- Removed the submitting-state exception from QuoteForm's edit handler.
- Before the fix: unchanged retry passed; in-flight edit retry failed because
  both attempts had the same submission ID.
- After the fix: 2 passed, 0 failed with
  `node --test --test-timeout=5000 scripts/quote-form-retry.test.mjs`.
- Reused the original checkout's installed TypeScript through NODE_PATH;
  no dependencies installed. The sandbox cannot import the real server action
  and exposes no network or provider functions.
- Existing bridge tests were not repeated. No full build or live checks ran.
- Real browser event behavior, database persistence, deployment, GVAI receipt,
  and operator inbox delivery remain unproved by this focused offline test.

Next safe action: review this local patch against the approved deployed branch.
Main can handle provider evidence separately; outreach and load work stay paused.
