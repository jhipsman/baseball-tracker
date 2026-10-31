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
    const db = paymentAdmin();
    const { data, error } = await db.rpc("send_payment_reminders");
    if (error) throw error;
    // Free trials: tell team admins 7 days and 1 day before the end.
    const { data: trials, error: trialError } = await db.rpc("send_trial_reminders");
    if (trialError) throw trialError;
    const push = await dispatchPush();
    return NextResponse.json({ reminders: data, trials, push });
  } catch {
    return NextResponse.json({ error: "Reminders could not be sent." }, { status: 500 });
  }
}
