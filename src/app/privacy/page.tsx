import type { Metadata } from "next";
import { BRAND } from "@/constants/brand";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const n = BRAND.name;
  return (
    <LegalPage title="Privacy Policy" updated="October 31, 2026">
      <p>
        {n} is made by {BRAND.legalName}. Teams use it to run a baseball season: schedules,
        training, player health, live scoring, messages and payments. Many of the people on a team
        are kids, so we collect only what a team needs and never sell it or use it for ads.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email and password (stored hashed by our login provider).</li>
        <li>
          Player details a team adds or a family enters at registration: birthdate, position, jersey
          number, emergency contact, and any medical notes the family chooses to share.
        </li>
        <li>
          Training and health: workouts, throwing and pitch counts, how an arm feels, and a
          coach&apos;s notes on availability and return to throw.
        </li>
        <li>Games and stats, practice plans, attendance, messages and announcements.</li>
        <li>Videos a player or coach uploads, and comments on them.</li>
        <li>
          Payments: what&apos;s owed and paid. Card and bank details go straight to Stripe; we never
          see or store them.
        </li>
        <li>Basic technical data needed to keep the service working and secure.</li>
      </ul>

      <h2>Who can see it</h2>
      <ul>
        <li>Team coaches and admins see their team&apos;s information.</li>
        <li>Players see their own; parents see their linked player&apos;s.</li>
        <li>Medical notes and payments are limited to team admins and that family.</li>
        <li>Teams can choose how much of the stats and health information players see.</li>
        <li>We don&apos;t share information between teams, and we don&apos;t sell it.</li>
      </ul>

      <h2>Children</h2>
      <p>
        Players under 13 need a parent&apos;s consent before using their own account. A parent or
        guardian can review, change or delete their child&apos;s information, or withdraw consent,
        at any time by contacting the team or us.
      </p>

      <h2>Service providers</h2>
      <p>
        We use a small number of providers to run {n}: Supabase (database and login), Vercel
        (hosting), Stripe (payments), and Anthropic (optional AI video feedback, only when a coach
        uses it). They process data only to provide their service to us.
      </p>

      <h2>Keeping and deleting</h2>
      <p>
        We keep information while the team uses {n}. You can delete your account from your profile;
        we remove your personal information, keeping only what we must for payment and legal
        records.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit, access is checked on every request by row-level security in
        the database, and secrets stay on our servers.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests: contact {BRAND.legalName} through your team or at the address we
        publish here before launch.
      </p>
    </LegalPage>
  );
}
