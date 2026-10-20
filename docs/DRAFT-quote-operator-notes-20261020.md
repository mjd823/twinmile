# Local issue draft: quote operator note history

Business: Twin Mile. Lane: role:ops. Base: origin/main at 97a821d (merged PR #4).
Branch: fix/quote-operator-note-history-20261020.

The private inbox's Add note action stores entries in leads_quotes.notes, but
the page maps only customerNotes or legacy string notes. Array history never
reaches the detail view, so saved operator handoff notes disappear after reload.

Expose stored note messages and timestamps in the existing quote details.
Keep customer notes and PR #4 delivery warnings intact. Do not pass actor IDs
or other stored metadata to the client. No database writes or business actions
are needed to verify this display bug.

The business-ops helpers and parent spec referenced by AGENTS.md are absent at
the documented paths. Linear is not connected; this is the local issue draft.

Initial verification: ran only the two quote note history cases in
scripts/quote-handoff-attention.test.mjs, using synthetic page and inbox data.
No quote submissions, outreach, operational edits, merge or production deployment.

Result: both cases failed before the fix because noteHistory was absent. Both
passed afterward with:

`node --test --test-timeout=5000 --test-name-pattern='quote note history' scripts/quote-handoff-attention.test.mjs`

The checks cover page-to-detail history, customer and legacy notes, malformed
entries, escaped text, timestamps, and exclusion of actor IDs. git diff --check
passed. PR #4 is an ancestor of this branch and its delivery warnings are
unchanged. No broad suite, local build, browser, database or live provider check ran.

Parent reviewed the display fix and authorized committing these four files,
pushing this feature branch, opening or reusing one PR, and waiting for a READY
hosted preview. Final verification is scoped lint and that hosted build only;
the targeted cases above are not being repeated. The existing isoDate helper
returns an empty string for invalid dates, including malformed note timestamps.
PR and exact-head preview status will be reported with the shipping result.
