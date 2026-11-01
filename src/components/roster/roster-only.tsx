"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addRosterPlayers, giveLogin } from "@/lib/claim-actions";

const input = "h-11 w-full rounded-lg bg-surface px-3 text-sm ring-1 ring-zinc-300";

/** Type names (one per line, optional ", number, position") to add players without emails. */
export function AddPlayersForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const people = text
          .split("\n")
          .map((l) => l.split(/[,\t]/).map((x) => x.trim()))
          .filter((p) => p[0])
          .map(([name, a = "", b = ""]) => {
            const num = [a, b].find((x) => /^#?\d{1,2}$/.test(x))?.replace("#", "");
            const position = [a, b].find((x) => x && !/^#?\d{1,2}$/.test(x));
            return { name, jersey: num, position };
          });
        start(async () => {
          const res = await addRosterPlayers(people);
          if (res.error) setMsg({ ok: false, text: res.error });
          else {
            setText("");
            setMsg({ ok: true, text: `Added ${res.added} player${res.added === 1 ? "" : "s"}.` });
            router.refresh();
          }
        });
      }}
    >
      <label className="block text-sm font-medium">
        Names, one per line
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={"Alex Rivera, 12, SS\nBen Ortiz, 7\nCam Lee"}
          className="mt-1 block w-full rounded-lg bg-surface p-3 text-sm ring-1 ring-zinc-300"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="h-11 rounded-full bg-zinc-900 px-5 text-sm font-semibold text-zinc-50 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add players"}
        </button>
        {msg ? (
          <span
            role="status"
            className={msg.ok ? "text-sm text-brand-800" : "text-sm text-red-700"}
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/** For a roster-only player: email them a link to set up their own login on this same account. */
export function GiveLoginForm({ playerId, firstName }: { playerId: string; firstName: string }) {
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ error?: string; link?: string; emailed?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  if (res?.link)
    return (
      <div className="space-y-2 text-sm" role="status">
        <p className="font-semibold text-brand-800">
          {res.emailed ? `Emailed ${email} a link to set up the login.` : "Login link ready."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="max-w-full truncate rounded bg-zinc-100 px-2 py-1 text-xs">
            {res.link}
          </code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(res.link!);
              setCopied(true);
            }}
            className="min-h-11 text-sm font-semibold text-brand-700"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    );
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setRes(await giveLogin(playerId, email)));
      }}
    >
      <label className="flex-1 text-sm font-medium">
        {firstName}&apos;s email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${input} mt-1`}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-full bg-brand-700 px-5 text-sm font-semibold text-on-brand disabled:opacity-50"
      >
        {pending ? "Sending…" : "Give them a login"}
      </button>
      {res?.error ? (
        <p role="alert" className="text-sm text-red-700 sm:basis-full">
          {res.error}
        </p>
      ) : null}
    </form>
  );
}
