# Code & IP audit (October 30, 2026)

Question: does the project contain code, text or assets copied from GameChanger, LeagueApps or anyone else without permission?

**Answer: no evidence of copied code was found.** This is a good-faith engineering review, not a legal opinion; have a lawyer review before fundraising or an acquisition.

## What was checked

| Check | Result |
| --- | --- |
| **Who wrote what** (`git log`) | 60 commits by Claude in this project's sessions, 4 by ChatGPT (committed as Johnny Hipsman) and 1 by Codex: about 10,000 lines across 99 files from ChatGPT/Codex (diamond scorer, imports, scheduling, dues/Stripe, announcements, performance work). |
| **Other products named in code** | Only as **import sources**: a coach can upload their *own* CSV/Excel export from GameChanger or LeagueApps (`src/lib/imports/parse.ts`, `imports/wizard.tsx`). Column matching uses ordinary words ("player name", "jersey", "opponent"), not another product's internal formats. Reading a user's exported file is normal interoperability. |
| **Calls to other companies' servers** | None besides services the app is built on (Supabase, Stripe, Anthropic, web push). No GameChanger/LeagueApps API endpoints, scraping or private-API use. |
| **Copyright / license headers from others** | None found. |
| **Links to outside code** (Stack Overflow, gists, repos) | None; only test placeholders and docs links. |
| **Minified, obfuscated or encoded code** | None. The only very long lines are ChatGPT's compactly written SQL in `20261105000000_team_payments.sql` and `20261106000000_team_communications.sql`; it uses this app's own table and column names throughout, so it was written for this project. |
| **Images, video, reference material** | The only images in the repo are the 9D icons (made for this project). The LeagueApps reference screenshots and ChatGPT's report were kept out of the repo. |
| **Exercise library and starter programs** | Generic exercise names and our own written programs; no third-party video links. |
| **Fonts** | Manrope and Barlow Condensed (Google Fonts, SIL Open Font License; commercial use allowed). |
| **Commercial (`marketing/commercial`)** | Original animation code; music and sound effects synthesized in code (no samples). App screens are from the demo team (made-up people). |
| **Design references** | The Impeccable design guidance was read only; nothing from it was added. The Padmatch image was a mood reference; the app's design is its own. |

## Package licenses (everything that ships with the app)

81 packages: 77 MIT / Apache-2.0 / ISC / BSD / 0BSD / Unlicense / CC0-style, plus:

- `@img/sharp-libvips-*` (LGPL-3.0-or-later): image library used by Next.js, loaded as a separate unmodified library. Fine for the website; recheck when building the iPhone app.
- `web-push` (MPL-2.0): used unmodified. If it is ever modified, the modified files must stay open.
- One CC-BY-4.0 data package (browser-support data); attribution requirement only.

No GPL/AGPL code ships with the app.

## Recommendations

1. Keep "build features our own way" as the rule. Don't paste code, text, screenshots or API details from GameChanger or another app (including from a reverse-engineering session) into this project.
2. If a Codex/ChatGPT session produced notes from reverse-engineering GameChanger, keep them out of this repository.
3. Rerun this check before the App Store submission and before any fundraising (`git log`, the searches above, and `npm ls --omit=dev` license scan).
4. Before naming or trademark use, run a USPTO search for "9D".
