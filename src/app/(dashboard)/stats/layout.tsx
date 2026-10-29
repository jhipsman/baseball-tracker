import { SectionTabs } from "@/components/layout/section-tabs";
import { requireModule } from "@/lib/modules";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { org, isStaff } = await requireModule("games");
  return (
    <>
      {isStaff ? <SectionTabs section="team" modules={org.modules} /> : null}
      {children}
    </>
  );
}
