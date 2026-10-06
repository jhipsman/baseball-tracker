import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-bold tracking-tight">
        <span aria-hidden className="inline-block size-6 rotate-45 rounded-sm bg-brand-700" />
        Diamond Program
      </Link>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 sm:p-8">
        {children}
      </div>
    </main>
  );
}
