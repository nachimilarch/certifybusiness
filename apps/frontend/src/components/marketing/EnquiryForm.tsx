"use client";

import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";

const CONTACT_EMAIL = "madhavi@odchyd.com";

const INTEREST_OPTIONS = [
  { id: "data-privacy", label: "Data Privacy Standards" },
  { id: "esg", label: "ESG Standards" },
  { id: "industry", label: "Industry Standards" },
  { id: "iso-9001", label: "ISO 9001 (Micro & Small Business)" },
  { id: "other", label: "Other / Not sure yet" },
];

const TIMELINE_OPTIONS = [
  "Within 1 month",
  "1–3 months",
  "3–6 months",
  "6–12 months",
  "Not decided yet",
];

function fieldLabel(text: string, required = false) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-gray-700">
      {text} {required && <span className="text-red-500">*</span>}
    </span>
  );
}

export function EnquiryForm() {
  const [interests, setInterests] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  function toggleInterest(id: string) {
    setInterests((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (name: string) => (form.get(name) as string)?.trim() ?? "";

    const interestLabels = INTEREST_OPTIONS.filter((o) => interests.includes(o.id)).map(
      (o) => o.label
    );

    const bodyLines = [
      `Company Name: ${get("companyName")}`,
      `Contact Person: ${get("contactName")}`,
      `Email: ${get("email")}`,
      `Phone: ${get("phone")}`,
      `Nature of Business: ${get("natureOfBusiness") || "—"}`,
      `Existing Certifications: ${get("existingCertifications") || "—"}`,
      `Certifications Interested: ${interestLabels.join(", ") || "—"}`,
      `Specific Standards: ${get("specificStandards") || "—"}`,
      `Certification Target: ${get("timeline") || "—"}`,
      "",
      "Additional Notes:",
      get("notes") || "—",
    ];

    const subject = encodeURIComponent(`RFQ – Request for Quotation: ${get("companyName")}`);
    const body = encodeURIComponent(bodyLines.join("\n"));
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-10 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-teal-700 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">Your email client should be open</h3>
        <p className="text-sm text-gray-600 max-w-md mx-auto">
          We've pre-filled your enquiry — just hit send. If nothing opened, email us directly at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-teal-800 underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-6 text-sm font-semibold text-teal-800 hover:text-teal-900"
        >
          &larr; Edit and send again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label className="block">
          {fieldLabel("Company Name", true)}
          <input
            name="companyName"
            required
            type="text"
            placeholder="Acme Manufacturing Pvt. Ltd."
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          />
        </label>
        <label className="block">
          {fieldLabel("Contact Person", true)}
          <input
            name="contactName"
            required
            type="text"
            placeholder="Your full name"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          />
        </label>
        <label className="block">
          {fieldLabel("Email", true)}
          <input
            name="email"
            required
            type="email"
            placeholder="you@company.com"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          />
        </label>
        <label className="block">
          {fieldLabel("Phone / Mobile", true)}
          <input
            name="phone"
            required
            type="tel"
            placeholder="+91 XXXXX XXXXX"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          />
        </label>
        <label className="block sm:col-span-2">
          {fieldLabel("Nature of Business (Products / Services)")}
          <input
            name="natureOfBusiness"
            type="text"
            placeholder="e.g. Food processing, IT services, medical devices..."
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          />
        </label>
        <label className="block sm:col-span-2">
          {fieldLabel("Existing Certifications, if any")}
          <input
            name="existingCertifications"
            type="text"
            placeholder="e.g. ISO 9001:2015 since 2021"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          />
        </label>

        <div className="sm:col-span-2">
          {fieldLabel("Certifications Interested", true)}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {INTEREST_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2.5 rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-700 cursor-pointer hover:border-teal-300 hover:bg-teal-50/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={interests.includes(opt.id)}
                  onChange={() => toggleInterest(opt.id)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-700 focus:ring-teal-600"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <label className="block sm:col-span-2">
          {fieldLabel("Specific Standards (if known)")}
          <input
            name="specificStandards"
            type="text"
            placeholder="e.g. ISO 27001, ISO 22000, ISO 45001..."
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          />
        </label>

        <label className="block sm:col-span-2">
          {fieldLabel("Certification Target (By When)")}
          <select
            name="timeline"
            defaultValue=""
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          >
            <option value="" disabled>
              Select a timeline
            </option>
            {TIMELINE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          {fieldLabel("Additional Notes")}
          <textarea
            name="notes"
            rows={3}
            placeholder="Anything else we should know..."
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
          />
        </label>
      </div>

      <button
        type="submit"
        className="mt-7 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-teal-800 px-8 py-3.5 text-sm font-bold text-white hover:bg-teal-900 transition-colors"
      >
        Send Enquiry <Send className="h-4 w-4" />
      </button>
      <p className="mt-3 text-xs text-gray-400">
        This opens your email client with the details above, addressed to our team — nothing is sent automatically.
      </p>
    </form>
  );
}
