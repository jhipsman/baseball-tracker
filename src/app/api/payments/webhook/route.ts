import { NextResponse } from "next/server";
import { teamStripe } from "@/lib/stripe-team";
import { handleTeamPaymentEvent } from "@/lib/team-payment-webhook";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature"),
    secret = process.env.STRIPE_TEAM_WEBHOOK_SECRET;
  if (!signature || !secret)
    return NextResponse.json({ error: "Webhook unavailable." }, { status: 400 });
  const raw = await request.text();
  if (raw.length > 1_000_000) return new NextResponse(null, { status: 413 });
  let event;
  try {
    event = teamStripe().webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  try {
    await handleTeamPaymentEvent(event);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Payment update could not be applied. Retry required." },
      { status: 500 },
    );
  }
}
