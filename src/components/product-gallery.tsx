"use client";

import Image from "next/image";
import { useState, type KeyboardEvent } from "react";
import { BookArt } from "@/components/storefront";
import { productPhotos } from "@/lib/api";
import type { StockItem } from "@/lib/types";

/**
 * Detail-page photo viewer: `product.image` is the default photo and
 * `product.images` (0–n gallery URLs) appear as a thumbnail strip to switch it.
 * Falls back to the generated cover when there is no usable photo.
 */
export function ProductGallery({ stock }: { stock: StockItem }) {
  const { product } = stock;
  const [broken, setBroken] = useState<string[]>([]);
  const [selectedSrc, setSelectedSrc] = useState<string | null>(null);
  const photos = productPhotos(product).filter((src) => !broken.includes(src));

  if (!photos.length) return <BookArt stock={stock} large />;

  const index = Math.max(0, photos.indexOf(selectedSrc ?? photos[0]));
  const current = photos[index];
  const select = (next: number) => setSelectedSrc(photos[(next + photos.length) % photos.length]);
  const markBroken = (src: string) => setBroken((list) => (list.includes(src) ? list : [...list, src]));

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (photos.length < 2) return;
    if (event.key === "ArrowRight") { event.preventDefault(); select(index + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); select(index - 1); }
  }

  return (
    <div className="product-gallery" role="region" aria-roledescription="carousel" aria-label={`Photos of ${product.name}`} onKeyDown={onKeyDown}>
      <div className="product-detail-art product-gallery-main">
        <Image key={current} src={current} alt={photos.length > 1 ? `${product.name} — photo ${index + 1} of ${photos.length}` : product.name} width={800} height={1040} unoptimized priority onError={() => markBroken(current)} />
        {photos.length > 1 && <>
          <button type="button" className="gallery-arrow gallery-prev" aria-label="Previous photo" onClick={() => select(index - 1)}>‹</button>
          <button type="button" className="gallery-arrow gallery-next" aria-label="Next photo" onClick={() => select(index + 1)}>›</button>
          <span className="gallery-count" aria-hidden="true">{index + 1} / {photos.length}</span>
        </>}
      </div>
      {photos.length > 1 && (
        <div className="gallery-thumbs" role="group" aria-label="Choose a photo">
          {photos.map((src, thumbIndex) => (
            <button type="button" key={src} className={thumbIndex === index ? "gallery-thumb active" : "gallery-thumb"} aria-label={`Show photo ${thumbIndex + 1}`} aria-current={thumbIndex === index} onClick={() => select(thumbIndex)}>
              <Image src={src} alt="" width={120} height={156} unoptimized loading="lazy" onError={() => markBroken(src)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
