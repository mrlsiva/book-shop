"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api";
import { digitsOnly, isPhone } from "@/lib/validation";
import { useStore } from "@/context/store-context";
import type { Customer } from "@/lib/types";
import { LoadingPage, Notice, PageHeading } from "@/components/storefront";

/** Only follow same-site relative paths after sign-in. */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

function LoginContent() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { setSession, customer, ready } = useStore();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && customer) router.replace(next);
  }, [customer, next, ready, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!isPhone(phone)) return setError("Enter a valid 10-digit phone number.");
    setBusy(true);
    try {
      const user = await apiRequest<Customer>("/customers/login", {
        method: "POST",
        body: JSON.stringify({ phone, password }),
      });
      if (!user.auth_token) throw new Error("We could not sign you in. Please try again.");
      setSession(user, user.auth_token);
      router.replace(next);
    } catch (reason) {
      // The API errors (500) instead of 400 when no account has this phone number.
      const unknownPhone = reason instanceof ApiError && (reason.status ?? 0) >= 500;
      setError(unknownPhone ? "That phone number and password don’t match an account." : reason instanceof Error ? reason.message : "We could not sign you in.");
      setBusy(false);
    }
  }

  if (!ready || customer) return <LoadingPage label="Signing you in…" />;

  return <main className="page-wrap" style={{ maxWidth: 560 }}>
    <PageHeading eyebrow="Welcome back" title="Sign in" detail={next === "/checkout" ? "Sign in to finish your order. Your bag is saved." : "Use the phone number and password linked to your account."} />
    <form className="form-stack" onSubmit={submit}>
      {error && <Notice tone="error" message={error} />}
      <div className="field"><label htmlFor="phone">Phone number</label><input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} required value={phone} onChange={(event) => setPhone(digitsOnly(event.target.value))} placeholder="10-digit mobile number" /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
      <button className="button button-dark" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<span aria-hidden="true">→</span></button>
      <p className="muted">New to Book store? <Link className="inline-link" href={`/register${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link></p>
    </form>
  </main>;
}

export default function LoginPage() {
  return <Suspense fallback={<LoadingPage label="Loading…" />}><LoginContent /></Suspense>;
}
