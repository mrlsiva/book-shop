"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ConfirmationClient } from "@/components/confirmation-client";
import { LoadingPage } from "@/components/storefront";

function ConfirmationContent() {
  const params = useSearchParams();
  return <ConfirmationClient method={params.get("method") ?? ""} orderId={params.get("id") ?? ""} />;
}

export default function ConfirmationPage() {
  return <Suspense fallback={<LoadingPage label="Preparing your confirmation…" />}><ConfirmationContent /></Suspense>;
}
