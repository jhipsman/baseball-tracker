import Link from "next/link";
import { requireActiveOrg } from "@/lib/org";
import { loadDirectory, recipientsFor } from "@/lib/messages";
import { NewThreadForm } from "./new-thread-form";

/** "New message" for any role: coaches pick anyone; players and parents pick a coach. */
export async function NewThreadPage({ base, to }: { base: string; to?: string | string[] }) {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  const dir = await loadDirectory(supabase, org.id);
  const recipients = recipientsFor(dir, user.id, isStaff);
  const ids = new Set(recipients.map((r) => r.id));
  const wanted = (Array.isArray(to) ? to : to ? [to] : []).filter((id) => ids.has(id));
  const staff = recipients.filter((r) => r.kind === "staff");
  const defaultSelected = wanted.length
    ? wanted
    : !isStaff && staff.length === 1
      ? [staff[0].id]
      : [];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div>
        <Link href={base} className="text-sm font-medium text-brand-700">
          ← Messages
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {isStaff ? "New message" : "Message a coach"}
        </h1>
      </div>
      <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
        <NewThreadForm
          recipients={recipients}
          groups={isStaff ? dir.groups : []}
          defaultSelected={defaultSelected}
          staffView={isStaff}
        />
      </div>
    </div>
  );
}
