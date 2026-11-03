import { SectionTabs } from "@/components/layout/section-tabs";
import { requireStaffPay } from "@/lib/staff-data";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { org, isAdmin } = await requireStaffPay();
  return (
    <>
      <SectionTabs section="staff" modules={org.modules} isAdmin={isAdmin} />
      {children}
    </>
  );
}
