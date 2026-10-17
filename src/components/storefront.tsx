"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cartTotals, useStore } from "@/context/store-context";
import { formatPrice, isPlaceholderImage, selectableVariations, toNumber, unitPrice } from "@/lib/api";
import type { StockItem } from "@/lib/types";

const coverColors = ["#a94b36", "#405a4a", "#d2ad55", "#3f5e72", "#8c6754", "#b37b87"];

export function SiteHeader() {
  const { cart, customer } = useStore();
  const { count } = cartTotals(cart);
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="Book store home"><span className="brand-seal">B</span>Book store</Link>
      <nav className="header-nav" aria-label="Main navigation"><Link href="/#shelf">Books</Link><Link href="/orders">Orders</Link><Link href="/account">Account</Link></nav>
      <div className="header-actions"><Link href={customer ? "/account" : "/login"}>{customer ? customer.name.split(" ")[0] : "Sign in"}</Link><Link className="cart-link" href="/cart">Bag <span className="cart-count" aria-label={`${count} items in bag`}>{count}</span></Link></div>
    </header>
  );
}

export function SiteFooter() {
  return <footer className="site-footer"><span>Book store. Made for readers.</span><span><Link href="/account">Your account</Link> · <Link href="/orders">Order history</Link></span></footer>;
}

export function BookArt({ stock, large = false }: { stock: StockItem; large?: boolean }) {
  const { product } = stock;
  const [broken, setBroken] = useState(false);
  const color = coverColors[product.id % coverColors.length];
  const showImage = !broken && !isPlaceholderImage(product.image);
  return (
    <div className={large ? "product-detail-art" : "book-art"}>
      {showImage ? <Image src={product.image!} alt={product.name} width={500} height={650} unoptimized onError={() => setBroken(true)} /> : (
        <div className="book-cover" style={{ backgroundColor: color, color: product.id % 3 === 1 ? "#f3ead6" : "#252821" }}>
          <span className="book-cover-title">{product.name}</span>
          <span className="book-cover-author">{product.category?.name ?? "BOOK STORE EDITION"}</span>
        </div>
      )}
    </div>
  );
}

export function PriceTag({ stock }: { stock: StockItem }) {
  const price = unitPrice(stock.product);
  const original = toNumber(stock.product.price);
  return <span className="book-price">{formatPrice(price)}{price < original && <del className="muted"> {formatPrice(original)}</del>}</span>;
}

export function BookCard({ stock, index = 0 }: { stock: StockItem; index?: number }) {
  const { addToCart } = useStore();
  const [added, setAdded] = useState(false);
  const { product } = stock;
  const hasChoices = selectableVariations(stock).length > 0;
  return (
    <article className="book-card" style={{ animationDelay: `${Math.min(index * 55, 330)}ms` }}>
      <Link href={`/products/${product.id}`} aria-label={`View ${product.name}`}><BookArt stock={stock} /></Link>
      {hasChoices ? (
        <Link className="book-quick" href={`/products/${product.id}`} aria-label={`Choose an option for ${product.name}`}>Choose option <span aria-hidden="true">→</span></Link>
      ) : (
        <button className="book-quick" onClick={() => { if (addToCart(stock)) { setAdded(true); setTimeout(() => setAdded(false), 1500); } }} aria-label={`Add ${product.name} to bag`}>{added ? "Added" : "Add to bag"} <span aria-hidden="true">{added ? "✓" : "+"}</span></button>
      )}
      <div className="book-meta"><div><Link href={`/products/${product.id}`}><h3>{product.name}</h3></Link><p>{product.category?.name ?? "New on the shelf"}</p></div><PriceTag stock={stock} /></div>
    </article>
  );
}

export function Notice({ message, tone = "neutral", action }: { message: string; tone?: "neutral" | "error"; action?: ReactNode }) {
  return <div className={`notice${tone === "error" ? " error" : ""}`} role={tone === "error" ? "alert" : "status"}><span>{message}</span>{action}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><h2>{title}</h2><p>{description}</p>{action}</div>;
}

export function PageHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return <div className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{detail && <p>{detail}</p>}</div>;
}

export function BookColor({ id }: { id: number }) {
  return <span className="mini-cover" style={{ backgroundColor: coverColors[id % coverColors.length] }} aria-hidden="true">B</span>;
}

export function LoadingPage({ label }: { label: string }) {
  return <main className="page-wrap"><p className="loading-line">{label}</p></main>;
}
