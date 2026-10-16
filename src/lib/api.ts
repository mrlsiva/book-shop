import type { ApiEnvelope, ProductPage } from "@/lib/types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/users/book";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("We could not reach the bookstore right now.");
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    const detail =
      typeof payload.errors === "string"
        ? payload.errors
        : payload.message || "Something went wrong. Please try again.";
    throw new ApiError(detail, response.status);
  }
  return payload.data;
}

export function stockRows(page: ProductPage | undefined) {
  if (!page) return [];
  return Array.isArray(page.stocks) ? page.stocks : page.stocks.data;
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}