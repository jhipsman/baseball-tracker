import type { Metadata } from "next";
import { NewThreadPage } from "@/components/messages/new-thread-page";

export const metadata: Metadata = { title: "Message a coach" };

export default async function ParentNewMessagePage({
  searchParams,
}: PageProps<"/parent/messages/new">) {
  const { to } = await searchParams;
  return <NewThreadPage base="/parent/messages" to={to} />;
}
