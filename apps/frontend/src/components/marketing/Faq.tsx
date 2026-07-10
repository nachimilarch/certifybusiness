"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "What's the difference between ODC Standards Certifications and APTS Quality Certifications?",
    a: "They serve different-sized organisations under the same ODCAPTS ISO Certifications Services umbrella. ODC Standards Certifications works with medium and large organisations across the full portfolio of 21+ ISO standards — quality, food safety, information security, business continuity, privacy, environment, health & safety, energy, IT service management, CSR, asset management, facility management, medical devices, and more. APTS Quality Certifications focuses exclusively on micro and small businesses, specialising in one standard — ISO 9001 (Quality Management Systems) — so smaller teams get a focused, affordable path to certification.",
  },
  {
    q: "Which ISO standards do you cover?",
    a: "Standards are grouped into three areas — Data Privacy (ISO 27001, 27701, 27017, 27018, DPDPA, HIPAA, GDPR, SOC2), ESG (ISO 14001, 45001, 50001, 26000, 14064, 14067, 14068, GRI, BRSR, UN SDGs, SA 8000, FSSC), and Industry Standards (ISO 42001, 22000, 13485, 21001, 9001, 41001, 22301, 20000, 20400, 28001, 37001, CMMI, NABH, NABL, HACCP/FSSC). If your business is micro or small and only needs ISO 9001, our APTS track is built specifically for that.",
  },
  {
    q: "What does the certification process actually involve?",
    a: "Four stages: training on system documentation, training on system implementation, training on system assessment, and training on system certification. We take you from a blank slate to certification-ready across each stage rather than just handing over paperwork.",
  },
  {
    q: "Can you help with more than one standard at once (an integrated management system)?",
    a: "Yes — many of our medium and large clients pursue an integrated approach, e.g. combining ISO 9001 (Quality) with ISO 45001 (Occupational Health & Safety) and ISO 14001 (Environment) under a single engagement. Tell us your standards of interest in the enquiry form and we'll scope it accordingly.",
  },
  {
    q: "What are the practical benefits of getting certified?",
    a: "Beyond the certificate itself: improved customer satisfaction, streamlined systems for growth, better performance management, reduced costs/waste, easier decision-making, stronger risk management, better problem-solving, a better work environment, and eligibility for tenders and supplier registrations that require certification as a prerequisite.",
  },
  {
    q: "How do I get started?",
    a: "Fill in the Request a Quote form with your company details and the standards you're interested in, or reach out directly by phone, email, or WhatsApp. We'll get back to you to scope your engagement and recommend the right track — ODC or APTS.",
  },
];

export function MarketingFaq() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {FAQS.map((faq, i) => (
        <div key={i}>
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="flex w-full items-center justify-between px-6 py-5 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-gray-900 text-sm pr-8">{faq.q}</span>
            <ChevronDown
              className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${openIdx === i ? "rotate-180" : ""}`}
            />
          </button>
          {openIdx === i && (
            <div className="px-6 pb-5">
              <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
