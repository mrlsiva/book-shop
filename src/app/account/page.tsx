"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { digitsOnly, PASSWORD_HINT, passwordProblem, profileProblem } from "@/lib/validation";
import { useStore } from "@/context/store-context";
import type { Customer } from "@/lib/types";
import { LoadingPage, Notice, PageHeading } from "@/components/storefront";

const heading = { fontFamily: "var(--font-serif)", fontWeight: 500 } as const;

export default function AccountPage() {
  const router = useRouter();
  const { customer, token, ready, clearSession, updateCustomer } = useStore();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"" | "profile" | "password">("");
  const [formKey, setFormKey] = useState(0);
  const signingOut = useRef(false);

  useEffect(() => {
    if (!ready || signingOut.current) return;
    if (!token) {
      router.replace("/login?next=/account");
      return;
    }
    let cancelled = false;
    void apiRequest<Customer>("/profile/view", {}, token)
      .then((profile) => {
        if (cancelled) return;
        updateCustomer(profile);
        setFormKey((key) => key + 1);
      })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load your profile."); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [ready, router, token, updateCustomer]);

  async function save(body: Record<string, unknown>, kind: "profile" | "password", success: string) {
    setBusy(kind);
    setError("");
    setMessage("");
    try {
      await apiRequest("/profile/update", { method: "POST", body: JSON.stringify(body) }, token);
      const profile = await apiRequest<Customer>("/profile/view", {}, token);
      updateCustomer(profile);
      setFormKey((key) => key + 1);
      setMessage(success);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update your details.");
      return false;
    } finally {
      setBusy("");
    }
  }

  function profileBody(form: FormData | null) {
    const record = customer?.customer;
    const value = (key: string, fallback?: string | null) => (form ? String(form.get(key) ?? "").trim() : (fallback ?? "").trim());
    return {
      name: value("name", customer?.name),
      email: value("email", customer?.email) || null,
      // The API checks alt_phone is `different:phone`, which fails if phone is absent.
      phone: customer?.phone,
      alt_phone: digitsOnly(value("alt_phone", record?.alt_phone ?? customer?.alt_phone)) || null,
      address: value("address", record?.address),
      pincode: value("pincode", record?.pincode) || null,
      gst: value("gst", record?.gst).toUpperCase() || null,
    };
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = profileBody(new FormData(event.currentTarget));
    const problem = profileProblem({ name: body.name, altPhone: body.alt_phone ?? "", address: body.address, pincode: body.pincode ?? "", gst: body.gst ?? "" })
      || (body.alt_phone && body.alt_phone === customer?.phone ? "Your alternate phone must differ from your main phone." : "");
    if (problem) return setError(problem);
    await save(body, "profile", "Your details have been updated.");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("password_confirmation") ?? "");
    const problem = passwordProblem(password) || (password !== confirmation ? "Your new passwords do not match." : "");
    if (problem) return setError(problem);
    // The update endpoint also requires the profile fields, so resend what's on file.
    const base = profileBody(null);
    if (!base.address) return setError("Add a delivery address to your details before changing your password.");
    if (await save({ ...base, password, password_confirmation: confirmation }, "password", "Your password has been changed.")) formElement.reset();
  }

  if (!ready || !customer || !token) return <LoadingPage label="Loading your account…" />;
  const record = customer.customer;

  return <main className="page-wrap">
    <PageHeading eyebrow="Your account" title={`Hello, ${customer.name.split(" ")[0]}`} detail="Keep your delivery details current and find your recent orders." />
    {error && <Notice tone="error" message={error} />}{message && <Notice message={message} />}
    <div className="split-layout">
      <div className="form-stack">
        <form className="form-stack" onSubmit={updateProfile} key={formKey} noValidate>
          <h2 style={heading}>Your details</h2>
          {!loaded && <p className="muted">Refreshing your details…</p>}
          <div className="form-grid">
            <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" maxLength={50} required defaultValue={customer.name} /></div>
            <div className="field"><label htmlFor="phone">Phone number</label><input id="phone" value={customer.phone} readOnly disabled aria-describedby="phone-note" /><span className="muted" id="phone-note" style={{ fontSize: 11 }}>Your sign-in number can’t be changed here.</span></div>
            <div className="field"><label htmlFor="alt_phone">Alternate phone <span className="muted">(optional)</span></label><input id="alt_phone" name="alt_phone" type="tel" inputMode="numeric" maxLength={10} defaultValue={record?.alt_phone ?? customer.alt_phone ?? ""} /></div>
            <div className="field"><label htmlFor="email">Email <span className="muted">(optional)</span></label><input id="email" name="email" type="email" autoComplete="email" defaultValue={customer.email ?? ""} /></div>
          </div>
          <div className="field"><label htmlFor="address">Delivery address</label><textarea id="address" name="address" autoComplete="street-address" maxLength={200} required defaultValue={record?.address ?? ""} /></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="pincode">Pincode <span className="muted">(optional)</span></label><input id="pincode" name="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} defaultValue={record?.pincode ?? ""} /></div>
            <div className="field"><label htmlFor="gst">GSTIN <span className="muted">(optional)</span></label><input id="gst" name="gst" maxLength={15} style={{ textTransform: "uppercase" }} defaultValue={record?.gst ?? ""} /></div>
          </div>
          <button className="button button-dark" type="submit" disabled={busy !== ""}>{busy === "profile" ? "Saving…" : "Save details"}</button>
        </form>

        <form className="form-stack" onSubmit={changePassword} style={{ marginTop: 30 }} noValidate>
          <h2 style={heading}>Change password</h2>
          <div className="form-grid">
            <div className="field"><label htmlFor="new-password">New password</label><input id="new-password" name="password" type="password" autoComplete="new-password" maxLength={20} required aria-describedby="new-password-hint" /></div>
            <div className="field"><label htmlFor="new-password-confirmation">Confirm new password</label><input id="new-password-confirmation" name="password_confirmation" type="password" autoComplete="new-password" maxLength={20} required /></div>
          </div>
          <p className="muted" id="new-password-hint">{PASSWORD_HINT}</p>
          <button className="button button-outline" type="submit" disabled={busy !== ""}>{busy === "password" ? "Updating…" : "Change password"}</button>
        </form>
      </div>
      <aside className="panel">
        <h2 style={heading}>Your bookstore</h2>
        <p><Link className="inline-link" href="/orders">View order history →</Link></p>
        <p className="muted">Signed in with {customer.phone}</p>
        <button className="text-button" onClick={() => { signingOut.current = true; clearSession(); router.push("/"); }}>Sign out on this device</button>
      </aside>
    </div>
  </main>;
}
