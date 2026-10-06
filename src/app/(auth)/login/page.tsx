import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;

  return (
    <>
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600">Welcome back. Let&apos;s get to work.</p>
      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          That sign-in link is invalid or has expired. Please try again.
        </p>
      ) : null}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="mt-6 text-center text-sm text-zinc-600">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
