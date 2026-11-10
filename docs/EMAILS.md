# 9D emails

Every email uses one layout (`src/lib/email-layout.ts`): the 9D mark, a white card, a green button and a small footer. Change the look there and every email follows.

| Email | Who gets it | Sent by | Where the words live |
| --- | --- | --- | --- |
| Invitation, "set up your login" | The invited person | The app (Resend) | `src/lib/email.ts` |
| Team updates (schedule, messages, forms, payment reminders, trial reminders) | Team members, minus what they muted | The app (Resend) | The notification's own title and body |
| Registration receipt | The parent who registered | The app (Resend) | `src/lib/registration-actions.ts` |
| Subscribed, subscription ended | The team's admins | The app, from the billing webhook | `billingEmail` in `src/lib/email-templates.ts` |
| Card receipts, failed card, card expiring | The paying admin | Stripe | Stripe settings (below) |
| Confirm email, reset password, confirm new email | The person signing in | Supabase | `supabase/templates/*.html` |
| Product updates and roadmap | Coaches and admins who have not unsubscribed | You, as a Resend Broadcast | `docs/email-templates/product-update.html` |

Nothing is emailed until `RESEND_API_KEY` is set in Vercel (see `docs/DEPLOY.md`).

## Login emails (Supabase)

Supabase sends these, so the app cannot style them at send time. The finished HTML is in `supabase/templates/`. In Supabase → **Authentication → Emails → Templates**, paste each file into the matching template and set the subject:

| Template in Supabase | File | Subject |
| --- | --- | --- |
| Confirm signup | `confirm.html` | Confirm your email for 9D |
| Reset password | `recovery.html` | Reset your 9D password |
| Change email address | `email_change.html` | Confirm your new email for 9D |

The logo loads from `{{ .SiteURL }}`, so the **Site URL** in Supabase must be `https://9dbsbl.app`.

These files are generated from `AUTH_EMAILS` in `src/lib/email-templates.ts`. After changing the wording or the layout, run `UPDATE_EMAIL_TEMPLATES=1 npx vitest run src/lib/email-templates.test.ts` and paste the new files into Supabase again. The normal test run fails if the files are out of date.

## Billing emails

- **From the app:** "You're subscribed" after checkout, and "Your subscription has ended" when Stripe ends it. Trial reminders (7 days and 1 day before the end) already go out as team updates.
- **From Stripe:** receipts, failed payments and expiring cards. Turn these on in Stripe → **Settings → Billing → Subscriptions and emails**, and add the 9D logo and green (`#027a48`) under **Settings → Branding** so they match.

## Product updates and roadmap

These are announcements, not account emails, so they need an unsubscribe link and a mailing address. Resend Broadcasts adds the unsubscribe link and keeps the list of who opted out.

1. Copy `docs/email-templates/product-update.html` (or ask Claude to fill it in from the roadmap: `productUpdateHtml` in `src/lib/email-templates.ts` builds it).
2. Replace `ADD YOUR MAILING ADDRESS` with a real postal address.
3. In Resend, keep an audience of coaches and team admins only. Do not add players: many are minors.
4. Create a Broadcast with the HTML, send yourself a test, then send.

`{{{contact.first_name|there}}}` and `{{{RESEND_UNSUBSCRIBE_URL}}}` are filled in by Resend for each person.
