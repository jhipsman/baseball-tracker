import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { homeFor, kindsForRole } from "@/lib/notifications";
import { markAllNotificationsRead } from "@/lib/notification-actions";
import { formatWhen } from "@/components/messages/format";
import { PushSettings } from "@/components/notifications/push-settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { supabase, user, membership, org } = await requireActiveOrg();
  const { tz: rawTz } = await playerToday();
  const tz = rawTz ? decodeURIComponent(rawTz) : undefined;
  const home = homeFor(membership.role);

  const [{ data: items }, { data: profile }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, title, body, created_at, read_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("profiles").select("push_muted").eq("id", user.id).single(),
  ]);
  const list = items ?? [];
  const unread = list.filter((n) => !n.read_at).length;
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          <Link
            href={home}
            className="-ml-2 inline-flex h-10 items-center rounded-lg px-2 text-sm font-medium text-brand-700 hover:bg-zinc-100"
          >
            ← Back
          </Link>
          <span className="truncate text-sm font-semibold">{org.name}</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-4 py-5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Notifications</h1>
          {unread ? (
            <form action={markAllNotificationsRead} className="ml-auto">
              <button
                type="submit"
                className="h-9 rounded-lg bg-surface px-3 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-50"
              >
                Mark all read
              </button>
            </form>
          ) : null}
        </div>

        {list.length ? (
          <ul
            aria-label="Notifications"
            className="divide-y divide-zinc-100 overflow-hidden rounded-xl bg-surface ring-1 ring-zinc-200"
          >
            {list.map((n) => (
              <li key={n.id}>
                {/* Plain <a>: /n/[id] marks the notification read, so it must not be prefetched. */}
                <a
                  href={`/n/${n.id}`}
                  data-unread={!n.read_at || undefined}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 hover:bg-zinc-50",
                    !n.read_at && "bg-brand-50/60",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2.5 shrink-0 rounded-full",
                      n.read_at ? "bg-transparent" : "bg-brand-600",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          "min-w-0 flex-1 text-sm break-words",
                          n.read_at ? "text-zinc-700" : "font-semibold text-zinc-900",
                        )}
                      >
                        {n.title}
                        {n.read_at ? null : <span className="sr-only"> (unread)</span>}
                      </span>
                      <time dateTime={n.created_at} className="shrink-0 text-xs text-zinc-500">
                        {formatWhen(n.created_at, tz)}
                      </time>
                    </span>
                    {n.body ? (
                      <span className="mt-0.5 line-clamp-2 block text-sm break-words text-zinc-500">
                        {n.body}
                      </span>
                    ) : null}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-surface p-4 text-sm text-zinc-500 ring-1 ring-zinc-200">
            You&apos;re all caught up. Announcements, messages, and updates from your team show up
            here.
          </p>
        )}

        <section className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-zinc-200">
          <h2 className="font-semibold">Phone notifications</h2>
          {vapidKey ? (
            <PushSettings
              vapidKey={vapidKey}
              kinds={kindsForRole(membership.role).map((k) => ({ key: k.key, label: k.label }))}
              muted={profile?.push_muted ?? []}
            />
          ) : (
            <p className="text-sm text-zinc-500">
              Phone notifications aren&apos;t set up for this site yet. You&apos;ll still see
              everything here and on the bell.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
