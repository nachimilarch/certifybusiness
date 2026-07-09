import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "CertifyBusiness — ISO Certification, Training & Assessment",
    template: "%s | CertifyBusiness",
  },
  description:
    "ISO standards training, assessment, and certification for organisations of every size — from ODC's full ISO portfolio for medium & large enterprises to APTS's ISO 9001 specialisation for micro & small businesses.",
  icons: {
    icon: "/logo.jpeg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
