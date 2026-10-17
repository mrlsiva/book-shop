// A Razorpay payment the customer completed but whose order the backend
// webhook may not have created yet. Kept in sessionStorage so a refresh of the
// confirmation page keeps checking for it.
const KEY = "book-store-pending-payment";

export type PendingPayment = {
  razorpayOrderId: string;
  amount: number;
  /** Newest order id that existed before payment; the new order will be newer. */
  lastOrderId: number;
  startedAt: number;
};

export function savePendingPayment(payment: PendingPayment) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payment));
  } catch {
    // Storage unavailable: the confirmation page falls back to order history.
  }
}

export function readPendingPayment(): PendingPayment | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as PendingPayment | null;
    return value && typeof value.amount === "number" ? value : null;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
