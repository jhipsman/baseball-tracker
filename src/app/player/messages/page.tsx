import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { MemberInbox } from "@/components/messages/member-inbox";

export const metadata: Metadata = { title: "Messages" };

export default async function PlayerMessagesPage({ searchParams }: PageProps<"/player/messages">) {
  const { isStaff } = await requireActiveOrg();
  const { a } = await searchParams;
  const highlight = typeof a === "string" ? a : undefined;
  if (isStaff) redirect(highlight ? `/messages?a=${encodeURIComponent(highlight)}` : "/messages");
  return <MemberInbox base="/player/messages" highlight={highlight} />;
}
