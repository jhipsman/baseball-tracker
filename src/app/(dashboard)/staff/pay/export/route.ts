import { NextResponse, type NextRequest } from "next/server";
import { requireActiveOrg } from "@/lib/org";
import { hasModule } from "@/constants/modules";
import { loadPayRange } from "@/lib/staff-data";
import { decimalHours, PAY_METHODS, PAY_TYPES, toCsv } from "@/lib/staff-pay";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dollars = (cents: number) => (cents / 100).toFixed(2);

/** Pay for a date range as CSV (for Gusto, QuickBooks, a spreadsheet). Admins only. */
export async function GET(req: NextRequest) {
  const ctx = await requireActiveOrg();
  if (ctx.preview || ctx.membership.role !== "admin" || !hasModule(ctx.org.modules, "staff"))
    return new NextResponse("Not allowed", { status: 403 });
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to)) return new NextResponse("Bad dates", { status: 400 });
  const paid = req.nextUrl.searchParams.get("paid") === "1";

  const data = await loadPayRange({ ...ctx, isAdmin: true }, from, to);
  const who = new Map([...data.staff, ...data.people].map((p) => [p.id, p]));
  const type = (id: string) =>
    PAY_TYPES.find((p) => p.key === data.rates.get(id)?.pay_type)?.label ?? "";

  const rows: (string | number)[][] = paid
    ? [
        ["Name", "Email", "Pay type", "Hours", "Amount", "Paid with", "Reference", "Paid on"],
        ...data.paidRows.map((p) => [
          who.get(p.profile_id)?.name ?? "Former staff",
          who.get(p.profile_id)?.email ?? "",
          type(p.profile_id),
          decimalHours(data.paidMinutes.get(p.profile_id) ?? 0),
          dollars(p.amount_cents),
          PAY_METHODS.find((m) => m.key === p.method)?.label ?? p.method,
          p.reference ?? "",
          p.paid_at.slice(0, 10),
        ]),
      ]
    : [
        [
          "Name",
          "Email",
          "Pay type",
          "Hours",
          "Sessions",
          "Approved time",
          "Stipend",
          "Total to pay",
          "Not approved yet",
        ],
        ...data.totals
          .filter((t) => t.payCents > 0 || t.minutes > 0)
          .map((t) => [
            who.get(t.profileId)?.name ?? "Former staff",
            who.get(t.profileId)?.email ?? "",
            type(t.profileId),
            decimalHours(t.minutes),
            t.sessions,
            dollars(t.approvedCents),
            dollars(t.stipendCents),
            dollars(t.payCents),
            dollars(t.pendingCents),
          ]),
      ];
  return new NextResponse(toCsv(rows) + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="staff-pay-${from}-to-${to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
