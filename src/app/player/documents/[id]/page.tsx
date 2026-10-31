import type { Metadata } from "next";
import { FormPage } from "@/components/documents/family";

export const metadata: Metadata = { title: "Team form" };

export default async function Page({ params }: PageProps<"/player/documents/[id]">) {
  return <FormPage base="/player" id={(await params).id} />;
}
