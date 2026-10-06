import type { Metadata } from "next";
import { requireUser } from "@/lib/org";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/constants";
import { SubmitButton } from "@/components/ui/submit-button";
import { acceptInvitation } from "./actions";

export const metadata: Metadata = { title: "Invitation" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const { error } = await searchParams;
  const { supabase, user } = await requireUser();

  const { data } = UUID.test(token)
    ? await supabase.rpc("get_invitation", { p_token: token })
    : { data: [] };
  const invite = data?.[0];

  let body: React.ReactNode;
  if (!invite) {
    body = <p className="text-sm text-zinc-600">This invitation link isn&apos;t valid.</p>;
  } else if (invite.is_accepted) {
    body = <p className="text-sm text-zinc-600">This invitation has already been used.</p>;
  } else if (invite.is_expired) {
    body = (
      <p className="text-sm text-zinc-600">
        This invitation has expired. Ask {invite.org_name}&apos;s admin to send a new one.
      </p>
    );
  } else if (!invite.email_matches) {
    body = (
      <div className="space-y-3 text-sm text-zinc-600">
        <p>
          This invitation was sent to <strong>{invite.email}</strong>, but you&apos;re signed in as{" "}
          <strong>{user.email}</strong>.
        </p>
        <form action={signOut}>
          <button type="submit" className="font-semibold text-brand-700 hover:underline">
            Sign out and switch accounts
          </button>
        </form>
      </div>
    );
  } else {
    body = (
      <form action={acceptInvitation} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <p className="text-sm text-zinc-600">
          You&apos;ve been invited to join <strong>{invite.org_name}</strong> as a{" "}
          <strong>{ROLE_LABELS[invite.role].toLowerCase()}</strong>.
        </p>
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
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 sm:p-8">
        <h1 className="mb-4 text-xl font-semibold">
          {invite ? `Join ${invite.org_name}` : "Invitation"}
        </h1>
        {body}
      </div>
    </main>
  );
}
