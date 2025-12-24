import type { Metadata } from "next";
import "./globals.css";
import { inter } from "./fonts";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://twinmile.com"),
  title: {
    default: "Twin Mile LLC",
    template: "%s | Twin Mile LLC",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png" },
    ],
    apple: "/icon.png",
  },
  description:
    "Twin Mile LLC delivers fast, reliable, rugged logistics solutions nationwide — freight transportation, hotshot trucking, last‑mile delivery, dispatching, warehousing, and 3PL.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://twinmile.com",
    siteName: "Twin Mile LLC",
    title: "Twin Mile LLC",
    description:
      "Fast. Tough. Reliable. Logistics built for the urgent — nationwide freight, hotshot, last‑mile, dispatching, warehousing, and 3PL.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Twin Mile LLC",
    description:
      "Fast, reliable, rugged logistics solutions nationwide. Get a quote or drive with us.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
