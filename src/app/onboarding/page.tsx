import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMemberships, requireUser } from "@/lib/org";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/constants";
import { SubmitButton } from "@/components/ui/submit-button";
import { acceptInvitation } from "@/app/invite/[token]/actions";
import { CreateOrgForm } from "./create-org-form";

export const metadata: Metadata = { title: "Create your organization" };

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const memberships = await getMemberships();
  if (memberships.length > 0) redirect("/");
  const { data: invitations } = await supabase.rpc("my_pending_invitations");

  const invited = Boolean(invitations && invitations.length > 0);

  const createOrg = (
    <>
      <p className="mt-1 mb-6 text-sm text-zinc-600">
        Your team, school, or facility. Everything you build lives inside it, and you&apos;ll be its
        admin.
      </p>
      <CreateOrgForm />
    </>
  );

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      {invited ? (
        <div className="mb-6 w-full max-w-md rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-brand-500 sm:p-8">
          <h1 className="text-xl font-semibold">You&apos;ve been invited</h1>
          <p className="mt-1 text-sm text-zinc-600">Join your team to get started.</p>
          <ul className="mt-4 space-y-3">
            {invitations!.map((inv) => (
              <li key={inv.token}>
                <form action={acceptInvitation} className="flex items-center gap-3">
                  <input type="hidden" name="token" value={inv.token} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{inv.org_name}</p>
                    <p className="text-sm text-zinc-500">
                      {inv.role === "parent" ? "Parent / guardian" : ROLE_LABELS[inv.role]}
                    </p>
                  </div>
                  <SubmitButton pendingLabel="Joining…">Join</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-zinc-200 sm:p-8">
        {invited ? (
          // Invitees almost never want a new organization: keep it one tap away, not in the way.
          <details>
            <summary className="cursor-pointer font-semibold text-zinc-800">
              Starting a new team instead?
            </summary>
            <div className="mt-4">
              <h2 className="text-lg font-semibold">Set up your organization</h2>
              {createOrg}
            </div>
          </details>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Set up your organization</h1>
            {createOrg}
          </>
        )}
        <div className="mt-6 border-t border-zinc-200 pt-4 text-sm text-zinc-600">
          <p>
            {invited ? "Expecting a different team?" : "Joining an existing team?"} Ask your coach
            to invite <strong className="break-all">{user.email}</strong>.
          </p>
          <form action={signOut} className="mt-2">
            <button
              type="submit"
              className="-ml-2 inline-flex h-11 items-center rounded-lg px-2 font-semibold text-brand-700 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
