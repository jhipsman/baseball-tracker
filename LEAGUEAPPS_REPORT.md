# LeagueApps public workflow review

Reviewed October 30, 2026. This is a review of public product pages, help articles, and published UI images. It is not a decompilation of the private admin app, a logged-in product test, or a claim about backend implementation. No repository files were changed and nothing was deployed.

## What the product is

LeagueApps combines a desktop management console for organizers with a member portal and the LeagueApps Play mobile app for coaches/families. Public material describes shared registration, family/player information, scheduling, communications, payments, reporting, facilities, and evaluations. Changes synchronize between the console, schedules, and mobile app.

Source: https://leagueapps.com/youth-sports-management-platform/ and https://leagueapps.com/mobile-apps/

## Verified workflows and useful design patterns

| Area | Publicly documented behavior | Useful direction for our app (recommendation) |
| --- | --- | --- |
| Organization calendar | List, calendar, and location views; month/week/day; date presets; multi-select filters; quick search; drag/drop time/location edits; recurring-event occurrence vs series editing | Put games, practices, and general team events in one shared calendar; preserve filters across views; show conflicts and affected teams before rescheduling |
| Bulk calendar changes | Select filtered activities, bulk cancel/reschedule/delete/uncancel, choose whether to notify participants | Preview affected events, notify families after a committed change, and clearly distinguish cancellation from deletion |
| Roster/families | Registration collects parent/player details; family accounts; guardian contact access; program/team membership | Let organizers import names first, link guardians/accounts later, and maintain explicit team/season membership |
| Schedule import | Upload, suggest/map headers, map values, show rows with errors, edit cells/bulk replace, finish after validation | Extend our existing mapping/review flow with inline corrections and team/location matching, rather than forcing coaches back into Excel |
| Payments | Installment plans, autopay, stored payment methods, invoices, amount paid/due, payment status, reminders; Stripe-powered gateway; platform page also states cards and ACH | Separate plans, installment obligations, invoices, transactions and refunds; make each installment's due date, status and fee clear; use processor-managed payment methods |
| Communications | Organization/group/individual targeting, filters including payment status, email templates, automated reminders; chat/photos/push and high-priority coach notes in mobile | Distinguish announcements, urgent schedule notices, team chat and private conversations; show the recipient scope before sending |
| Reporting | Registrations, attendance, member information, payment plans, transactions, credits/refunds, net collections | Build organizer views around who needs action: unpaid installments, missing RSVPs, incomplete registrations, upcoming events |
| Game results | Admins can enter scores; delegated scorekeeper staff/captains can enter results; standings update; final, overtime, cancellation, reschedule and forfeit outcomes | Keep an easy final-score entry path separate from detailed baseball live scoring; make scoring permission easy to discover |

## Calendar details

The Global Calendar Guide explicitly documents:

- List view with Today, Today and Tomorrow, This Week, Next Week, This Month and Custom Date Range.
- Reorder/resize/show-hide columns, search across columns, and multi-select filters.
- Edit/cancel/delete/check-in actions on an activity.
- Recurring activity changes scoped to one occurrence or the series.
- Calendar month/week/day views, dragging to change date/time, and filters carried from list view.
- Location rows for spotting conflicts and dragging an activity to a different time/location.
- Bulk cancel, reschedule, delete and uncancel, with a participant-notification choice.

This is a more complete organizer calendar than simply displaying workout due dates. For our product, the highest-value connection is schedule change → affected roster/families → clear announcement → updated calendar, alongside game results.

Source: https://support.leagueapps.com/hc/en-us/articles/38230369036951-Global-Calendar-Guide

## Schedule import details

The published importer accepts CSV, TSV, TXT, XLS, XLSX and XML. Its documented steps are: prepare file → add schedule locations → upload → map headers (AI suggestions, manually editable) → map data and fix errors → finish. It supports isolating error rows, live error counts, cell edits, copy/paste, drag edits and find/replace.

Our prior importer supports fewer formats and does not yet provide all these inline editing/value matching behaviors. A source-specific LeagueApps migration adapter still requires representative exports; these public screenshots do not establish a LeagueApps export schema or prove direct synchronization is available.

Source: https://support.leagueapps.com/hc/en-us/articles/25277201523863-New-Club-Schedule-Importer

## Important correction: LeagueApps can record game scores

The earlier conversation treated the friend's inability to enter scores as a missing product feature. Public documentation contradicts that broad conclusion. Admins enter results from the program schedule using a trophy icon. Staff can be assigned a role with **Can Add and Edit Scores?** permission; the role must be assigned to the relevant program, with team-level assignment needed for broader mobile access as described in the guide. Captains have a separate schedule setting.

That makes configuration/permissions one plausible explanation for the friend's experience, but we have not inspected their account. This documentation proves score/result entry and standings support; it does not establish GameChanger-style pitch-by-pitch baseball scoring.

Sources:
- https://support.leagueapps.com/hc/en-us/articles/360039864233-Updating-Scores-Standings
- https://support.leagueapps.com/hc/en-us/articles/360039864113-How-To-Edit-Scorekeeper-Settings
- https://leagueapps.com/mobile-apps/

## Payments and the high-fee concern

The public pricing page describes a percentage of online payment transactions, a one-time setup fee, no base subscription/contract lock-in, optional paid add-ons, no cost for offline payments, and volume/nonprofit discounts. It does **not** publish a numeric transaction rate on the page reviewed. The page also makes refund/fee-return claims that would need confirmation against an actual customer agreement.

The payment/product pages describe Stripe, installment schedules, autopay and stored cards; the platform page explicitly lists ACH support. Therefore, offering ACH alone would not be a feature LeagueApps lacks. We need the friend's actual quote or statement (with private information removed) and representative installment sizes to compare total processor + platform + recurring/billing costs. No savings or exact LeagueApps rates were inferred.

Recommended fee presentation for our own checkout: amount due, payment method, fee, total today, full installment schedule, and who bears each fee. Those are design recommendations, not observed guarantees about LeagueApps' checkout.

Sources:
- https://leagueapps.com/pricing/
- https://leagueapps.com/youth-sports-management-platform/payments/
- https://leagueapps.com/youth-sports-management-platform/

## Priorities for our existing project

1. Keep training, throwing workload, testing and video features available through the existing module choices.
2. Strengthen the core organizer workflow: teams/families, unified calendar, RSVP/check-in and clear team communications.
3. Connect our final-score and detailed live-scoring tools directly to scheduled games; make permissions obvious.
4. Add installment billing as an auditable payment workflow, with transparent cost comparisons before claiming it is cheaper.
5. Improve import correction/team/location matching using real exported samples, while preserving roster and historical-stat provenance.

These are recommendations only. No implementation is authorized by or embedded in the source material.

## Reference files

- `gallery.html`: image gallery with section filters, captions and source links.
- `image-sources.json`: per-image original URL and download result.
- `images/`: downloaded marketing composites and help-center screenshots, kept as reference material, not product assets.
- `pages/`: retrieved public HTML and parsed text/links/image metadata.

Marketing images include composites and older example screens. Public article publication dates are not proof that every screenshot reflects the current live UI. The account's exact workflows, feature availability, fees, export formats and private APIs remain unverified.
