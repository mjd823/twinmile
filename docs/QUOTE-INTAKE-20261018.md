# Quote intake and GVAI handoff

## Scope

The visible form uses `submitQuoteLeadAction`, not `/api/quote`. Both now save the same immutable delivery intents. Customer notes live in `customerNotes`; `notes` remains the existing internal-notes array. The quote is not a booked load or an accepted rate.

- A browser UUID deduplicates a retry. Editing the request generates a new UUID. An identical UUID with changed details is rejected.
- Operator notification uses the configured Twin Mile inbox, never a customer-supplied destination. Resend acceptance is recorded as `accepted`, not delivered.
- The GVAI copy goes only to `/api/client-intake/twinmile`. It requires a separate production-only `GVAI_INTAKE_KEY`; GVAI stores its SHA-256 hash, not the raw key.
- GVAI acknowledges only after the tenant-scoped lead exists. Event IDs are permanently deduplicated; different details conflict. Owner edits and acknowledged deletions survive retries.
- The new all-hours recovery cron retries only saved intents. Old quotes without intents are not backfilled.
- Owner email retries reuse exactly the same payload and provider idempotency key. At 23 hours after the first attempt, an unresolved email requires review instead of risking a duplicate outside Resend's 24-hour deduplication window: https://resend.com/docs/dashboard/emails/idempotency-keys
- The existing form customer confirmation is attempted once for a newly inserted request. Its outcome is stored; an unknown outcome is not automatically resent. The API and recovery cron never send customer confirmations.
- The existing follow-up task is queued with an ObjectId and deduplicated. Its separate sender still obeys `OUTREACH_AUTOMATION`; this work does not enable outreach.

## Verification

`node scripts/quote-local.mjs test` checks the actual server action, API and adapter with injected providers. `node scripts/quote-local.mjs verify` uses real Mongo semantics in a uniquely named disposable fixture database and the actual GVAI capture helper, with fake email acceptance only. It drops its fixture collections afterward, never real business collections.

Browser checks in the GVAI repository cover portal inquiries on desktop/mobile and interrupted Twin Mile form submissions. All browser POSTs are blocked. No test emails, numbers, customer messages, or freight bookings are created.

## Production Checks

Deploy GVAI first, confirm authenticated invalid input returns 400 without creating a lead, then deploy Twin Mile with its server-only intake key. Confirm both aliases point at the intended commits. Confirm quote recovery heartbeat and outreach remains paused. Do not claim a real operator email arrived until the provider/carrier and inbox evidence exists.

External CRM delivery is not part of this bridge: the copy is recorded in GVAI's own client dashboard. External CRM credentials still need a separate client-specific connection.
