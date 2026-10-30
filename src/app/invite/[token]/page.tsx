import type { Metadata } from "next";
import { LogoMark } from "@/components/brand/logo";
import Link from "next/link";
import { requireUser } from "@/lib/org";
import { ROLE_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { acceptInvitation, switchAccountForInvite } from "./actions";

export const metadata: Metadata = { title: "Invitation" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Next step for an invite that can't be used: go to the app (which routes to the right home). */
function ContinueLink() {
  return (
    <Link
      href="/"
      className="flex h-11 w-full items-center justify-center rounded-lg bg-surface px-4 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50"
    >
      Continue to Diamond Program
    </Link>
  );
}

export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const { error } = await searchParams;
  const { supabase, user } = await requireUser();

  const { data } = UUID.test(token)
    ? await supabase.rpc("get_invitation", { p_token: token })
    : { data: [] };
  const invite = data?.[0];

  let title: string;
  let body: React.ReactNode;
  if (!invite) {
    title = "This link doesn't work";
    body = (
      <div className="space-y-4 text-sm text-zinc-600">
        <p>
          The invitation link isn&apos;t valid. It may have been copied only partly. Ask your coach
          to send it again.
        </p>
        <ContinueLink />
      </div>
    );
  } else if (invite.is_accepted) {
    title = "Invitation already accepted";
    body = (
      <div className="space-y-4 text-sm text-zinc-600">
        <p>
          This invitation to <strong>{invite.org_name}</strong> has already been used. If it was
          you, you&apos;re all set.
        </p>
        <ContinueLink />
      </div>
    );
  } else if (invite.is_expired) {
    title = "Invitation expired";
    body = (
      <div className="space-y-4 text-sm text-zinc-600">
        <p>
          This invitation to <strong>{invite.org_name}</strong> has expired. Ask your coach to send
          you a new one.
        </p>
        <ContinueLink />
      </div>
    );
  } else if (!invite.email_matches) {
    title = "Use the invited email";
    body = (
      <form action={switchAccountForInvite} className="space-y-4 text-sm text-zinc-600">
        <input type="hidden" name="token" value={token} />
        <p>
          This invitation was sent to <strong className="break-all">{invite.email}</strong>, but
          you&apos;re signed in as <strong className="break-all">{user.email}</strong>.
        </p>
        <p>Sign out, then sign in or create an account with the invited email.</p>
        <Button type="submit" variant="secondary" className="w-full">
          Sign out and switch accounts
        </Button>
      </form>
    );
  } else {
    title =
      invite.role === "parent"
        ? `Follow ${invite.player_name ?? "your player"}`
        : `Join ${invite.org_name}`;
    body = (
      <form action={acceptInvitation} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        {invite.role === "parent" ? (
          <div className="space-y-3 text-sm text-zinc-600">
            <p>
              You&apos;re invited to follow <strong>{invite.player_name ?? "your player"}</strong>{" "}
              on <strong>{invite.org_name}</strong> as a parent or guardian.
            </p>
            <p>
              You&apos;ll see their schedule, how they&apos;re doing, and updates from the coach.
            </p>
            <p className="text-xs text-zinc-500">
              🔒 You only see your own player. Teammates&apos; information stays private.
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">
            You&apos;ve been invited to join <strong>{invite.org_name}</strong> as a{" "}
            <strong>{ROLE_LABELS[invite.role].toLowerCase()}</strong>.
          </p>
        )}
        {typeof error === "string" ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <SubmitButton className="w-full" pendingLabel="Joining…">
          Accept invitation
        </SubmitButton>
      </form>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <p className="mb-8 flex items-center gap-2 text-lg font-bold tracking-tight">
        <LogoMark className="size-8 text-brand-600" />
        Diamond Program
      </p>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-zinc-200 sm:p-8">
        <h1 className="mb-4 text-xl font-semibold">{title}</h1>
        {body}
      </div>
    </main>
  );
}
