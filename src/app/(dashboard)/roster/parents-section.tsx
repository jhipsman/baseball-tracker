import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { loadParentsOf } from "@/lib/parent";
import { siteOrigin } from "@/lib/site";
import { CopyButton } from "@/components/ui/copy-button";
import { ParentInviteForm } from "./invite-form";
import { revokeInvitation, unlinkParent } from "./actions";

/** "Parents & guardians" on a coach's player profile: linked parents, pending invites, invite. */
export async function ParentsSection({
  supabase,
  orgId,
  playerId,
}: {
  supabase: SupabaseClient<Database>;
  orgId: string;
  playerId: string;
}) {
  const [{ parents, pending }, origin] = await Promise.all([
    loadParentsOf(supabase, orgId, playerId),
    siteOrigin(),
  ]);

  return (
    <section id="parents" className="space-y-3">
      <h2 className="text-lg font-semibold">Parents &amp; guardians</h2>
      <div className="space-y-4 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
        {parents.length === 0 && pending.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No parents linked yet. Parents get a read-only view of this player only.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {parents.map((p) => (
              <li key={p.linkId} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{p.name}</span>
                  {p.email && p.email !== p.name ? (
                    <span className="ml-2 text-zinc-500">{p.email}</span>
                  ) : null}
                </span>
                <span className="text-xs text-zinc-500">Linked</span>
                <form action={unlinkParent}>
                  <input type="hidden" name="id" value={p.linkId} />
                  <button
                    type="submit"
                    className="text-xs font-semibold text-zinc-500 hover:text-red-600"
                  >
                    Unlink
                  </button>
                </form>
              </li>
            ))}
            {pending.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{inv.email}</span>
                {inv.expired ? (
                  <span className="text-xs font-medium text-red-600">Expired</span>
                ) : (
                  <>
                    <span className="text-xs text-zinc-500">Invited</span>
                    <CopyButton value={`${origin}/invite/${inv.token}`} />
                  </>
                )}
                <form action={revokeInvitation}>
                  <input type="hidden" name="id" value={inv.id} />
                  <button
                    type="submit"
                    className="text-xs font-semibold text-zinc-500 hover:text-red-600"
                  >
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <ParentInviteForm playerId={playerId} />
      </div>
    </section>
  );
}
