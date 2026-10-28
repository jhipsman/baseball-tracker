import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { loadParentsOf } from "@/lib/parent";
import { siteOrigin } from "@/lib/site";
import { CopyButton } from "@/components/ui/copy-button";
import { ParentInviteForm } from "./parent-invite-form";
import { revokeMyParentInvite } from "./actions";

/** "Invite a parent or guardian" on the player's own profile. */
export async function ParentsCard({
  supabase,
  orgId,
  userId,
}: {
  supabase: SupabaseClient<Database>;
  orgId: string;
  userId: string;
}) {
  const [{ parents, pending }, origin] = await Promise.all([
    loadParentsOf(supabase, orgId, userId),
    siteOrigin(),
  ]);

  return (
    <section id="parents" className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <div>
        <h2 className="font-semibold">Invite a parent or guardian</h2>
        <p className="mt-1 text-sm text-zinc-600">
          They&apos;ll see your workouts, throwing, testing numbers, and reviewed videos. They
          can&apos;t change anything or see your teammates.
        </p>
      </div>

      {parents.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Following you
          </h3>
          <ul className="mt-1 divide-y divide-zinc-100">
            {parents.map((p) => (
              <li key={p.linkId} className="py-2 text-sm">
                <span className="font-medium">{p.name}</span>
                {p.email && p.email !== p.name ? (
                  <span className="ml-2 text-zinc-500">{p.email}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Pending invites
          </h3>
          <ul className="mt-1 divide-y divide-zinc-100">
            {pending.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{inv.email}</span>
                {inv.expired ? (
                  <span className="text-xs font-medium text-red-600">Expired</span>
                ) : (
                  <CopyButton value={`${origin}/invite/${inv.token}`} />
                )}
                {inv.invitedBy === userId ? (
                  <form action={revokeMyParentInvite}>
                    <input type="hidden" name="id" value={inv.id} />
                    <button
                      type="submit"
                      className="px-1 text-xs font-semibold text-zinc-500 hover:text-red-600"
                    >
                      Revoke
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-zinc-400">from coach</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-zinc-500">
            Send them the link. They sign up with that email, open it, and they&apos;re in.
          </p>
        </div>
      ) : null}

      <ParentInviteForm />
    </section>
  );
}
