"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  apiRequest,
  defaultVariation,
  fetchStockPage,
  isInStock,
  onUnauthorized,
  stockPage,
  unitPrice,
  unitTax,
  variationLabel,
} from "@/lib/api";
import type { CartLine, Category, Customer, StockItem } from "@/lib/types";

const TOKEN_KEY = "book-store-token";
const CUSTOMER_KEY = "book-store-customer";
const CART_KEY = "book-store-cart-v2";

export type CatalogQuery = { search: string; category: Category | null };

type StoreContextValue = {
  customer: Customer | null;
  token: string | null;
  cart: CartLine[];
  ready: boolean;
  categories: Category[];
  products: StockItem[];
  catalogQuery: CatalogQuery;
  catalogLoading: boolean;
  catalogLoadingMore: boolean;
  catalogHasMore: boolean;
  catalogError: string;
  loadCatalog: (query?: Partial<CatalogQuery>) => Promise<void>;
  loadMoreCatalog: () => Promise<void>;
  addToCart: (stock: StockItem, variationId?: number, qty?: number) => boolean;
  updateQuantity: (line: CartLine, qty: number) => void;
  removeFromCart: (line: CartLine) => void;
  clearCart: () => void;
  setSession: (customer: Customer, token: string) => void;
  updateCustomer: (customer: Customer) => void;
  clearSession: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function sameLine(line: CartLine, productId: number, variationId?: number) {
  return line.productId === productId && line.variationId === variationId;
}

function readCart(): CartLine[] {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as CartLine[];
    return Array.isArray(saved)
      ? saved.filter((line) => line && typeof line.productId === "number" && line.qty > 0 && Number.isFinite(line.unitPrice))
      : [];
  } catch {
    return [];
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<StockItem[]>([]);
  const [catalogQuery, setCatalogQuery] = useState<CatalogQuery>({ search: "", category: null });
  const [catalogPage, setCatalogPage] = useState({ current: 0, last: 1 });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const requestId = useRef(0);

  const clearSession = useCallback(() => {
    setCustomer(null);
    setToken(null);
    localStorage.removeItem(CUSTOMER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  const fetchCatalogPage = useCallback(async (query: CatalogQuery, page: number) => {
    // The API only searches by text (product, category or sub-category name),
    // so a category is browsed by searching its name and keeping exact matches.
    const result = stockPage(await fetchStockPage(query.category?.name ?? query.search.trim(), page));
    const rows = result.data.filter(
      (stock) => isInStock(stock) && (!query.category || stock.product.category?.id === query.category.id),
    );
    return { rows, current: result.current_page, last: result.last_page };
  }, []);

  const loadCatalog = useCallback(async (next: Partial<CatalogQuery> = {}) => {
    const query = { search: "", category: null, ...next };
    const id = ++requestId.current;
    setCatalogQuery(query);
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const page = await fetchCatalogPage(query, 1);
      if (id !== requestId.current) return;
      setProducts(page.rows);
      setCatalogPage({ current: page.current, last: page.last });
    } catch (error) {
      if (id !== requestId.current) return;
      setProducts([]);
      setCatalogError(error instanceof Error ? error.message : "Unable to load books.");
    } finally {
      if (id === requestId.current) setCatalogLoading(false);
    }
  }, [fetchCatalogPage]);

  async function loadMoreCatalog() {
    if (catalogLoadingMore || catalogPage.current >= catalogPage.last) return;
    const id = requestId.current;
    setCatalogLoadingMore(true);
    try {
      const page = await fetchCatalogPage(catalogQuery, catalogPage.current + 1);
      if (id !== requestId.current) return;
      setProducts((current) => {
        const seen = new Set(current.map((stock) => stock.product.id));
        return [...current, ...page.rows.filter((stock) => !seen.has(stock.product.id))];
      });
      setCatalogPage({ current: page.current, last: page.last });
    } catch (error) {
      if (id === requestId.current) setCatalogError(error instanceof Error ? error.message : "Unable to load more books.");
    } finally {
      setCatalogLoadingMore(false);
    }
  }

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedCustomer = localStorage.getItem(CUSTOMER_KEY);
    const savedCart = readCart();
    localStorage.removeItem("book-store-cart"); // pre-v2 cart format
    void Promise.resolve().then(() => {
      if (savedToken && savedCustomer) {
        try {
          setCustomer(JSON.parse(savedCustomer) as Customer);
          setToken(savedToken);
        } catch {
          clearSession();
        }
      }
      setCart(savedCart);
      setReady(true);
      void loadCatalog();
    });
    void apiRequest<Category[]>("/categories").then(setCategories).catch(() => setCategories([]));
  }, [clearSession, loadCatalog]);

  useEffect(() => {
    onUnauthorized(clearSession);
    return () => onUnauthorized(null);
  }, [clearSession]);

  useEffect(() => {
    if (ready) localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, ready]);

  function addToCart(stock: StockItem, variationId?: number, qty = 1) {
    const variation = variationId === undefined ? defaultVariation(stock) : stock.variations.find((item) => item.id === variationId);
    const maxQty = Math.min(stock.available_quantity, variation?.available_quantity ?? Infinity);
    if (maxQty <= 0 || (variationId !== undefined && !variation)) return false;
    const { product } = stock;
    setCart((current) => {
      const existing = current.find((line) => sameLine(line, product.id, variation?.id));
      if (existing) {
        return current.map((line) => (line === existing ? { ...line, maxQty, qty: Math.min(line.qty + qty, maxQty) } : line));
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          categoryName: product.category?.name,
          unitPrice: unitPrice(product),
          unitTax: unitTax(product),
          qty: Math.min(qty, maxQty),
          maxQty,
          variationId: variation?.id,
          variationLabel: variation ? variationLabel(variation) || undefined : undefined,
        },
      ];
    });
    return true;
  }

  function updateQuantity(target: CartLine, qty: number) {
    setCart((current) =>
      current
        .map((line) =>
          sameLine(line, target.productId, target.variationId) ? { ...line, qty: Math.min(Math.max(0, qty), line.maxQty) } : line,
        )
        .filter((line) => line.qty > 0),
    );
  }

  function removeFromCart(target: CartLine) {
    setCart((current) => current.filter((line) => !sameLine(line, target.productId, target.variationId)));
  }

  function clearCart() {
    setCart([]);
  }

  function setSession(nextCustomer: Customer, nextToken: string) {
    const { auth_token: _omit, ...profile } = nextCustomer;
    void _omit;
    setCustomer(profile);
    setToken(nextToken);
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(profile));
    localStorage.setItem(TOKEN_KEY, nextToken);
  }

  const updateCustomer = useCallback((nextCustomer: Customer) => {
    setCustomer(nextCustomer);
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(nextCustomer));
  }, []);

  return (
    <StoreContext.Provider
      value={{
        customer,
        token,
        cart,
        ready,
        categories,
        products,
        catalogQuery,
        catalogLoading,
        catalogLoadingMore,
        catalogHasMore: catalogPage.current < catalogPage.last,
        catalogError,
        loadCatalog,
        loadMoreCatalog,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        setSession,
        updateCustomer,
        clearSession,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used within StoreProvider");
  return value;
}

/** Shared helpers for anything that totals the bag. */
export function cartTotals(cart: CartLine[]) {
  return cart.reduce(
    (totals, line) => ({
      count: totals.count + line.qty,
      total: totals.total + line.unitPrice * line.qty,
      tax: totals.tax + line.unitTax * line.qty,
    }),
    { count: 0, total: 0, tax: 0 },
  );
}
