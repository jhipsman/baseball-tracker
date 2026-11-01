import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/constants/brand";
import { adminClient } from "@/lib/supabase/admin";
import { ClaimForm } from "./claim-form";

export const metadata: Metadata = { title: "Set up your account" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A coach added this player without an email and is now giving them a login:
 * they set a password on the account that already holds their team history.
 */
export default async function ClaimPage({ params }: PageProps<"/claim/[token]">) {
  const { token } = await params;
  const admin = adminClient();
  const { data: inv } =
    admin && UUID.test(token)
      ? await admin
          .from("org_invitations")
          .select(
            "email, accepted_at, expires_at, claim_profile_id, org:organizations (name), player:profiles!org_invitations_claim_profile_id_fkey (full_name)",
          )
          .eq("token", token)
          .not("claim_profile_id", "is", null)
          .maybeSingle()
      : { data: null };

  let title = "Set up your account";
  let body: React.ReactNode;
  if (!inv) {
    title = "This link doesn't work";
    body = <p className="text-sm text-zinc-600">Ask your coach to send it again.</p>;
  } else if (inv.accepted_at) {
    title = "You're all set";
    body = (
      <p className="text-sm text-zinc-600">
        This account is already set up.{" "}
        <Link href="/login" className="font-semibold text-brand-700">
          Sign in
        </Link>
      </p>
    );
  } else if (new Date(inv.expires_at) < new Date()) {
    title = "This link has expired";
    body = <p className="text-sm text-zinc-600">Ask your coach to send a new one.</p>;
  } else {
    const first = inv.player?.full_name?.split(" ")[0];
    body = (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">
          {first ? `${first}, your` : "Your"} coach added you to <strong>{inv.org?.name}</strong> on{" "}
          {BRAND.name}. Choose a password to see your schedule, workouts and stats. Everything
          already on your profile stays.
        </p>
        <ClaimForm token={token} email={inv.email} />
      </div>
    );
  }
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <p className="mb-8 text-2xl">
        <Logo markClassName="size-10" />
      </p>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-zinc-200 sm:p-8">
        <h1 className="mb-4 text-xl font-semibold">{title}</h1>
        {body}
      </div>
    </main>
  );
}
