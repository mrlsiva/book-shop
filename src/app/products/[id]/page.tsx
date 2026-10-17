"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/context/store-context";
import { defaultVariation, findStock, formatPrice, selectableVariations, unitTax, variationLabel } from "@/lib/api";
import type { StockItem } from "@/lib/types";
import { BookArt, EmptyState, LoadingPage, Notice, PriceTag } from "@/components/storefront";

function ProductDetailContent() {
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);
  const { products, catalogLoading, addToCart, cart } = useStore();
  const listed = products.find((item) => item.product.id === productId) ?? null;
  const [fetched, setFetched] = useState<{ id: number; stock: StockItem | null; error: string } | null>(null);
  const [selectedVariation, setSelectedVariation] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (listed || catalogLoading || !Number.isFinite(productId)) return;
    let cancelled = false;
    findStock(productId)
      .then((stock) => { if (!cancelled) setFetched({ id: productId, stock, error: "" }); })
      .catch((reason: unknown) => {
        if (!cancelled) setFetched({ id: productId, stock: null, error: reason instanceof Error ? reason.message : "Unable to load this book." });
      });
    return () => { cancelled = true; };
  }, [catalogLoading, listed, productId]);

  const lookup = fetched?.id === productId ? fetched : null;
  const stock = listed ?? lookup?.stock ?? null;
  if (!stock && (catalogLoading || !lookup)) return <LoadingPage label="Finding this book…" />;
  if (!stock) return <main className="page-wrap">{lookup?.error ? <Notice tone="error" message={lookup.error} /> : <EmptyState title="Book not found" description="This book may have left the shelves or be out of stock." action={<Link className="button button-dark" href="/#shelf">Browse books</Link>} />}</main>;

  const { product } = stock;
  const choices = selectableVariations(stock);
  const availableChoices = choices.filter((item) => item.available_quantity > 0);
  const needsVariation = choices.length > 0;
  const variation = needsVariation ? choices.find((item) => String(item.id) === selectedVariation) : undefined;
  const lineVariationId = variation?.id ?? defaultVariation(stock)?.id;
  const inBag = cart.find((line) => line.productId === product.id && line.variationId === lineVariationId)?.qty ?? 0;
  const maxQty = Math.max(0, Math.min(stock.available_quantity, variation?.available_quantity ?? stock.available_quantity) - inBag);
  const soldOut = needsVariation ? !availableChoices.length : stock.available_quantity <= 0;
  const tax = unitTax(product);

  function add() {
    if (addToCart(stock!, variation?.id, qty)) {
      setAdded(true);
      setQty(1);
    }
  }

  return (
    <main className="page-wrap">
      <p className="muted" style={{ marginBottom: 20 }}><Link className="inline-link" href="/#shelf">← Back to the shelves</Link></p>
      <div className="product-detail">
        <BookArt stock={stock} large />
        <section className="product-detail-copy">
          <p className="eyebrow">{[product.category?.name, product.sub_category?.name].filter(Boolean).join(" · ") || "On the shelf"}</p>
          <h1>{product.name}</h1>
          <div className="price"><PriceTag stock={stock} /></div>
          {product.description ? <p>{product.description}</p> : <p>A good book has a way of finding you at just the right time. Add this one to your next reading stack.</p>}
          <p className="muted">Price includes GST{tax > 0 ? ` (${formatPrice(tax)})` : ""}.</p>
          {needsVariation && (
            <div className="field">
              <label htmlFor="book-variation">Edition / format</label>
              <select id="book-variation" value={selectedVariation} onChange={(event) => { setSelectedVariation(event.target.value); setQty(1); setAdded(false); }}>
                <option value="">Choose an option</option>
                {choices.map((item) => <option key={item.id} value={item.id} disabled={item.available_quantity <= 0}>{variationLabel(item)}{item.available_quantity <= 0 ? " (sold out)" : ""}</option>)}
              </select>
            </div>
          )}
          {!soldOut && (!needsVariation || variation) && (
            <div className="quantity-control" aria-label="Quantity">
              <button aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((value) => Math.max(1, value - 1))}>−</button>
              <span>{qty}</span>
              <button aria-label="Increase quantity" disabled={qty >= maxQty} onClick={() => setQty((value) => Math.min(maxQty, value + 1))}>+</button>
              {maxQty <= 5 && <span className="muted" style={{ marginLeft: 8 }}>{maxQty > 0 ? `Only ${maxQty} more available` : "You have all available copies in your bag"}</span>}
            </div>
          )}
          <button className="button button-dark" disabled={soldOut || (needsVariation && !variation) || maxQty <= 0 || qty > maxQty} onClick={add}>{soldOut ? "Sold out" : "Add to bag"} <span aria-hidden="true">+</span></button>
          {added && <Notice message="Added to your bag." action={<Link className="inline-link" href="/cart">View bag</Link>} />}
          {soldOut && <p className="muted">All editions are currently sold out.</p>}
          {product.hsn_code && <p className="muted">HSN {product.hsn_code}{product.metric?.name ? ` · Sold per ${product.metric.name}` : ""}</p>}        </section>
      </div>
    </main>
  );
}

export default function ProductDetailPage() {
  return <Suspense fallback={<LoadingPage label="Finding this book…" />}><ProductDetailContent /></Suspense>;
}
