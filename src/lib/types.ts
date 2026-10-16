export type ApiEnvelope<T> = {
  code: number;
  message: string;
  success: boolean;
  data: T;
  errors?: string | Record<string, string[]>;
};

export type Category = {
  id: number;
  name: string;
  image?: string | null;
  sub_categories?: Category[];
};

export type Variation = {
  id: number;
  size?: string | null;
  colour?: string | null;
  available_quantity: number;
};

export type Product = {
  id: number;
  name: string;
  price: number;
  discounted_price?: number | null;
  image?: string | null;
  hsn_code?: string | null;
  category?: Category | null;
  sub_category?: Category | null;
  metric?: string | null;
  tax?: number | null;
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
  stocks: StockItem[] | { data: StockItem[]; current_page?: number; last_page?: number };
};

export type Customer = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  pincode?: string | null;
  auth_token?: string;
};

export type CartLine = {
  product: Product;
  qty: number;
  available_quantity: number;
  variation?: Variation;
};

export type Order = {
  id: number | string;
  created_at?: string;
  status?: string;
  payment_status?: string;
  grand_total?: number;
  total?: number;
  customer?: Customer;
  items?: Array<{ product?: Product; qty?: number; price?: number }>;
};