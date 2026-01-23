import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#4A90E2",
};

export const metadata: Metadata = {
  title: "CartSense | Recipe Generator to your Cart",
  description: "Turn AI-generated recipes into a full grocery cart in seconds.",
  manifest: "/manifest.json",
  keywords: ["meal planning", "grocery shopping", "AI meals", "recipe generator", "shopping list", "meal prep", "dinner ideas"],
  authors: [{ name: "CartSense" }],
  creator: "CartSense",
  publisher: "CartSense",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CartSense",
  },
  // Icons are automatically handled by app/icon.svg and app/apple-icon.png
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://cartsense.app",
    siteName: "CartSense",
    title: "CartSense | Recipe Generator to your Cart",
    description: "Turn AI-generated recipes into a full grocery cart in seconds.",
    images: [
      {
        url: "https://cartsense.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "CartSense - AI Recipe Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CartSense | Recipe Generator to your Cart",
    description: "Turn AI-generated recipes into a full grocery cart in seconds.",
    images: ["https://cartsense.app/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
