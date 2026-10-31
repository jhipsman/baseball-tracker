import type { Metadata } from "next";
import { pickChild, requireParent } from "@/lib/parent";
import { MedicalCardEditor } from "@/components/health/medical-page";
import { ChildSwitcher, NoLinkedPlayer } from "../parent-ui";

export const metadata: Metadata = { title: "Medical card" };

export default async function ParentMedicalPage({ searchParams }: PageProps<"/parent/medical">) {
  const sp = await searchParams;
  const { supabase, org, children: kids } = await requireParent();
  const child = pickChild(kids, sp.player);
  if (!child) return <NoLinkedPlayer />;
  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
          {child.firstName}&apos;s medical card
        </h1>
        <ChildSwitcher kids={kids} selected={child} basePath="/parent/medical" />
      </div>
      <MedicalCardEditor
        key={child.id}
        supabase={supabase}
        orgId={org.id}
        playerId={child.id}
        firstName={child.firstName}
        self={false}
      />
    </div>
  );
}
