import Link from "next/link";
import { BRAND } from "@/constants/brand";
import { LogoMark } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-bold tracking-tight">
        <LogoMark className="size-8 text-brand-600" />
        {BRAND.name}
      </Link>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-zinc-200 sm:p-8">
        {children}
      </div>
      <p className="mt-8 text-xs text-zinc-500">
        © {new Date().getFullYear()} {BRAND.legalName}
      </p>
    </main>
  );
}
