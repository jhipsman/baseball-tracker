import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";
import { inviteLine, invitePreview } from "@/lib/invite-preview";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const invite = await invitePreview(nextPath);

  return (
    <>
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600">
        {invite
          ? `${inviteLine(invite)} Use the email your invite was sent to; you'll accept it on the next screen.`
          : nextPath?.startsWith("/invite/")
            ? "Use the email address your invitation was sent to. You'll accept it on the next screen."
            : nextPath?.startsWith("/join/")
              ? "Make your parent account. You'll fill in the registration on the next screen."
              : "Coaches, players, and parents all start here."}
      </p>
      <SignupForm next={nextPath} email={invite?.email} />
      <p className="mt-6 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link
          href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"}
          className="font-semibold text-brand-700 hover:underline"
        >
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-center text-xs text-zinc-500">
        By creating an account you agree to the{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </>
  );
}
