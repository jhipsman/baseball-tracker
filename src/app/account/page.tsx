import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/org";
import { DeleteAccountForm } from "./delete-account-form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const { user } = await requireUser();
  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-brand-700">
        ← Back to your team
      </Link>
      <div>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Account</h1>
        <p className="mt-1 truncate text-sm text-zinc-600">{user.email}</p>
      </div>
      <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
        <h2 className="font-semibold">Delete my account</h2>
        <p className="text-sm text-zinc-600">
          This removes your login, your profile and what you logged, on every team you belong to. It
          can&apos;t be undone. Payment and legal records we must keep stay on file.
        </p>
        <p className="text-sm text-zinc-600">
          If you own a team, delete the team first or ask us to move it to someone else.
        </p>
        <DeleteAccountForm />
      </section>
    </main>
  );
}
