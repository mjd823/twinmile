import type { Metadata } from "next";
import "./globals.css";
import { inter } from "./fonts";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import Script from "next/script";

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
  keywords: [
    "freight transportation",
    "hotshot trucking",
    "last mile delivery",
    "dispatching services",
    "warehousing",
    "3PL services",
    "logistics company",
    "Houston logistics",
    "Texas freight",
    "nationwide shipping",
    "owner operator jobs",
    "power only trucking",
  ],
  authors: [{ name: "Twin Mile LLC", url: "https://twinmile.com" }],
  creator: "Twin Mile LLC",
  publisher: "Twin Mile LLC",
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
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "Twin Mile LLC — Fast. Tough. Reliable.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Twin Mile LLC",
    description:
      "Fast, reliable, rugged logistics solutions nationwide. Get a quote or drive with us.",
    images: ["/og.svg"],
    creator: "@twinmilellc",
    site: "@twinmilellc",
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
  verification: {
    google: "your-google-verification-code", // Add when available
    yandex: "your-yandex-verification-code", // Add when available
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <head>
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://twinmile.com" />
        
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-RQ0CTNQDNY"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-RQ0CTNQDNY', {
              page_title: document.title,
              page_location: window.location.href,
              send_page_view: false,
            });
            
            // Send page view after config
            gtag('event', 'page_view', {
              page_title: document.title,
              page_location: window.location.href,
            });
          `}
        </Script>
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
