import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { PaymentDashboard } from "@/components/payments/payment-dashboard";
export const metadata = { title: "Your team payments" };
export default async function Payments({ searchParams }: PageProps<"/payments">) {
  const { membership, org } = await requireActiveOrg();
  const { registered } = await searchParams;
  if (membership.role === "admin") redirect("/dues");
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link
        href={
          membership.role === "parent"
            ? "/parent"
            : membership.role === "player"
              ? "/player/profile"
              : "/"
        }
        className="text-sm text-brand-700"
      >
        ← Back to your team
      </Link>
      <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Your team payments</h1>
      {registered ? (
        <p
          role="status"
          className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900 ring-1 ring-brand-200"
        >
          <strong>✓ Registered with {org.name}.</strong> Your balance is below. Pay now, or come
          back any time from your team page.
        </p>
      ) : null}
      <PaymentDashboard admin={false} />
    </main>
  );
}
