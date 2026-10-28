import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home" };

// Placeholder: the parent dashboard is built in Phase 7 (parent track).
export default function ParentHomePage() {
  return <h1 className="text-2xl font-semibold tracking-tight">Home</h1>;
}
