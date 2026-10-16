"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "@/lib/api";
import type { CartLine, Category, Customer, ProductPage, StockItem } from "@/lib/types";

type StoreContextValue = {
  customer: Customer | null;
  token: string | null;
  cart: CartLine[];
  categories: Category[];
  products: StockItem[];
  catalogLoading: boolean;
  catalogError: string;
  refreshCatalog: (search?: string) => Promise<void>;
  addToCart: (stock: StockItem, variationId?: number) => void;
  updateQuantity: (productId: number, variationId: number | undefined, qty: number) => void;
  removeFromCart: (productId: number, variationId?: number) => void;
  setSession: (customer: Customer, token: string) => void;
  clearSession: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<StockItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    const savedToken = localStorage.getItem("book-store-token");
    const savedCustomer = localStorage.getItem("book-store-customer");
    const savedCart = localStorage.getItem("book-store-cart");
    if (savedToken) setToken(savedToken);
    if (savedCustomer) setCustomer(JSON.parse(savedCustomer) as Customer);
    if (savedCart) setCart(JSON.parse(savedCart) as CartLine[]);
    void refreshCatalog();
  }, []);

  useEffect(() => {
    localStorage.setItem("book-store-cart", JSON.stringify(cart));
  }, [cart]);

  async function refreshCatalog(search = "") {
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const [categoryData, productData] = await Promise.all([
        apiRequest<Category[]>("/categories"),
        apiRequest<ProductPage>(`/products?stock_in=1${search ? `&product=${encodeURIComponent(search)}` : ""}`),
      ]);
      setCategories(categoryData);
      setProducts(
        (Array.isArray(productData.stocks) ? productData.stocks : productData.stocks.data).filter(
          (stock) =>
            stock.available_quantity > 0 &&
            (!stock.variations.length || stock.variations.some((variation) => variation.available_quantity > 0)),
        ),
      );
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "Unable to load books.");
    } finally {
      setCatalogLoading(false);
    }
  }

  function addToCart(stock: StockItem, variationId?: number) {
    const variation = stock.variations.find((item) => item.id === variationId);
    const available = variation?.available_quantity ?? stock.available_quantity;
    if (available <= 0) return;
    setCart((current) => {
      const existing = current.find(
        (line) => line.product.id === stock.product.id && line.variation?.id === variationId,
      );
      if (existing) {
        return current.map((line) =>
          line.product.id === stock.product.id && line.variation?.id === variationId
            ? { ...line, qty: Math.min(line.qty + 1, available) }
            : line,
        );
      }
      return [...current, { product: stock.product, qty: 1, available_quantity: available, variation }];
    });
  }

  function updateQuantity(productId: number, variationId: number | undefined, qty: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.product.id === productId && line.variation?.id === variationId
            ? { ...line, qty: Math.min(Math.max(0, qty), line.available_quantity) }
            : line,
        )
        .filter((line) => line.qty > 0),
    );
  }

  function removeFromCart(productId: number, variationId?: number) {
    setCart((current) =>
      current.filter((line) => !(line.product.id === productId && line.variation?.id === variationId)),
    );
  }

  function setSession(nextCustomer: Customer, nextToken: string) {
    setCustomer(nextCustomer);
    setToken(nextToken);
    localStorage.setItem("book-store-customer", JSON.stringify(nextCustomer));
    localStorage.setItem("book-store-token", nextToken);
  }

  function clearSession() {
    setCustomer(null);
    setToken(null);
    localStorage.removeItem("book-store-customer");
    localStorage.removeItem("book-store-token");
  }

  return (
    <StoreContext.Provider
      value={{
        customer,
        token,
        cart,
        categories,
        products,
        catalogLoading,
        catalogError,
        refreshCatalog,
        addToCart,
        updateQuantity,
        removeFromCart,
        setSession,
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