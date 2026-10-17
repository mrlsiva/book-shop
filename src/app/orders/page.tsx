"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, formatDate, formatPrice, orderReference, orderStatus, orderTotal, pageRows } from "@/lib/api";
import { useStore } from "@/context/store-context";
import type { Order, Paginated } from "@/lib/types";
import { EmptyState, LoadingPage, Notice, PageHeading } from "@/components/storefront";

export default function OrdersPage() {
  const router = useRouter();
  const { token, ready } = useStore();
  const [result, setResult] = useState<Paginated<Order>>({ current_page: 1, last_page: 1, data: [] });
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({ term: "", page: 1 });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login?next=/orders");
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ page: String(query.page) });
    if (query.term) params.set("order", query.term);
    void apiRequest<Paginated<Order>>(`/orders/list?${params}`, {}, token)
      .then((payload) => { if (!cancelled) setResult(pageRows(payload)); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load your orders."); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [query, ready, router, token]);

  function changeQuery(next: { term: string; page: number }) {
    setBusy(true);
    setError("");
    setQuery(next);
  }

  function searchOrders(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    changeQuery({ term: search.trim(), page: 1 });
  }

  if (!ready || !token) return <LoadingPage label="Opening your order history…" />;
  const orders = result.data;
  return <main className="page-wrap">
    <PageHeading eyebrow="The stories you chose" title="Order history" detail="Your orders and their latest status. Cash-on-delivery orders show as awaiting approval until the bookstore confirms them." />
    <form className="search-form" style={{ width: "min(390px, 100%)", marginBottom: 28 }} onSubmit={searchOrders}><label className="sr-only" htmlFor="order-search">Search by bill number</label><input id="order-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by bill number" /><button type="submit">Search <span aria-hidden="true">↗</span></button></form>
    {error && <Notice tone="error" message={error} action={<button className="text-button" onClick={() => changeQuery({ ...query })}>Try again</button>} />}
    {busy ? <p className="loading-line">Finding your orders…</p> : orders.length ? <section>
      {orders.map((order) => <Link className="item-row" key={order.id} href={`/orders/${order.id}`}>
        <span className="brand-seal" aria-hidden="true">B</span>
        <div><h3>Order {orderReference(order)}</h3><p>{formatDate(order.billed_on ?? order.created_at) || "Recent order"} · {Number(order.is_paid) ? "Paid online" : "Cash on delivery"}</p></div>
        <div style={{ textAlign: "right" }}><strong>{formatPrice(orderTotal(order))}</strong><p><span className="status-pill">{orderStatus(order)}</span></p></div>
      </Link>)}
      {result.last_page > 1 && <div className="catalog-footer" style={{ alignItems: "center" }}>
        <button className="text-button" disabled={result.current_page <= 1} onClick={() => changeQuery({ ...query, page: result.current_page - 1 })}>← Newer</button>
        <span>Page {result.current_page} of {result.last_page}</span>
        <button className="text-button" disabled={result.current_page >= result.last_page} onClick={() => changeQuery({ ...query, page: result.current_page + 1 })}>Older →</button>
      </div>}
    </section> : !error && <EmptyState title={query.term ? "No matching orders" : "No orders yet"} description={query.term ? "Try a different bill number." : "Your next favourite book is waiting on the shelves."} action={<Link className="button button-dark" href="/#shelf">Browse books</Link>} />}
  </main>;
}
