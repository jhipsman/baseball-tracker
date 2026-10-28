import type { Metadata } from "next";
import { ThreadPage } from "@/components/messages/thread-page";

export const metadata: Metadata = { title: "Conversation" };

export default async function ParentThreadPage({ params }: PageProps<"/parent/messages/[id]">) {
  const { id } = await params;
  return <ThreadPage id={id} base="/parent/messages" />;
}
