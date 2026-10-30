import { SectionTabs } from "@/components/layout/section-tabs";
import { requireModule } from "@/lib/modules";

/** Hidden when the team turns this section off in Settings. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { org, isStaff } = await requireModule("health");
  return (
    <>
      {isStaff ? <SectionTabs section="health" modules={org.modules} /> : null}
      {children}
    </>
  );
}
