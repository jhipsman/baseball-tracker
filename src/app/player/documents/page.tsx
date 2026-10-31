import type { Metadata } from "next";
import { FormsList } from "@/components/documents/family";

export const metadata: Metadata = { title: "Team forms" };

export default function Page() {
  return <FormsList base="/player" />;
}
