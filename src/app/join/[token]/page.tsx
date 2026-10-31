import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/constants/brand";
import { Logo } from "@/components/brand/logo";
import { createClient } from "@/lib/supabase/server";
import { formatGameDate } from "@/lib/games";
import { money } from "@/lib/team-payments";
import { JoinForm } from "@/components/registration/join-form";

export const metadata: Metadata = { title: "Register" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <p className="mb-6 text-xl">
        <Logo markClassName="size-8" />
      </p>
      {children}
      <p className="mt-10 text-center text-xs text-zinc-500">
        {BRAND.legalName} ·{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>
      </p>
    </main>
  );
}

export default async function JoinPage({ params, searchParams }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const { done } = await searchParams;
  const supabase = await createClient();
  const { data } = UUID.test(token)
    ? await supabase.rpc("get_registration_form", { p_token: token })
    : { data: [] };
  const form = data?.[0];
  const { data: claims } = await supabase.auth.getClaims();
  const signedIn = !!claims?.claims?.sub;

  if (!form) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">This link doesn&apos;t work</h1>
        <p className="mt-2 text-zinc-600">
          It may have been copied only partly. Ask your coach to send it again.
        </p>
      </Shell>
    );
  }

  const mine = signedIn
    ? ((
        await supabase
          .from("team_registrations")
          .select("player_name, status")
          .eq("form_id", form.form_id)
          .eq("submitted_by", claims!.claims.sub)
      ).data ?? [])
    : [];
  const registered = mine.filter((r) => r.status === "registered");
  const full = form.spots_left === 0;
  const fee = form.fee_cents
    ? form.installments_max > 1
      ? `${money(form.fee_cents)}, in full or up to ${form.installments_max} monthly payments`
      : money(form.fee_cents)
    : "Free";
  const next = `/join/${token}`;

  return (
    <Shell>
      <header className="space-y-1">
        <p className="text-sm font-semibold text-brand-700">{form.team_name}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{form.title}</h1>
        <p className="text-zinc-600">
          {form.season} · {fee}
          {form.first_due ? ` · first payment ${formatGameDate(form.first_due)}` : ""}
          {form.spots_left != null && form.spots_left > 0
            ? ` · ${form.spots_left} spot${form.spots_left === 1 ? "" : "s"} left`
            : ""}
        </p>
      </header>

      <div className="mt-6 space-y-4">
        {done || registered.length ? (
          <section
            role="status"
            className="rounded-2xl bg-brand-50 p-4 text-brand-900 ring-1 ring-brand-200"
          >
            <p className="font-semibold">
              ✓ You&apos;re registered: {registered.map((r) => r.player_name).join(", ")}
            </p>
            <p className="mt-1 text-sm">
              You&apos;re on the team in {BRAND.name}: schedule, messages and game updates are in
              the app.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={form.fee_cents ? "/payments" : "/"}
                className="inline-flex h-11 items-center rounded-full bg-brand-700 px-5 text-sm font-semibold text-on-brand"
              >
                {form.fee_cents ? "Go to payments" : `Open ${BRAND.name}`}
              </Link>
            </div>
          </section>
        ) : null}

        {!form.open || full ? (
          <p className="rounded-2xl bg-surface p-4 text-zinc-700 ring-1 ring-zinc-200">
            {full ? "Registration is full." : "Registration is closed."} Contact the team if you
            have questions.
          </p>
        ) : !signedIn ? (
          <section className="space-y-3 rounded-2xl bg-surface p-5 ring-1 ring-zinc-200">
            <h2 className="text-lg font-semibold">Register your player</h2>
            <p className="text-sm text-zinc-600">
              Takes about 3 minutes. You&apos;ll make a free {BRAND.name} account so you can see the
              schedule, get game updates and manage payments.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/signup?next=${encodeURIComponent(next)}`}
                className="inline-flex h-12 items-center justify-center rounded-full bg-brand-700 px-6 font-semibold text-on-brand"
              >
                Create account and register
              </Link>
              <Link
                href={`/login?next=${encodeURIComponent(next)}`}
                className="inline-flex h-12 items-center justify-center rounded-full px-6 font-semibold text-zinc-800 ring-1 ring-zinc-300"
              >
                I have an account
              </Link>
            </div>
          </section>
        ) : (
          <>
            {registered.length ? (
              <h2 className="pt-2 text-lg font-semibold">Register another player</h2>
            ) : null}
            <JoinForm
              token={token}
              feeCents={form.fee_cents}
              installmentsMax={form.installments_max}
              waiver={form.waiver_text}
              defaultParentName={String(claims?.claims?.user_metadata?.full_name ?? "")}
            />
          </>
        )}
      </div>
    </Shell>
  );
}
