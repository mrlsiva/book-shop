import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { StoreProvider } from "@/context/store-context";
import { SiteFooter, SiteHeader } from "@/components/storefront";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const serif = Playfair_Display({ variable: "--font-serif", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Book store | Stories worth staying up for",
  description: "Find your next favourite at Book store.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <StoreProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </StoreProvider>
      </body>
    </html>
  );
}