import type { Metadata } from "next";
import { BRAND } from "@/constants/brand";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  const n = BRAND.name;
  return (
    <LegalPage title="Terms of Service" updated="October 31, 2026">
      <p>
        These terms are between you and {BRAND.legalName}, the maker of {n}. By using {n} you agree
        to them.
      </p>

      <h2>Accounts</h2>
      <ul>
        <li>Give accurate information and keep your password private.</li>
        <li>Players under 13 need a parent&apos;s consent before using their own account.</li>
        <li>Team admins are responsible for who they invite and what their team shares.</li>
      </ul>

      <h2>Health information is not medical advice</h2>
      <p>
        Pitch counts, rest days, arm check-ins and return-to-throw checklists help coaches and
        families make decisions; they don&apos;t replace a doctor, athletic trainer or your own
        judgment. Pitch Smart guidance is from MLB and USA Baseball and may change.
      </p>

      <h2>Payments</h2>
      <ul>
        <li>
          Team fees are between the family and the team. Payments are processed by Stripe on the
          team&apos;s own Stripe account, under Stripe&apos;s terms.
        </li>
        <li>Refunds and payment plans are set by the team.</li>
        <li>
          Monthly autopay charges the same amount each month until the plan is paid or you stop it.
        </li>
      </ul>

      <h2>Your content</h2>
      <p>
        You own what you upload. You let us store and show it to the people your team allows, only
        to run {n}. Don&apos;t upload anything you don&apos;t have the right to share.
      </p>

      <h2>Acceptable use</h2>
      <p>
        No harassment, no sharing other people&apos;s private information, and no attempts to get
        around security or access other teams&apos; data.
      </p>

      <h2>Changes and ending</h2>
      <p>
        We may update {n} and these terms; we&apos;ll post changes here. You can stop using {n} any
        time. We may suspend accounts that break these terms.
      </p>

      <h2>Limits</h2>
      <p>
        {n} is provided as is. To the extent the law allows, {BRAND.legalName} isn&apos;t liable for
        indirect damages, and our total liability is limited to what you paid us in the last 12
        months.
      </p>
    </LegalPage>
  );
}
