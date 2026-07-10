import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "CertifyBusiness — ODCAPTS ISO Certifications Services",
    template: "%s | CertifyBusiness by ODCAPTS ISO Certifications Services",
  },
  description:
    "CertifyBusiness, the certification brand of ODCAPTS ISO Certifications Services, offers ISO standards training, assessment, and certification for organisations of every size — ODC's full portfolio for medium & large enterprises, and APTS's ISO 9001 specialisation for micro & small businesses.",
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
