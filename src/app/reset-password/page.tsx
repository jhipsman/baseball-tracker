import type { Metadata } from "next";
import { requireUser } from "@/lib/org";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const { user } = await requireUser();
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 sm:p-8">
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <p className="mt-1 mb-6 text-sm text-zinc-600">For {user.email}</p>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
