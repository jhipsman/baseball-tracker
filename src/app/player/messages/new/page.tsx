import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { NewThreadPage } from "@/components/messages/new-thread-page";

export const metadata: Metadata = { title: "Message a coach" };

export default async function PlayerNewMessagePage({
  searchParams,
}: PageProps<"/player/messages/new">) {
  const { isStaff } = await requireActiveOrg();
  if (isStaff) redirect("/messages/new");
  const { to } = await searchParams;
  return <NewThreadPage base="/player/messages" to={to} />;
}
