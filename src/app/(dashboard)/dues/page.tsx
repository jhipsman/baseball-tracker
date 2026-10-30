import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { PaymentDashboard } from "@/components/payments/payment-dashboard";
export const metadata = { title: "Team payments" };
export default async function TeamDues() {
  const { membership } = await requireActiveOrg();
  if (membership.role !== "admin") redirect("/payments");
  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Team payments</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Installments, invoices, reminders, and payment history.
        </p>
      </header>
      <PaymentDashboard admin />
    </div>
  );
}
