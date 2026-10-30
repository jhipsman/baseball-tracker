"use client";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  cancelTeamPaymentPlan,
  connectTeamPayments,
  recordOfflinePayment,
  remindInvoice,
  startTeamCheckout,
  stopTeamAutopay,
} from "@/lib/team-payment-actions";
import { money } from "@/lib/team-payments";
async function safePaymentAction(
  fn: () => Promise<{ error?: string; url?: string }>,
): Promise<{ error?: string; url?: string }> {
  try {
    return await fn();
  } catch {
    return { error: "The request could not finish. Check your connection and try again." };
  }
}
export function ConnectPaymentsButton({ ready }: { ready: boolean }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        disabled={!ready || pending}
        onClick={() =>
          start(async () => {
            const r = await safePaymentAction(() => connectTeamPayments());
            if (r.error) setError(r.error);
            else if (r.url) window.location.assign(r.url);
          })
        }
      >
        {pending ? "Opening setup…" : "Set up / check online payments"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
export function InvoiceControls({
  invoiceId,
  balance,
  refundable,
  admin,
  online,
  autopay,
}: {
  invoiceId: string;
  balance: number;
  refundable: number;
  admin: boolean;
  online: boolean;
  autopay: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"payment" | "refund">("payment");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "check" | "bank">("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const key = useRef<string | null>(null);
  function call(fn: () => Promise<{ error?: string; url?: string }>, success: string) {
    start(async () => {
      setError("");
      try {
        const r = await fn();
        if (r.error) setError(r.error);
        else if (r.url) window.location.assign(r.url);
        else {
          setMessage(success);
          if (success === "Payment recorded.") {
            setOpen(false);
            key.current = null;
          }
        }
      } catch {
        setError(
          "That did not finish. Check your connection and try again; a recorded payment will not be duplicated.",
        );
      }
    });
  }
  return (
    <div className="space-y-3">
      {admin ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={pending || autopay || (balance === 0 && refundable === 0)}
            onClick={() => {
              setOpen(!open);
              key.current = null;
            }}
          >
            Record payment / refund
          </Button>
          {balance > 0 && (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => call(() => remindInvoice(invoiceId), "In-app reminder sent.")}
            >
              Remind payer
            </Button>
          )}
        </div>
      ) : (
        balance > 0 && (
          <Button
            disabled={pending || !online || autopay}
            onClick={() => call(() => startTeamCheckout({ invoiceId, autopay: false }), "")}
          >
            {pending ? "Opening secure checkout…" : `Pay ${money(balance)}`}
          </Button>
        )
      )}
      {open && (
        <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
          <label className="block text-sm">
            Record
            <select
              className="ml-3 h-11 rounded-lg bg-surface px-3 ring-1 ring-zinc-300"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="payment">Offline payment received</option>
              <option value="refund">Offline refund issued</option>
            </select>
          </label>
          <p className="text-xs text-zinc-600">
            Record money already received or refunded outside the app. This does not charge a card
            or issue a bank refund. For online refunds, use Stripe; verified updates appear here
            automatically.
          </p>
          <Field
            id={`${invoiceId}-amount`}
            label="Amount ($)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <label className="block text-sm">
            Method
            <select
              className="ml-3 h-11 rounded-lg bg-surface px-3 ring-1 ring-zinc-300"
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
            >
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="bank">Bank transfer</option>
            </select>
          </label>
          <Field
            id={`${invoiceId}-reference`}
            label="Reference / check number"
            value={reference}
            maxLength={200}
            onChange={(e) => setReference(e.target.value)}
          />
          <Field
            id={`${invoiceId}-note`}
            label="Note"
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            disabled={pending}
            onClick={() => {
              key.current ??= crypto.randomUUID();
              call(
                () =>
                  recordOfflinePayment({
                    invoiceId,
                    kind,
                    amount,
                    method,
                    reference,
                    note,
                    requestId: key.current!,
                  }),
                "Payment recorded.",
              );
            }}
          >
            {pending ? "Saving…" : "Confirm record"}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-brand-700">
          {message}
        </p>
      )}
    </div>
  );
}
export function AutopayControl({
  planId,
  active,
  amount,
  count,
  first,
  last,
  online,
  eligible,
}: {
  planId: string;
  active: boolean;
  amount: number;
  count: number;
  first: string;
  last: string;
  online: boolean;
  eligible: boolean;
}) {
  const [agree, setAgree] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 text-sm">
      {active ? (
        <>
          <p>Autopay is enabled. Separate payments are disabled to prevent duplicate charges.</p>
          {confirmStop ? (
            <>
              <p className="text-amber-800">
                Stop future automatic charges? Unpaid installments will still be due. A payment
                already processing may still settle.
              </p>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await safePaymentAction(() => stopTeamAutopay(planId));
                    if (r.error) setError(r.error);
                    else setConfirmStop(false);
                  })
                }
              >
                {pending ? "Stopping…" : "Confirm stop autopay"}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmStop(true)}>
              Stop autopay…
            </Button>
          )}
        </>
      ) : (
        eligible && (
          <>
            <label className="flex items-start gap-2 leading-6">
              <input
                type="checkbox"
                className="mt-1"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              Authorize {count} monthly installments of {money(amount)}, starting {first}, with the
              final installment due {last}. You’ll review and authorize the payment method in secure
              checkout.
            </label>
            <Button
              variant="secondary"
              disabled={!online || !agree || pending}
              onClick={() =>
                start(async () => {
                  setError("");
                  const r = await safePaymentAction(() =>
                    startTeamCheckout({ planId, autopay: true }),
                  );
                  if (r.error) setError(r.error);
                  else if (r.url) window.location.assign(r.url);
                })
              }
            >
              {pending ? "Opening secure setup…" : "Set up monthly autopay"}
            </Button>
          </>
        )
      )}
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

export function CancelPlanButton({ planId }: { planId: string }) {
  const [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {confirm ? (
        <>
          <p className="text-sm text-amber-800">
            Cancel this plan’s unpaid balances? Payment and refund history will remain. This does
            not refund money already received.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await safePaymentAction(() => cancelTeamPaymentPlan(planId));
                  if (r.error) setError(r.error);
                  else setConfirm(false);
                })
              }
            >
              {pending ? "Canceling…" : "Confirm cancel unpaid balances"}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setConfirm(false)}>
              Keep plan
            </Button>
          </div>
        </>
      ) : (
        <Button variant="ghost" onClick={() => setConfirm(true)}>
          Cancel unpaid balances…
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
