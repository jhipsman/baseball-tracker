import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Forgot your password?</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600">
        Enter your email and we&apos;ll send you a link to choose a new one.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-zinc-600">
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
