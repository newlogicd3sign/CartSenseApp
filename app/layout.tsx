import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "CartSense – AI Meal Planning That Adds Groceries to Your Cart",
  description: "Tell CartSense what you're craving. Get personalized meals with recipes and ingredients, then add everything to your Kroger cart with one click. Free to start.",
  manifest: "/manifest.json",
  themeColor: "#4A90E2",
  keywords: ["meal planning", "grocery shopping", "AI meals", "Kroger", "recipe generator", "shopping list", "meal prep", "dinner ideas"],
  authors: [{ name: "CartSense" }],
  creator: "CartSense",
  publisher: "CartSense",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CartSense",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://cartsense.app",
    siteName: "CartSense",
    title: "CartSense – AI Meal Planning That Adds Groceries to Your Cart",
    description: "Tell CartSense what you're craving. Get personalized meals with recipes, then add all ingredients to your Kroger cart with one click.",
    images: [
      {
        url: "https://cartsense.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "CartSense - AI Meal Planning and Grocery Shopping",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CartSense – AI Meal Planning That Adds Groceries to Your Cart",
    description: "Tell CartSense what you're craving. Get personalized meals with recipes, then add all ingredients to your Kroger cart with one click.",
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
