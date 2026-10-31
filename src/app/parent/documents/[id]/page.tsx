import type { Metadata } from "next";
import { FormPage } from "@/components/documents/family";

export const metadata: Metadata = { title: "Team form" };

export default async function Page({ params, searchParams }: PageProps<"/parent/documents/[id]">) {
  const { id } = await params;
  const { for: forId } = await searchParams;
  return <FormPage base="/parent" id={id} forId={typeof forId === "string" ? forId : undefined} />;
}
