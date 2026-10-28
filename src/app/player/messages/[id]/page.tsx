import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { ThreadPage } from "@/components/messages/thread-page";

export const metadata: Metadata = { title: "Conversation" };

export default async function PlayerThreadPage({ params }: PageProps<"/player/messages/[id]">) {
  const { id } = await params;
  const { isStaff } = await requireActiveOrg();
  if (isStaff) redirect(`/messages/${id}`);
  return <ThreadPage id={id} base="/player/messages" />;
}
