import { SectionTabs } from "@/components/layout/section-tabs";
import { requireModule } from "@/lib/modules";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { org, isStaff } = await requireModule("practices");
  return (
    <>
      {isStaff ? <SectionTabs section="schedule" modules={org.modules} /> : null}
      {children}
    </>
  );
}
