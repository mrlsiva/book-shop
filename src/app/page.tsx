"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useStore } from "@/context/store-context";
import { BookCard, EmptyState, Notice } from "@/components/storefront";
import type { Category } from "@/lib/types";

export default function Home() {
  const { categories, products, catalogQuery, catalogLoading, catalogLoadingMore, catalogHasMore, catalogError, loadCatalog, loadMoreCatalog } = useStore();
  const [search, setSearch] = useState(catalogQuery.search);
  const activeCategory = catalogQuery.category;

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadCatalog({ search: search.trim() });
  }

  function chooseCategory(category: Category | null) {
    setSearch("");
    void loadCatalog({ category });
  }

  return (
    <main>
      <section className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow">A little more wonder, one page at a time</p>
          <h1>Stories worth<br />staying up for.</h1>
          <p className="hero-description">Find your next favourite among thoughtful reads, fresh voices, and well-loved classics.</p>
          <a className="button button-dark" href="#shelf">Browse the shelves <span aria-hidden="true">↘</span></a>
        </div>
        <div className="hero-art" aria-label="A stack of books from the bookstore">
          <div className="hero-note">THE<br />GOOD<br />PAGES</div>
          <div className="book-stack">
            <div className="hero-book book-one"><span>THE ART<br />OF NOTICING</span><small>FIELD NOTES · 01</small></div>
            <div className="hero-book book-two"><span>WILD<br />PLACES</span><small>A NOVEL BY E. HART</small></div>
            <div className="hero-book book-three"><span>THE<br />LONG WAY<br />HOME</span><small>NEW EDITION</small></div>
          </div>
          <div className="hero-stamp">READ<br />MORE</div>
        </div>
        <div className="hero-bottom"><span>CURATED FOR THE CURIOUS</span><span>EST. 2024 · OPEN EVERY DAY</span></div>
      </section>

      <section className="catalog-section" id="shelf">
        <div className="section-heading">
          <div><p className="eyebrow">Your next chapter</p><h2>Browse the shelves</h2></div>
          <form className="search-form" onSubmit={onSearch}>
            <label className="sr-only" htmlFor="book-search">Search books</label>
            <input id="book-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title or category" />
            <button type="submit" aria-label="Search books">Search <span aria-hidden="true">↗</span></button>
          </form>
        </div>

        <nav className="category-list" aria-label="Book categories">
          <button className={!activeCategory ? "category-chip active" : "category-chip"} aria-pressed={!activeCategory} onClick={() => chooseCategory(null)}>All books</button>
          {categories.map((category) => (
            <button key={category.id} className={activeCategory?.id === category.id ? "category-chip active" : "category-chip"} aria-pressed={activeCategory?.id === category.id} onClick={() => chooseCategory(category)}>{category.name}</button>
          ))}
        </nav>

        {catalogQuery.search && !catalogLoading && <p className="muted">Showing results for “{catalogQuery.search}”. <button className="text-button" onClick={() => chooseCategory(null)}>Clear search</button></p>}

        {catalogError && !products.length ? <Notice tone="error" message={catalogError} action={<button className="text-button" onClick={() => void loadCatalog(catalogQuery)}>Try again</button>} /> : catalogLoading ? <p className="loading-line">Opening the shelves…</p> : products.length ? (
          <div className="book-grid">{products.map((stock, index) => <BookCard key={stock.product.id} stock={stock} index={index} />)}</div>
        ) : <EmptyState title="The shelves are quiet" description={catalogQuery.search ? "No books matched that search. Try another title or category." : activeCategory ? "Nothing in this category is in stock right now." : "There are no books to show just yet. Check back soon."} />}
        {catalogError && products.length > 0 && <Notice tone="error" message={catalogError} />}
        {!catalogLoading && catalogHasMore && <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}><button className="button button-outline" disabled={catalogLoadingMore} onClick={() => void loadMoreCatalog()}>{catalogLoadingMore ? "Loading…" : "Show more books"}</button></div>}
        <div className="catalog-footer"><span>{products.length} {products.length === 1 ? "book" : "books"} in view</span><Link href="/orders">Track an order <span aria-hidden="true">↗</span></Link></div>
      </section>

      <section className="reading-note">
        <div className="reading-mark">“</div>
        <p>There is no friend as loyal as a book.</p>
        <span>ERNEST HEMINGWAY</span>
      </section>
    </main>
  );
}