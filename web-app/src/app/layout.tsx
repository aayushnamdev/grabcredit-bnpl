import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PersonaProvider } from "@/components/PersonaContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GrabCredit BNPL Checkout",
  description: "AI-powered Buy Now, Pay Later credit scoring system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <PersonaProvider>{children}</PersonaProvider>
      </body>
    </html>
  );
}
