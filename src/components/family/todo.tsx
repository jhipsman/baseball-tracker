import Link from "next/link";
import { requireActiveOrg } from "@/lib/org";
import { loadFamilyTasks } from "@/lib/documents-data";
import { invoiceBalance, money } from "@/lib/team-payments";
import { hasModule } from "@/constants/modules";

type Item = { icon: string; title: string; sub?: string; href: string; urgent?: boolean };

const day = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/**
 * What a family needs to do, in one place at the top of their home: forms to
 * sign, the next payment, and an empty medical card. "All caught up" otherwise.
 */
export async function FamilyTodo({
  base,
  playerId,
  firstName,
  today,
  medicalHref,
}: {
  base: "/parent" | "/player";
  playerId: string;
  firstName: string;
  today: string;
  medicalHref: string;
}) {
  const { supabase, org, user } = await requireActiveOrg();
  const [{ todo }, { data: invoices }, medical] = await Promise.all([
    loadFamilyTasks(supabase, org.id, user.id, base === "/player" ? "player" : "parent"),
    supabase
      .from("team_invoices")
      .select("id, due_date, amount_cents, paid_cents, status")
      .eq("org_id", org.id)
      .eq("payer_id", user.id)
      .eq("status", "open")
      .order("due_date")
      .limit(50),
    hasModule(org.modules, "health")
      ? supabase
          .from("player_medical")
          .select("allergies, contacts")
          .eq("org_id", org.id)
          .eq("player_id", playerId)
          .maybeSingle()
          .then((r) => r.data ?? { allergies: null, contacts: [] })
      : Promise.resolve(null),
  ]);

  const items: Item[] = [];
  if (todo.length)
    items.push({
      icon: "✍️",
      title: `${todo.length} form${todo.length === 1 ? "" : "s"} to sign or send`,
      sub: todo
        .slice(0, 2)
        .map((t) => t.doc.title)
        .join(" · "),
      href: `${base}/documents`,
      urgent: true,
    });
  const unpaid = (invoices ?? []).filter((i) => invoiceBalance(i) > 0);
  if (unpaid.length) {
    const overdue = unpaid.filter((i) => i.due_date < today);
    const next = overdue[0] ?? unpaid[0];
    const amount = overdue.length
      ? overdue.reduce((s, i) => s + invoiceBalance(i), 0)
      : invoiceBalance(next);
    items.push({
      icon: "💵",
      title: overdue.length
        ? `${money(amount)} overdue`
        : `${money(amount)} due ${day(next.due_date)}`,
      sub: overdue.length ? "Team dues · pay or check with your coach" : "Team dues",
      href: "/payments",
      urgent: overdue.length > 0,
    });
  }
  const contacts = Array.isArray(medical?.contacts) ? medical.contacts : [];
  if (medical && contacts.length === 0)
    items.push({
      icon: "🩺",
      title: `Add ${firstName}'s emergency contact`,
      sub: "Plus allergies or medications coaches should know on game day",
      href: medicalHref,
    });

  if (!items.length)
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900 ring-1 ring-brand-200">
        <span aria-hidden>✓</span> You&apos;re all caught up. No forms, payments or info needed
        right now.
      </p>
    );
  return (
    <section aria-label="To do" className="rounded-2xl bg-surface p-2 ring-1 ring-zinc-200">
      <h2 className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        To do
      </h2>
      <ul>
        {items.map((it) => (
          <li key={it.title}>
            <Link
              href={it.href}
              className="flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 hover:bg-zinc-50"
            >
              <span aria-hidden className="text-xl">
                {it.icon}
              </span>
              <span className="min-w-0 flex-1">
                <b className={it.urgent ? "block text-amber-900" : "block"}>{it.title}</b>
                {it.sub ? (
                  <span className="block truncate text-sm text-zinc-500">{it.sub}</span>
                ) : null}
              </span>
              <span aria-hidden className="text-zinc-400">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
