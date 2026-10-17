"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { digitsOnly, PASSWORD_HINT, passwordProblem, profileProblem } from "@/lib/validation";
import { LoadingPage, Notice, PageHeading } from "@/components/storefront";

function RegisterContent() {
  const next = useSearchParams().get("next");
  const loginHref = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const fields = {
      name: value("name"),
      phone: digitsOnly(value("phone")),
      altPhone: digitsOnly(value("alt_phone")),
      address: value("address"),
      pincode: value("pincode"),
      gst: value("gst").toUpperCase(),
    };
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("password_confirmation") ?? "");
    const problem = profileProblem(fields) || passwordProblem(password) || (password !== confirmation ? "Your passwords do not match." : "");
    if (problem) return setError(problem);

    setBusy(true);
    try {
      await apiRequest("/customers/register", {
        method: "POST",
        body: JSON.stringify({
          name: fields.name,
          email: value("email") || undefined,
          phone: fields.phone,
          alt_phone: fields.altPhone || undefined,
          address: fields.address,
          pincode: fields.pincode || undefined,
          gst: fields.gst || undefined,
          password,
          password_confirmation: confirmation,
        }),
      });
      setRegistered(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="page-wrap" style={{ maxWidth: 680 }}>
    <PageHeading eyebrow="A place for your next chapter" title="Create an account" detail="Your phone number and a password are how you’ll sign in." />
    {registered ? <Notice message="Your account is ready. Sign in with your phone number and password to continue." action={<Link className="inline-link" href={loginHref}>Sign in</Link>} /> : <form className="form-stack" onSubmit={submit} noValidate>
      {error && <Notice tone="error" message={error} />}
      <div className="form-grid">
        <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" maxLength={50} required /></div>
        <div className="field"><label htmlFor="phone">Phone number</label><input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} required placeholder="10-digit mobile number" /></div>
        <div className="field"><label htmlFor="alt_phone">Alternate phone <span className="muted">(optional)</span></label><input id="alt_phone" name="alt_phone" type="tel" inputMode="numeric" maxLength={10} /></div>
        <div className="field"><label htmlFor="email">Email <span className="muted">(optional)</span></label><input id="email" name="email" type="email" autoComplete="email" /></div>
      </div>
      <div className="field"><label htmlFor="address">Delivery address</label><textarea id="address" name="address" autoComplete="street-address" maxLength={200} required /></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="pincode">Pincode <span className="muted">(optional)</span></label><input id="pincode" name="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} /></div>
        <div className="field"><label htmlFor="gst">GSTIN <span className="muted">(optional, for business invoices)</span></label><input id="gst" name="gst" maxLength={15} style={{ textTransform: "uppercase" }} /></div>
      </div>
      <div className="form-grid">
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" required maxLength={20} aria-describedby="password-hint" /></div>
        <div className="field"><label htmlFor="password_confirmation">Confirm password</label><input id="password_confirmation" name="password_confirmation" type="password" autoComplete="new-password" required maxLength={20} /></div>
      </div>
      <p className="muted" id="password-hint">{PASSWORD_HINT}</p>
      <button className="button button-dark" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}<span aria-hidden="true">→</span></button>
      <p className="muted">Already have an account? <Link className="inline-link" href={loginHref}>Sign in</Link></p>
    </form>}
  </main>;
}

export default function RegisterPage() {
  return <Suspense fallback={<LoadingPage label="Loading…" />}><RegisterContent /></Suspense>;
}
