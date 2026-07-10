"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";

const LINKS = [
  { label: "Who We Serve", href: "#who-we-serve" },
  { label: "Standards", href: "#standards" },
  { label: "Process", href: "#process" },
  { label: "FAQ", href: "#faq" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.jpeg"
            alt="ODCAPTS ISO Certifications Services"
            width={48}
            height={48}
            className="rounded-lg object-contain"
            priority
          />
          <span className="leading-tight">
            <span className="block font-bold text-gray-900 text-base">CertifyBusiness</span>
            <span className="block text-xs text-teal-700 font-medium">ODCAPTS ISO Certifications Services</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-gray-600 hover:text-teal-700 transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold text-gray-700 hover:text-teal-700 transition-colors"
          >
            Sign in
          </Link>
          <a
            href="#enquiry"
            className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 transition-colors"
          >
            Request a Quote
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          onClick={() => setOpen((p) => !p)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-1">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {l.label}
            </a>
          ))}
          <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-semibold text-gray-700"
            >
              Sign in
            </Link>
            <a
              href="#enquiry"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-teal-800 px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              Request a Quote
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
