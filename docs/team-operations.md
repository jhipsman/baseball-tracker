# Team operations

This adds LeagueApps-inspired workflows using the app’s existing Day/Night components. It does not change the dashboard design, global styles, fonts, training, or live scoring.

## Available workflows

- Calendar: games, practices and team events; staff list/day/location management; weekly event creation; edit one or this and later occurrences; select an entire series; bulk move/cancel/restore/delete with review, version checks, optional notifications and advisory field conflicts. Dragging opens a review before saving. Times use the team’s local schedule convention. Game conflict duration defaults to two hours.
- Attendance: players RSVP for themselves, parents for linked children, staff check players in. Group membership and published/canceled state are checked in the database.
- Dues: admins assign a payer and optional player, generate 1–24 monthly USD installments, record cash/check/bank payments and refunds, send manual in-app reminders, and cancel unpaid balances while retaining the transaction history. Month-end dates retain the original anchor (January 31 → February 28 → March 31). Families see only their assigned invoices. Coaches do not get billing access.
- Announcements: saved templates, named recipient review and optional admin-only overdue-payer targeting. Audience changes require another review. Notifications use the existing in-app/push infrastructure; no email or SMS service is added.
- Imports: CSV/XLSX exports from LeagueApps, GameChanger, Google Sheets, Excel or other apps; column mapping, editable paginated review, error filtering, optional existing roster-group matching for schedules and explicit imported-roster linking to joined players. No private API integration, account creation or automatic invitations are implied.

## Stripe setup (online collection remains disabled until configured)

The app uses Stripe Connect Express accounts, one per organization. Current onboarding is US/USD. The existing offline accounting workflows do not need Stripe.

Configure these **server-side** deployment variables:

- `STRIPE_SECRET_KEY` (start with a test-mode key)
- `STRIPE_TEAM_WEBHOOK_SECRET` (signing secret for the connected-account endpoint)
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (canonical HTTPS app origin)
- Existing Supabase public URL/anon configuration

Create a Stripe **connected-account** webhook at `/api/payments/webhook`, with API version `2026-10-28.endive` (the installed Stripe SDK version). Subscribe to:

- `account.updated`
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.deleted`
- `charge.refunded`

An admin then opens Team → Payments and completes Connect onboarding. Enable the desired supported checkout methods in Stripe. Availability depends on the connected account, payment mode and Stripe settings; ACH is not guaranteed. The app sets no platform application fee. Stripe processing, Connect and Billing fees may still apply.

Payers authorize payment in Stripe-hosted Checkout. A return URL never marks an invoice paid: only a signed webhook does. Reconciliation checks the connected account and organization, deduplicates events and payment IDs, and applies cumulative refunds only once. Offline entries describe money already exchanged; they never charge a card or initiate a bank refund. Online refunds are issued in Stripe and reconciled here.

Autopay is opt-in, monthly and finite. It can enroll only a completely unpaid plan with an eligible first due date. A future start must be at least 48 hours away; same-day enrollment requires the team date to agree with the UTC billing date. Otherwise the payer can use individual invoices. The subscription is scheduled to end before an additional installment cycle. Stopping autopay does not undo a payment already processing. Account deletion is blocked while autopay remains active.

Before enabling live collection, verify in Stripe test mode: Connect onboarding, individual card and bank settlement, expired/repeated checkouts, future and same-day enrollment, failed payments and retries, stopping autopay, final-cycle cancellation, refunds, webhook redelivery and temporary database failures. No live Stripe account or credentials were available during this implementation. Test reconciliation code and isolated database checks do not replace that provider acceptance test.

## Deployment and validation

Apply migrations `20261104000000` through `20261107000000` before using these screens. The repository’s existing default-branch migration workflow applies them if its Supabase secrets are configured. Deploy app code with the normal Vercel workflow. Stripe variables are optional until online collection is enabled.

Run `npm test`, `npm run test:db`, `npm run lint`, `npm run typecheck` and `npm run build`. The database test uses an isolated PGlite PostgreSQL engine with all migrations and synthetic users; it never connects to production. If a sandbox blocks Turbopack’s internal port, `npm run build -- --webpack` is the supported local fallback.

Daily scheduled overdue reminders, email/SMS, facility reservation enforcement, direct LeagueApps sync, full registration/waitlists and downloadable app receipts are outside this change. Payment history is available in-app; configure Stripe receipts separately if desired.
