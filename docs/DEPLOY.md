# Deploying Diamond Program

This puts the app on the internet so anyone (coaches, players, parents) can reach it from any device:

- **Supabase** (hosted) runs the database and logins.
- **Vercel** runs the website and redeploys automatically every time code is pushed to GitHub.

Both have free tiers that are plenty to start. Budget about 20–30 minutes the first time.

---

## 1. Create the Supabase project

1. Sign up at <https://supabase.com> (signing in with GitHub is easiest).
2. Click **New project**. Pick a name (e.g. `diamond-program`), set a **database password** and save it in a password manager, and choose the region closest to your team. Wait about 2 minutes for it to finish.
3. Open **Project Settings → General** and copy the **Project ID** (looks like `abcdxyzabcdxyzabcd`).

## 2. Load the database (from your Windows PC)

In Command Prompt:

```
cd C:\Users\jhips\baseball-tracker
git pull
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_ID
npx supabase db push --include-seed
```

- `login` opens a browser to approve the CLI.
- `link` asks for the database password from step 1.
- `db push --include-seed` creates every table and security rule, then loads the 130-exercise library. Answer `Y` when it lists the migrations.

**Database updates after this are automatic.** A GitHub Action (`.github/workflows/supabase-migrations.yml`) applies new migrations to this project whenever they're pushed. It needs three secrets, added once, all from a browser:

1. **Supabase access token:** <https://supabase.com/dashboard/account/tokens> → **Generate new token** (name it `github-actions`) → copy it.
2. **GitHub:** open the `baseball-tracker` repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_ACCESS_TOKEN` | the token from step 1 |
   | `SUPABASE_PROJECT_ID` | Project ID from step 1.3 above |
   | `SUPABASE_DB_PASSWORD` | the database password from step 1.2 (forgot it? Supabase → **Project Settings → Database → Reset database password**) |

3. **Run it once now:** GitHub → **Actions** tab → **Deploy database migrations** → **Run workflow**. A green check means the database is up to date. After that it runs by itself.

If a run fails, open it on the Actions tab; the log says which step failed. To run it by hand from a PC instead, use `git pull` then `npx supabase db push`.

Leave off `--include-seed` from now on, although re-running it is harmless.

## 3. Deploy to Vercel

1. Sign up at <https://vercel.com> with your GitHub account.
2. Click **Add New… → Project**, then **Import** the `baseball-tracker` repository. If it isn't listed, click **Adjust GitHub App Permissions** and allow access to it.
3. Leave the framework (Next.js) and build settings as they are. Open **Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → **Project Settings → API** (or the **Connect** button) → Project URL, e.g. `https://abcd….supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → the **Publishable** key (`sb_publishable_…`). Older projects call it the `anon` key. **Never** use the secret/service_role key here. |

4. Click **Deploy**. When it finishes you'll get a URL like `https://baseball-tracker-xyz.vercel.app`.
5. In Vercel, open **Settings → Environment Variables** and add `NEXT_PUBLIC_SITE_URL` set to that URL (no trailing slash). Then go to **Deployments → ⋯ → Redeploy**. Email and invite links use this address.

## 4. Point Supabase logins at your site

In Supabase:

1. **Authentication → URL Configuration**
   - **Site URL:** your Vercel URL, e.g. `https://baseball-tracker-xyz.vercel.app`
   - **Redirect URLs → Add URL:** `https://baseball-tracker-xyz.vercel.app/**`
2. **Authentication → Emails → Templates → Confirm signup.** Replace the template body with the following, so the confirmation link works even when it's opened on a different phone or browser than the one used to sign up:

   ```html
   <h2>Confirm your email</h2>
   <p>Welcome to Diamond Program. Tap below to confirm your email and get started.</p>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm my email</a></p>
   ```

   Click **Save**.
3. Still under **Templates**, open **Reset password** and replace its body the same way, so "Forgot password?" links work on any device:

   ```html
   <h2>Reset your password</h2>
   <p>Tap below to choose a new password for Diamond Program.</p>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Choose a new password</a></p>
   ```

   Click **Save**.

Leave **Confirm email** turned on. Invitations only work for a verified email address, so turning it off would let someone sign up with a coach's or player's address and claim their invite.

## 5. Try it

1. Open your Vercel URL, sign up, confirm the email, and create your organization.
2. **Roster → Invite** a second email you own as a player, open the invite link on your phone, and accept it.
3. Build a short program, assign it to that player, and log a workout from the phone.
4. On the phone, use **Share → Add to Home Screen** (iPhone) or **⋮ → Install app** (Android) to get an app icon.

---

## Good to know

- **Email limits:** Supabase's built-in email sender only allows a few emails per hour, which is fine for testing. Before inviting a whole team, connect a real email service under **Project Settings → Authentication → SMTP Settings**. [Resend](https://resend.com) has a free tier and a Supabase guide.
- **Updates:** every `git push` to the repo's default branch redeploys the site automatically. Pushes to other branches get their own preview URLs.
- **Custom domain:** in Vercel, **Settings → Domains** (e.g. `train.yourteam.com`). After adding one, update `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL and Redirect URLs to match.
- **Local development is unchanged:** `npm run db:start` and `npm run dev` still use the local database. The hosted one is only touched by `npx supabase db push`.
