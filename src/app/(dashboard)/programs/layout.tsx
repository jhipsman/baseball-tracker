import { SectionTabs } from "@/components/layout/section-tabs";
import { requireActiveOrg } from "@/lib/org";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { org, isStaff } = await requireActiveOrg();
  return (
    <>
      {isStaff ? <SectionTabs section="training" modules={org.modules} /> : null}
      {children}
    </>
  );
}
