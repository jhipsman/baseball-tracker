import { SectionTabs } from "@/components/layout/section-tabs";
import { requireActiveOrg } from "@/lib/org";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { org, membership } = await requireActiveOrg();
  return (
    <>
      <SectionTabs section="team" modules={org.modules} isAdmin={membership.role === "admin"} />
      {children}
    </>
  );
}
