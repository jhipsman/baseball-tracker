import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { NewThreadPage } from "@/components/messages/new-thread-page";

export const metadata: Metadata = { title: "New message" };

export default async function CoachNewMessagePage({ searchParams }: PageProps<"/messages/new">) {
  const { isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player/messages/new");
  const { to } = await searchParams;
  return <NewThreadPage base="/messages" to={to} />;
}
