"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, formatDate, formatPrice, orderReference, orderStatus, orderTotal, toNumber } from "@/lib/api";
import { useStore } from "@/context/store-context";
import type { OrderView } from "@/lib/types";
import { EmptyState, LoadingPage, Notice, PageHeading } from "@/components/storefront";

function OrderDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, ready, customer } = useStore();
  const [view, setView] = useState<OrderView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace(`/login?next=/orders/${encodeURIComponent(id)}`);
      return;
    }
    let cancelled = false;
    void apiRequest<OrderView>(`/orders/view/${encodeURIComponent(id)}`, {}, token)
      .then((payload) => { if (!cancelled) setView(payload); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load this order."); });
    return () => { cancelled = true; };
  }, [id, ready, router, token]);

  if (!ready || !token) return <LoadingPage label="Loading order…" />;
  if (error) return <main className="page-wrap"><Notice tone="error" message={error} /><Link className="inline-link" href="/orders">Back to order history</Link></main>;
  if (!view) return <LoadingPage label="Loading order details…" />;

  const { order } = view;
  // The view endpoint isn't scoped to the signed-in customer, so check ownership here.
  if (!order || (customer && order.customer?.id != null && order.customer.id !== customer.customer_id)) {
    return <main className="page-wrap"><EmptyState title="Order not found" description="We couldn’t find this order in your account." action={<Link className="button button-dark" href="/orders">Back to order history</Link>} /></main>;
  }

  const items = view.order_details ?? [];
  const payments = view.order_payment_details ?? [];
  const tax = items.reduce((sum, item) => sum + toNumber(item.tax_amount), 0);
  const discount = toNumber(order.order_discount);
  const paid = Number(order.is_paid) === 1;
  const billing = order.billing_address;

  return <main className="page-wrap">
    <PageHeading eyebrow="Order details" title={`Order ${orderReference(order)}`} detail={formatDate(order.billed_on ?? order.created_at, "long") || "Your bookstore order"} />
    <div className="split-layout">
      <section>
        <div className="panel">
          <p>Status <span className="status-pill">{orderStatus(order)}</span></p>
          <p className="muted">{paid ? "Paid online" : "Cash on delivery"}{Number(order.status) === 0 && !paid ? " — the bookstore will confirm this order before it’s packed." : ""}</p>
        </div>
        {items.map((item) => <article className="item-row" key={item.id}>
          <span className="brand-seal" aria-hidden="true">B</span>
          <div><h3>{item.name}</h3><p>{toNumber(item.quantity)} × {formatPrice(item.price)}{toNumber(item.tax_amount) > 0 ? ` · incl. GST ${formatPrice(item.tax_amount)}` : ""}</p></div>
          <strong>{formatPrice(toNumber(item.price) * toNumber(item.quantity))}</strong>
        </article>)}
        {billing && (billing.name || billing.address) && <div className="panel" style={{ marginTop: 20 }}><h3 style={{ marginTop: 0 }}>Billing details</h3><p className="muted">{[billing.name, billing.phone].filter(Boolean).join(" · ")}<br />{[billing.address, billing.pincode].filter(Boolean).join(" – ")}</p></div>}
      </section>
      <aside className="panel">
        <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>Order total</h2>
        <div className="summary-row"><span>Subtotal</span><span>{formatPrice(order.bill_amount)}</span></div>
        {discount > 0 && <div className="summary-row"><span>Discount</span><span>−{formatPrice(discount)}</span></div>}
        {tax > 0 && <div className="summary-row muted"><span>Includes GST</span><span>{formatPrice(tax)}</span></div>}
        <div className="summary-row summary-total"><span>Total</span><span>{formatPrice(orderTotal(order))}</span></div>
        {payments.map((payment) => <p className="muted" key={payment.id}>{payment.payment?.name ?? "Payment"}: {formatPrice(payment.amount)}{payment.number ? ` · ${payment.number}` : ""}</p>)}
        <Link className="inline-link" href="/orders">← All orders</Link>
      </aside>
    </div>
  </main>;
}

export default function OrderDetailPage() {
  return <Suspense fallback={<LoadingPage label="Loading order…" />}><OrderDetailContent /></Suspense>;
}
