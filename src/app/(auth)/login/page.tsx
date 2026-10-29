import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const signupHref = nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup";
  // Opening an invite link while signed out lands here. Most invitees are new,
  // so lead with creating an account instead of "Welcome back".
  const fromInvite = nextPath?.startsWith("/invite/") ?? false;

  return (
    <>
      {fromInvite ? (
        <>
          <h1 className="text-xl font-semibold">You&apos;re invited</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Your team uses Diamond Program. Create a free account to accept the invitation, using
            the email address it was sent to.
          </p>
          <Link
            href={signupHref}
            className="mt-5 flex h-11 w-full items-center justify-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Create an account
          </Link>
          <div className="my-6 flex items-center gap-3 text-xs text-zinc-500">
            <span className="h-px flex-1 bg-zinc-200" />
            Already have an account? Sign in
            <span className="h-px flex-1 bg-zinc-200" />
          </div>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-zinc-600">Welcome back. Let&apos;s get to work.</p>
        </>
      )}
      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          That sign-in link is invalid or has expired. Please try again.
        </p>
      ) : null}
      <LoginForm next={nextPath} variant={fromInvite ? "secondary" : "primary"} />
      {fromInvite ? null : (
        <p className="mt-6 text-center text-sm text-zinc-600">
          New here?{" "}
          <Link href={signupHref} className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </p>
      )}
    </>
  );
}
