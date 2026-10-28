import type { Metadata } from "next";
import { requireActiveOrg } from "@/lib/org";
import { MemberInbox } from "@/components/messages/member-inbox";

export const metadata: Metadata = { title: "Messages" };

export default async function ParentMessagesPage({ searchParams }: PageProps<"/parent/messages">) {
  await requireActiveOrg();
  const { a } = await searchParams;
  return <MemberInbox base="/parent/messages" highlight={typeof a === "string" ? a : undefined} />;
}
