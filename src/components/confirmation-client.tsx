"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/store-context";
import { apiRequest, formatPrice, orderReference, orderTotal, pageRows } from "@/lib/api";
import { clearPendingPayment, readPendingPayment, type PendingPayment } from "@/lib/pending-payment";
import type { Order, Paginated } from "@/lib/types";
import { PageHeading } from "@/components/storefront";

const POLL_EVERY_MS = 2_000;
const POLL_FOR_MS = 60_000;

const actions = { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 25 } as const;

export function ConfirmationClient({ method, orderId }: { method: string; orderId: string }) {
  const { token, ready } = useStore();
  const [pending, setPending] = useState<PendingPayment | null | undefined>(undefined);
  const [matchedOrder, setMatchedOrder] = useState<Order | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (method !== "online") return;
    void Promise.resolve().then(() => setPending(readPendingPayment()));
  }, [method]);

  useEffect(() => {
    if (method !== "online" || !ready || !token || !pending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    // The order is created by Razorpay's server-to-server webhook a few seconds
    // after payment, so look for a new order of the paid amount.
    async function checkForOrder() {
      try {
        const payload = await apiRequest<Paginated<Order>>("/orders/list", {}, token);
        const match = pageRows(payload).data.find(
          (order) => order.id > pending!.lastOrderId && Math.abs(orderTotal(order) - pending!.amount) <= 1,
        );
        if (cancelled) return;
        if (match) {
          clearPendingPayment();
          setMatchedOrder(match);
          return;
        }
      } catch {
        // Keep checking; the webhook may still be creating the order.
      }
      if (cancelled) return;
      if (Date.now() - startedAt >= POLL_FOR_MS) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(checkForOrder, POLL_EVERY_MS);
    }

    void checkForOrder();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempt, method, pending, ready, token]);

  if (method === "cod") {
    return <main className="page-wrap" style={{ maxWidth: 760 }}>
      <div className="confirmation-mark" aria-hidden="true">✓</div>
      <PageHeading eyebrow="Order request received" title="Awaiting the bookstore’s approval" detail="We’ve sent your cash-on-delivery order to the bookstore. It isn’t confirmed yet: the shop reviews each COD order, and your books are only set aside once they approve it. You can follow its status in your order history." />
      <div style={actions}>
        {orderId && <Link className="button button-dark" href={`/orders/${encodeURIComponent(orderId)}`}>View this order <span aria-hidden="true">→</span></Link>}
        <Link className="button button-outline" href="/orders">Order history</Link>
        <Link className="button button-outline" href="/#shelf">Keep browsing</Link>
      </div>
    </main>;
  }

  if (matchedOrder) {
    return <main className="page-wrap" style={{ maxWidth: 760 }}>
      <div className="confirmation-mark" aria-hidden="true">✓</div>
      <PageHeading eyebrow="Payment received" title="Your order is confirmed" detail={`Order ${orderReference(matchedOrder)} · ${formatPrice(orderTotal(matchedOrder))}. Thank you for shopping with us!`} />
      <div style={actions}><Link className="button button-dark" href={`/orders/${matchedOrder.id}`}>View order <span aria-hidden="true">→</span></Link><Link className="button button-outline" href="/#shelf">Keep browsing</Link></div>
    </main>;
  }

  const checking = Boolean(pending) && !timedOut;
  return <main className="page-wrap" style={{ maxWidth: 760 }}>
    <div className="confirmation-mark" aria-hidden="true">…</div>
    <PageHeading eyebrow="Payment received" title={checking ? "Confirming your order…" : "Your order is being confirmed"} detail="Razorpay has received your payment. The bookstore confirms the order as soon as the payment notification reaches it, which usually takes a few seconds." />
    {pending && <p className="muted">Amount paid: {formatPrice(pending.amount)}</p>}
    {checking && <p className="loading-line" role="status">Checking for your order…</p>}
    {timedOut && <p className="muted">This is taking longer than usual. Your payment is safe — the order will appear in your order history once confirmed. <button className="text-button" onClick={() => { setTimedOut(false); setAttempt((value) => value + 1); }}>Check again</button></p>}
    {pending === null && <p className="muted">Your order will appear in your order history shortly.</p>}
    <div style={actions}><Link className="button button-dark" href="/orders">Check order history <span aria-hidden="true">→</span></Link><Link className="button button-outline" href="/">Return to the shelves</Link></div>
  </main>;
}
