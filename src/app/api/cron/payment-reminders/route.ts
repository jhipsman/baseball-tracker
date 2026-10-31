import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { paymentAdmin } from "@/lib/stripe-team";
import { dispatchPush } from "@/lib/push";

export const runtime = "nodejs";

/** Constant-time check of Vercel Cron's "Authorization: Bearer <CRON_SECRET>". */
function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header),
    b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Daily: remind families 3 days before, on the day, and 3 and 7 days after a payment is due. */
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization")))
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  try {
    const { data, error } = await paymentAdmin().rpc("send_payment_reminders");
    if (error) throw error;
    const push = await dispatchPush();
    return NextResponse.json({ reminders: data, push });
  } catch {
    return NextResponse.json({ error: "Reminders could not be sent." }, { status: 500 });
  }
}
