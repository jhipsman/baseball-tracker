"use client";

import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { useFormAction } from "@/components/ui/use-form-action";
import {
  deletePushSubscription,
  savePushPreferences,
  savePushSubscription,
} from "@/lib/notification-actions";
import { cn } from "@/lib/utils";

type Support = "checking" | "ok" | "ios-needs-install" | "unsupported";

function base64UrlToBytes(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function detectSupport(): Support {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "ios-needs-install";
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  return "ok";
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Turn phone notifications on/off for this device, and choose which kinds get pushed. */
export function PushSettings({
  vapidKey,
  kinds,
  muted,
}: {
  vapidKey: string;
  kinds: { key: string; label: string }[];
  muted: string[];
}) {
  const [support, setSupport] = useState<Support>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefs = useFormAction(savePushPreferences, {});

  useEffect(() => {
    const s = detectSupport();
    let cancelled = false;
    (async () => {
      if (s === "ok") {
        try {
          const reg = await registration();
          const sub = await reg.pushManager.getSubscription();
          if (!cancelled) setSubscribed(Boolean(sub) && Notification.permission === "granted");
        } catch {
          // Registration can fail in private windows; the toggle reports it on use.
        }
      }
      if (!cancelled) setSupport(s);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError(
          permission === "denied"
            ? "Notifications are blocked for this site. Allow them in your browser or phone settings, then try again."
            : "You need to allow notifications to turn this on.",
        );
        return;
      }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(vapidKey),
        }));
      const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSubscribed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn off notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {support === "ios-needs-install" ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          On iPhone, first add this app to your Home Screen: tap the Share button, then{" "}
          <strong>Add to Home Screen</strong>. Open Diamond from your Home Screen and come back here
          to turn on notifications.
        </p>
      ) : support === "unsupported" ? (
        <p className="text-sm text-zinc-500">
          This browser doesn&apos;t support phone notifications. Try Chrome, Edge, Firefox, or
          Safari on a recent device.
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-900">Turn on phone notifications</p>
            <p className="text-xs text-zinc-500">
              {subscribed
                ? "This device gets a notification when something new comes in."
                : "Get a buzz on this device for messages and team updates."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={subscribed}
            aria-label="Turn on phone notifications"
            disabled={busy || support === "checking"}
            onClick={subscribed ? turnOff : turnOn}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
              subscribed ? "bg-brand-700" : "bg-zinc-300",
            )}
          >
            <span
              className={cn(
                "inline-block size-5 rounded-full bg-surface shadow transition-transform",
                subscribed ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form onSubmit={prefs.onSubmit} className="space-y-2 border-t border-zinc-100 pt-4">
        <p className="text-sm font-medium text-zinc-900">Send to my phone</p>
        <p className="text-xs text-zinc-500">
          Unchecked kinds still show up here and on the bell, just without a phone alert.
        </p>
        <ul className="space-y-1.5">
          {kinds.map((k) => (
            <li key={k.key}>
              <input type="hidden" name="shown" value={k.key} />
              <label className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  name="on"
                  value={k.key}
                  defaultChecked={!muted.includes(k.key)}
                  className="size-4 accent-brand-700"
                />
                {k.label}
              </label>
            </li>
          ))}
        </ul>
        <FormMessage state={prefs.state} />
        <SubmitButton variant="secondary" pending={prefs.pending} pendingLabel="Saving…">
          Save
        </SubmitButton>
      </form>
    </div>
  );
}
