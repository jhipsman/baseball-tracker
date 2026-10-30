import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { PaymentDashboard } from "@/components/payments/payment-dashboard";
export const metadata = { title: "Your team payments" };
export default async function Payments() {
  const { membership } = await requireActiveOrg();
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
      <PaymentDashboard admin={false} />
    </main>
  );
}
