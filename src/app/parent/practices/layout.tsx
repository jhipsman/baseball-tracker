import { requireModule } from "@/lib/modules";

/** Hidden when the team turns this section off in Settings. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModule("practices");
  return children;
}
