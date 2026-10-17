"use client";

import Script from "next/script";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, formatPrice, pageRows, toNumber } from "@/lib/api";
import { savePendingPayment } from "@/lib/pending-payment";
import { cartTotals, useStore } from "@/context/store-context";
import type { Order, Paginated } from "@/lib/types";
import { LoadingPage, Notice, PageHeading } from "@/components/storefront";

type Gateway = { payment_gateway?: string; key_id?: string };
type PaymentIntent = { razorpay_order_id: string; razorpay_key_id: string; amount: number | string; currency: string };

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      order_id: string;
      amount: number;
      currency: string;
      name: string;
      description?: string;
      prefill?: { name?: string; contact?: string; email?: string };
      theme?: { color?: string };
      handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
      modal: { ondismiss: () => void };
    }) => { open: () => void; on: (event: "payment.failed", callback: (response: { error?: { description?: string } }) => void) => void };
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { customer, token, cart, ready, clearCart } = useStore();
  const [gateway, setGateway] = useState<Gateway>({});
  const [gatewayLoaded, setGatewayLoaded] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");
  const [alternateBilling, setAlternateBilling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { total, tax } = cartTotals(cart);
  const onlineAvailable = gateway.payment_gateway === "razorpay" && Boolean(gateway.key_id);
  const delivery = customer?.customer;

  useEffect(() => {
    if (!ready) return;
    if (!customer || !token) {
      router.replace("/login?next=/checkout");
      return;
    }
    let cancelled = false;
    // An empty object means the shop has no gateway configured: COD only.
    void apiRequest<Gateway | []>("/payment_gateway_detail", {}, token)
      .then((details) => { if (!cancelled) setGateway(details && !Array.isArray(details) ? details : {}); })
      .catch(() => { if (!cancelled) setGateway({}); })
      .finally(() => { if (!cancelled) setGatewayLoaded(true); });
    return () => { cancelled = true; };
  }, [customer, ready, router, token]);

  function orderBody(form: FormData, includeTax: boolean) {
    const billing = alternateBilling
      ? {
          billing_name: String(form.get("billing_name") ?? "").trim(),
          billing_phone: String(form.get("billing_phone") ?? "").trim(),
          billing_address: String(form.get("billing_address") ?? "").trim(),
          billing_pincode: String(form.get("billing_pincode") ?? "").trim() || null,
        }
      // The API reads billing_customer.billing_phone unconditionally, so always send the object.
      : { billing_name: null, billing_phone: null, billing_address: null, billing_pincode: null };
    return {
      customer: customer!.customer_id,
      discount: 0,
      cart: cart.map((line) => ({
        product_id: line.productId,
        qty: line.qty,
        price: line.unitPrice,
        // Prices are GST-inclusive; tax_amount is the line's tax portion for receipts.
        tax_amount: includeTax ? Math.round(line.unitTax * line.qty * 100) / 100 : 0,
        ...(line.variationId ? { variation_id: line.variationId } : {}),
      })),
      billing_customer: billing,
    };
  }

  async function payOnline(form: FormData) {
    if (!onlineAvailable) throw new Error("Online payment is not available for this store.");
    if (!window.Razorpay) throw new Error("Secure checkout is still loading. Please try again.");

    // Remember the newest existing order so the confirmation page can spot the
    // one the payment webhook creates.
    const before = await apiRequest<Paginated<Order>>("/orders/list", {}, token).catch(() => null);
    const lastOrderId = pageRows(before).data[0]?.id ?? 0;

    // /orders/checkout adds tax_amount on top of price when sizing the payment,
    // but our prices already include GST — so send 0 here to charge the shown total.
    const intent = await apiRequest<PaymentIntent>("/orders/checkout", { method: "POST", body: JSON.stringify(orderBody(form, false)) }, token);
    const amount = toNumber(intent.amount);
    if (Math.abs(amount - total) > 1) {
      throw new Error(`The payment amount (${formatPrice(amount)}) does not match your bag total (${formatPrice(total)}). Please refresh and try again.`);
    }

    const razorpay = new window.Razorpay({
      key: intent.razorpay_key_id || gateway.key_id!,
      order_id: intent.razorpay_order_id,
      amount: Math.round(amount * 100),
      currency: intent.currency || "INR",
      name: "Book store",
      description: `${cart.length} ${cart.length === 1 ? "item" : "items"}`,
      prefill: { name: customer!.name, contact: customer!.phone, email: customer!.email ?? undefined },
      theme: { color: "#252821" },
      handler: () => {
        savePendingPayment({ razorpayOrderId: intent.razorpay_order_id, amount, lastOrderId, startedAt: Date.now() });
        clearCart();
        router.push("/confirmation?method=online");
      },
      modal: { ondismiss: () => setBusy(false) },
    });
    razorpay.on("payment.failed", (response) => {
      setError(response.error?.description || "The payment did not go through. You have not been charged.");
      setBusy(false);
    });
    razorpay.open();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer || !token || !cart.length || busy) return;
    const form = new FormData(event.currentTarget);
    if (alternateBilling) {
      if (!/^\d{10}$/.test(String(form.get("billing_phone") ?? ""))) return setError("Enter a 10-digit billing phone number.");
      const pincode = String(form.get("billing_pincode") ?? "");
      if (pincode && !/^[1-9]\d{5}$/.test(pincode)) return setError("Enter a valid 6-digit billing pincode.");
    }
    setBusy(true);
    setError("");
    try {
      if (paymentMethod === "online") {
        await payOnline(form);
        return; // busy stays on until Razorpay closes or succeeds
      }
      const orderId = await apiRequest<number | string>("/orders/store", { method: "POST", body: JSON.stringify({ ...orderBody(form, true), is_paid: 0 }) }, token);
      clearCart();
      router.push(`/confirmation?method=cod&id=${encodeURIComponent(String(orderId))}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not start checkout.");
      setBusy(false);
    }
  }

  if (!ready || !customer || !token) return <LoadingPage label="Preparing checkout…" />;
  if (!cart.length) return <main className="page-wrap"><PageHeading eyebrow="Checkout" title="Your bag is empty" detail="Add a book before checking out." /><Link className="button button-dark" href="/#shelf">Browse books</Link></main>;

  const missingAddress = !delivery?.address;

  return <main className="page-wrap">
    {onlineAvailable && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onReady={() => setScriptReady(true)} />}
    <PageHeading eyebrow="Almost there" title="Checkout" detail="Your book prices already include applicable taxes." />
    {error && <Notice tone="error" message={error} />}
    <form className="split-layout" onSubmit={submit}>
      <section className="form-stack">
        <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>Delivery details</h2>
        <div className="panel">
          <div className="summary-row"><strong>{customer.name}</strong><span>{customer.phone}</span></div>
          <p className="muted">{missingAddress ? "No delivery address on file yet." : [delivery?.address, delivery?.pincode].filter(Boolean).join(" – ")}</p>
          <Link className="inline-link" href="/account">{missingAddress ? "Add a delivery address" : "Edit delivery details"}</Link>
        </div>
        <label className="choice-row"><input type="checkbox" checked={alternateBilling} onChange={(event) => setAlternateBilling(event.target.checked)} /><span><strong>Use different billing details</strong>Enter alternate billing contact and address.</span></label>
        {alternateBilling && <div className="form-stack">
          <div className="form-grid">
            <div className="field"><label htmlFor="billing_name">Billing name</label><input id="billing_name" name="billing_name" maxLength={255} required /></div>
            <div className="field"><label htmlFor="billing_phone">Billing phone</label><input id="billing_phone" name="billing_phone" type="tel" inputMode="numeric" pattern="\d{10}" maxLength={10} required /></div>
            <div className="field"><label htmlFor="billing_pincode">Billing pincode <span className="muted">(optional)</span></label><input id="billing_pincode" name="billing_pincode" inputMode="numeric" pattern="[1-9]\d{5}" maxLength={6} /></div>
          </div>
          <div className="field"><label htmlFor="billing_address">Billing address</label><textarea id="billing_address" name="billing_address" required /></div>
        </div>}
        <h2 style={{ marginTop: 14, fontFamily: "var(--font-serif)", fontWeight: 500 }}>Payment</h2>
        {!gatewayLoaded ? <p className="muted">Checking available payment methods…</p> : <>
          {onlineAvailable && <label className="choice-row"><input type="radio" name="payment" value="online" checked={paymentMethod === "online"} onChange={() => setPaymentMethod("online")} /><span><strong>Pay online</strong>UPI, cards, netbanking and wallets via Razorpay. Your order is confirmed once the payment clears.</span></label>}
          <label className="choice-row"><input type="radio" name="payment" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} /><span><strong>Cash on delivery</strong>Your order is sent to the bookstore for approval. Items aren’t reserved until the shop approves it.</span></label>
        </>}
        {paymentMethod === "online" && !scriptReady && <p className="muted">Loading secure checkout…</p>}
        {missingAddress && <Notice tone="error" message="Add a delivery address to your account before placing an order." />}
        <button className="button button-dark" type="submit" disabled={busy || !gatewayLoaded || missingAddress || (paymentMethod === "online" && !scriptReady)}>{busy ? (paymentMethod === "online" ? "Waiting for payment…" : "Placing your order…") : paymentMethod === "online" ? `Pay ${formatPrice(total)}` : "Place COD order"}<span aria-hidden="true">→</span></button>
      </section>
      <aside><h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>Order summary</h2><div className="panel">
        {cart.map((line) => <div className="summary-row" key={`${line.productId}-${line.variationId ?? "default"}`}><span>{line.name}{line.variationLabel ? ` (${line.variationLabel})` : ""} × {line.qty}</span><span>{formatPrice(line.unitPrice * line.qty)}</span></div>)}
        {tax > 0 && <div className="summary-row muted"><span>Includes GST</span><span>{formatPrice(tax)}</span></div>}
        <div className="summary-row summary-total"><span>Total</span><span>{formatPrice(total)}</span></div>
        <p className="muted">No taxes are added again at checkout.</p>
      </div></aside>
    </form>
  </main>;
}
