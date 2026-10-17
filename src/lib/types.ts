// Shapes as actually returned by the Sling API. Laravel serialises decimal
// columns as strings, so numeric fields are typed `number | string` and read
// through `toNumber()`.
type Numeric = number | string;

export type ApiEnvelope<T> = {
  code: number;
  message: string | null;
  success: boolean;
  data: T;
  errors?: string | string[] | Record<string, string[] | string> | null;
};

export type Paginated<T> = {
  current_page: number;
  last_page: number;
  per_page?: number;
  total?: number;
  data: T[];
};

export type Category = {
  id: number;
  name: string;
  image?: string | null;
  sub_categories?: Category[];
};

/** Size / colour come back as related models (or null for a plain product). */
export type VariantAttribute = { id: number; name: string } | string | null;

export type Variation = {
  id: number;
  size?: VariantAttribute;
  colour?: VariantAttribute;
  available_quantity: number;
};

export type Product = {
  id: number;
  name: string;
  description?: string | null;
  price: Numeric;
  discounted_price?: Numeric | null;
  /** Per-unit GST already contained in `price`. */
  tax_amount?: Numeric | null;
  image?: string | null;
  hsn_code?: string | null;
  category?: Category | null;
  sub_category?: Category | null;
  metric?: { id: number; name: string } | null;
};

export type StockItem = {
  available_quantity: number;
  quantity: number;
  queue_qty: number;
  product: Product;
  variations: Variation[];
};

export type ProductPage = {
  categories: Category[];
  stocks: Paginated<StockItem> | StockItem[];
};

export type CustomerRecord = {
  id: number;
  name: string;
  phone: string;
  alt_phone?: string | null;
  address?: string | null;
  pincode?: string | null;
  gst?: string | null;
};

/** The logged-in e-commerce user. `customer_id` is what orders are keyed on. */
export type Customer = {
  id: number;
  customer_id: number;
  name: string;
  phone: string;
  alt_phone?: string | null;
  email?: string | null;
  customer?: CustomerRecord | null;
  auth_token?: string;
};

export type CartLine = {
  productId: number;
  name: string;
  categoryName?: string;
  /** GST-inclusive unit price actually charged. */
  unitPrice: number;
  /** GST portion of `unitPrice`, for receipts only. */
  unitTax: number;
  qty: number;
  maxQty: number;
  variationId?: number;
  variationLabel?: string;
};

export type Order = {
  id: number;
  bill_id?: string | null;
  bill_amount?: Numeric | null;
  order_discount?: Numeric | null;
  total_product_discount?: Numeric | null;
  billed_on?: string | null;
  created_at?: string | null;
  status?: number | null;
  is_paid?: number | boolean | null;
  customer?: CustomerRecord | null;
  billing_address?: { name?: string | null; phone?: string | null; address?: string | null; pincode?: string | null } | null;
};

export type OrderDetail = {
  id: number;
  product_id: number;
  name: string;
  quantity: Numeric;
  price: Numeric;
  tax_amount?: Numeric | null;
  tax_percent?: string | null;
};

export type OrderPayment = {
  id: number;
  amount: Numeric;
  number?: string | null;
  payment?: { name?: string } | null;
};

export type OrderView = {
  order: Order | null;
  order_details: OrderDetail[];
  order_payment_details: OrderPayment[];
};
