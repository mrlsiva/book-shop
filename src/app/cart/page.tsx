"use client";

import Link from "next/link";
import { cartTotals, useStore } from "@/context/store-context";
import { BookColor, EmptyState, LoadingPage, PageHeading } from "@/components/storefront";
import { formatPrice } from "@/lib/api";

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, ready, customer } = useStore();
  const { count, total, tax } = cartTotals(cart);
  if (!ready) return <LoadingPage label="Opening your bag…" />;

  return (
    <main className="page-wrap">
      <PageHeading eyebrow="Your reading stack" title="Your bag" detail={`${count} ${count === 1 ? "book" : "books"}, ready when you are.`} />
      {!cart.length ? <EmptyState title="Your bag is taking a breather" description="Find a book that feels like you." action={<Link className="button button-dark" href="/#shelf">Browse books</Link>} /> : (
        <div className="split-layout">
          <section aria-label="Books in your bag">
            {cart.map((line) => (
              <article className="item-row" key={`${line.productId}-${line.variationId ?? "default"}`}>
                <BookColor id={line.productId} />
                <div>
                  <Link href={`/products/${line.productId}`}><h3>{line.name}</h3></Link>
                  <p>{[line.variationLabel, `${formatPrice(line.unitPrice)} each`].filter(Boolean).join(" · ")}</p>
                  <div className="quantity-control">
                    <button aria-label={`Decrease ${line.name} quantity`} onClick={() => updateQuantity(line, line.qty - 1)}>−</button>
                    <span>{line.qty}</span>
                    <button aria-label={`Increase ${line.name} quantity`} disabled={line.qty >= line.maxQty} onClick={() => updateQuantity(line, line.qty + 1)}>+</button>
                    <button className="text-button" onClick={() => removeFromCart(line)}>Remove</button>
                  </div>
                  {line.qty >= line.maxQty && <p>That’s every copy we have right now.</p>}
                </div>
                <strong>{formatPrice(line.unitPrice * line.qty)}</strong>
              </article>
            ))}
          </section>
          <aside>
            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>Order summary</h2>
            <div className="panel">
              <div className="summary-row"><span>Subtotal</span><span>{formatPrice(total)}</span></div>
              {tax > 0 && <div className="summary-row muted"><span>Includes GST</span><span>{formatPrice(tax)}</span></div>}
              <div className="summary-row summary-total"><span>Total</span><span>{formatPrice(total)}</span></div>
              <p className="muted">Prices include applicable taxes.</p>
              <Link className="button button-dark" href={customer ? "/checkout" : "/login?next=/checkout"} style={{ width: "100%", marginTop: 12 }}>{customer ? "Continue to checkout" : "Sign in to check out"} <span aria-hidden="true">→</span></Link>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
