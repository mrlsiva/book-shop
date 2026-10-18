import type { ApiEnvelope, Order, Paginated, Product, ProductPage, StockItem, VariantAttribute, Variation } from "@/lib/types";

/**
 * Browser requests go to this app's /sling proxy (see next.config.ts) because
 * the Sling API does not send CORS headers. Set NEXT_PUBLIC_API_BASE_URL only
 * if the API is reachable cross-origin.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/sling").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Registered by the store so an expired/revoked token signs the customer out. */
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function errorText(payload: Partial<ApiEnvelope<unknown>> | null, status: number) {
  const errors = payload?.errors;
  if (typeof errors === "string" && errors) return errors;
  if (Array.isArray(errors) && errors.length) return errors.join(" ");
  if (errors && typeof errors === "object") {
    const messages = Object.values(errors).flatMap((value) => (Array.isArray(value) ? value : [value]));
    if (messages.length) return messages.join(" ");
  }
  // 5xx bodies from Laravel carry raw exception text; never show that to shoppers.
  if (status >= 500) return "The bookstore ran into a problem. Please try again in a moment.";
  return payload?.message || "Something went wrong. Please try again.";
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("We could not reach the bookstore right now.");
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON body (proxy error page, PHP fatal, …) — handled below.
  }

  if (response.status === 401 && token) {
    unauthorizedHandler?.();
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }
  if (!response.ok || !payload || payload.success !== true) {
    throw new ApiError(errorText(payload, response.status), response.status);
  }
  return payload.data;
}

export function toNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function formatPrice(value: unknown) {
  const amount = toNumber(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value?: string | null, dateStyle: "medium" | "long" = "medium") {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-IN", { dateStyle });
}

/* ---------- catalog ---------- */

export function unitPrice(product: Product) {
  const price = toNumber(product.price);
  const discounted = product.discounted_price == null ? NaN : toNumber(product.discounted_price);
  return discounted > 0 && discounted <= price ? discounted : price;
}

/** GST included in the unit price, scaled if a discount lowered the price. */
export function unitTax(product: Product) {
  const price = toNumber(product.price);
  const tax = toNumber(product.tax_amount);
  if (price <= 0 || tax <= 0) return 0;
  return Math.round(tax * (unitPrice(product) / price) * 100) / 100;
}

export function isPlaceholderImage(src?: string | null) {
  return !src || /no-image-icon\.svg$/i.test(src);
}

/** The API caps a product's gallery at this many photos. */
export const MAX_GALLERY_PHOTOS = 5;

/** Primary photo first, then gallery photos; placeholders and duplicates removed. */
export function productPhotos(product: Product) {
  const gallery = Array.isArray(product.images) ? product.images.slice(0, MAX_GALLERY_PHOTOS) : [];
  const all = [product.image, ...gallery].filter((src): src is string => typeof src === "string" && !isPlaceholderImage(src));
  return [...new Set(all)];
}

function attributeName(value: VariantAttribute | undefined) {
  if (!value) return "";
  return typeof value === "string" ? value : value.name ?? "";
}

export function variationLabel(variation: Variation) {
  return [attributeName(variation.size), attributeName(variation.colour)].filter(Boolean).join(" · ");
}

/** Variations the customer actually chooses between (size and/or colour set). */
export function selectableVariations(stock: StockItem) {
  return stock.variations.filter((variation) => variationLabel(variation));
}

/**
 * Plain products still come back with one "default" variation (no size or
 * colour). Its id is sent with the order so the shop's variation stock stays
 * in step with the product stock.
 */
export function defaultVariation(stock: StockItem) {
  return selectableVariations(stock).length ? undefined : stock.variations.find((variation) => variation.available_quantity > 0);
}

export function isInStock(stock: StockItem) {
  if (stock.available_quantity <= 0) return false;
  const choices = selectableVariations(stock);
  return !choices.length || choices.some((variation) => variation.available_quantity > 0);
}

export function stockPage(page: ProductPage): Paginated<StockItem> {
  if (Array.isArray(page.stocks)) return { current_page: 1, last_page: 1, data: page.stocks };
  return page.stocks;
}

export async function fetchStockPage(search = "", page = 1) {
  const params = new URLSearchParams({ stock_in: "1", page: String(page) });
  if (search) params.set("product", search);
  return apiRequest<ProductPage>(`/products?${params}`);
}

/** The API has no single-product endpoint, so walk the catalog pages. */
export async function findStock(productId: number) {
  for (let page = 1; page <= 50; page += 1) {
    const result = stockPage(await fetchStockPage("", page));
    const match = result.data.find((stock) => stock.product.id === productId);
    if (match) return match;
    if (page >= result.last_page) break;
  }
  return null;
}

/* ---------- orders ---------- */

const ORDER_STATUS: Record<number, string> = {
  0: "Awaiting shop approval",
  1: "Approved",
  2: "Packed",
  3: "In transit",
  4: "Delivered",
  5: "Declined",
};

export function orderStatus(order: Order) {
  return ORDER_STATUS[Number(order.status)] ?? "Processing";
}

export function orderTotal(order: Order) {
  return Math.max(0, toNumber(order.bill_amount) - toNumber(order.order_discount));
}

export function orderReference(order: Order) {
  return order.bill_id || `#${order.id}`;
}

export function pageRows<T>(payload: Paginated<T> | T[] | null | undefined): Paginated<T> {
  if (!payload) return { current_page: 1, last_page: 1, data: [] };
  if (Array.isArray(payload)) return { current_page: 1, last_page: 1, data: payload };
  return { ...payload, data: Array.isArray(payload.data) ? payload.data : [] };
}
