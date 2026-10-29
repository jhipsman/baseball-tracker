import { PageSkeleton } from "@/components/layout/page-skeleton";
export default function Loading() {
  return (
    <div className="mx-auto w-full px-4 py-6 md:px-8">
      <PageSkeleton />
    </div>
  );
}
