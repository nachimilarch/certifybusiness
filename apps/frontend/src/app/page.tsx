import Link from "next/link";
import Image from "next/image";
import {
  Building2,
  Store,
  Lock,
  Leaf,
  Factory,
  Award,
  Smile,
  TrendingUp,
  Gauge,
  PiggyBank,
  Lightbulb,
  ShieldCheck,
  Puzzle,
  HeartHandshake,
  ClipboardCheck,
  CheckCircle,
  ArrowRight,
  Phone,
  Mail,
  MessageCircle,
} from "lucide-react";
import { MarketingNav } from "../components/marketing/Nav";
import { MarketingFaq } from "../components/marketing/Faq";
import { EnquiryForm } from "../components/marketing/EnquiryForm";

// ─── Contact ────────────────────────────────────────────────────────────────────

const CONTACT = {
  name: "Mrs. J Naga Madhavi",
  title: "CEO, ODCAPTS ISO Certifications Services",
  email: "madhavi@odchyd.com",
  phones: ["9866182520", "9391147697"],
};
const WHATSAPP_NUMBER = "919866182520";

// ─── Data ──────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "21+", label: "ISO standards covered" },
  { value: "2", label: "Specialised divisions" },
  { value: "Micro–Enterprise", label: "Every business size" },
  { value: "4", label: "Stage certification process" },
];

const WHO_WE_SERVE = [
  {
    icon: <Building2 className="h-8 w-8 text-teal-800" />,
    name: "ODC Standards Certifications",
    audience: "Medium & Large Organisations",
    desc: "Full-portfolio ISO Standards Training, Assessment and Certification. Promotes adoption of 21+ ISO standards spanning Quality, Food Safety, Information Security, Business Continuity, Privacy Management, Environment, Occupational Health & Safety, Energy, IT Service Management, CSR, Asset Management, Facility Management, Medical Devices, and more.",
  },
  {
    icon: <Store className="h-8 w-8 text-amber-600" />,
    name: "APTS Quality Certifications",
    audience: "Micro & Small Organisations",
    desc: "Serves micro and small organisations across every sector, specialising in a single standard — ISO 9001 (Quality Management Systems) — so smaller teams get a focused, affordable, no-frills path to certification.",
  },
];

const STANDARDS = [
  {
    icon: <Lock className="h-7 w-7 text-teal-800" />,
    title: "Data Privacy Standards",
    codes: "ISO 27001, ISO 27701, ISO 27017, ISO 27018, DPDPA, HIPAA, GDPR, SOC2, and more",
  },
  {
    icon: <Leaf className="h-7 w-7 text-teal-800" />,
    title: "ESG Standards",
    codes: "ISO 14001, ISO 45001, ISO 50001, ISO 26000, ISO 14064, ISO 14067, ISO 14068, GRI, BRSR, UN SDGs, SA 8000, FSSC, and more",
  },
  {
    icon: <Factory className="h-7 w-7 text-teal-800" />,
    title: "Industry Standards",
    codes: "ISO 42001, ISO 22000, ISO 13485, ISO 21001, ISO 9001, ISO 41001, ISO 22301, ISO 20000, ISO 20400, ISO 28001, ISO 37001, CMMI, NABH, NABL, HACCP/FSSC, and more",
  },
];

const BENEFITS = [
  { icon: <Smile className="h-5 w-5 text-teal-800" />, title: "Improved Customer Satisfaction" },
  { icon: <TrendingUp className="h-5 w-5 text-teal-800" />, title: "Streamlining Systems for Growth" },
  { icon: <Gauge className="h-5 w-5 text-teal-800" />, title: "Performance Management" },
  { icon: <PiggyBank className="h-5 w-5 text-teal-800" />, title: "Saving Costs, Wastes and Efforts" },
  { icon: <Lightbulb className="h-5 w-5 text-teal-800" />, title: "Easier Decision Making" },
  { icon: <ShieldCheck className="h-5 w-5 text-teal-800" />, title: "Risk Management" },
  { icon: <Puzzle className="h-5 w-5 text-teal-800" />, title: "Problem Solving" },
  { icon: <HeartHandshake className="h-5 w-5 text-teal-800" />, title: "Better Work Environment" },
  { icon: <Award className="h-5 w-5 text-teal-800" />, title: "Participation in Tenders" },
  { icon: <ClipboardCheck className="h-5 w-5 text-teal-800" />, title: "Registration as Suppliers" },
];

const STEPS = [
  { n: "01", title: "Training on System Documentation", desc: "We train your team to document the processes and controls the standard requires — the foundation everything else builds on." },
  { n: "02", title: "Training on System Implementation", desc: "Documentation becomes practice. We guide your team through actually running the system day-to-day." },
  { n: "03", title: "Training on System Assessment", desc: "Internal assessment training so your team can identify gaps and non-conformities before the real audit." },
  { n: "04", title: "Training on System Certification", desc: "Final certification-readiness training, carrying you through to the certification audit itself." },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="bg-white text-gray-900">
      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-950 via-teal-900 to-teal-800 py-24 sm:py-32">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-8 flex justify-center">
            <Image
              src="/logo.jpeg"
              alt="ODCAPTS ISO Certifications Services"
              width={110}
              height={110}
              className="rounded-2xl shadow-lg"
              priority
            />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-xs font-medium text-teal-50 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            ODCAPTS ISO Certifications Services &mdash; ISO Training, Assessment &amp; Certification
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight">
            Get certified, whatever
            <br />
            <span className="text-amber-400">the size of your business.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-teal-50/90 max-w-2xl mx-auto leading-relaxed">
            CertifyBusiness, the certification brand of ODCAPTS ISO Certifications Services, brings together ODC Standards Certifications — a full ISO portfolio for medium &amp; large organisations — and APTS Quality Certifications, an ISO 9001 specialist for micro &amp; small businesses.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#enquiry"
              className="w-full sm:w-auto rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-teal-900 hover:bg-amber-50 transition-colors shadow-lg"
            >
              Request a Quote
            </a>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                "Hi, I'd like to know more about ISO certification services."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto rounded-xl border border-white/30 bg-white/10 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
            >
              Chat on WhatsApp <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-gray-50 py-10">
        <div className="mx-auto max-w-4xl px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-2xl sm:text-3xl font-extrabold text-teal-800">{value}</p>
              <p className="mt-1 text-sm text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Who We Serve ─────────────────────────────────────────────────── */}
      <section id="who-we-serve" className="py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700 mb-3">
              Two divisions, one goal
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Who We Serve</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Whichever size your organisation is, there's a track built for you.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {WHO_WE_SERVE.map((w) => (
              <div key={w.name} className="rounded-2xl border border-gray-200 bg-white p-8 hover:shadow-md transition-shadow">
                <div className="mb-5 inline-flex rounded-xl bg-teal-50 p-3">{w.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{w.name}</h3>
                <p className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-4">{w.audience}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Standards We Cover ───────────────────────────────────────────── */}
      <section id="standards" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700 mb-3">
              Standards we cover
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              From data privacy to industry-specific standards
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {STANDARDS.map((s) => (
              <div key={s.title} className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="mb-4 inline-flex rounded-xl bg-teal-50 p-3">{s.icon}</div>
                <h3 className="text-base font-bold text-gray-900 mb-3">{s.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{s.codes}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="inline-flex rounded-xl bg-white p-3 flex-shrink-0">
              <Award className="h-7 w-7 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Specialised Services on ISO 9001 for Micro &amp; Small Business
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Our APTS division focuses solely on ISO 9001 for smaller organisations — a streamlined path, without the overhead of a full standards portfolio.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────────────────────── */}
      <section id="benefits" className="py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700 mb-3">
              Plan your benefits
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              Why certify with us
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4"
              >
                <div className="flex-shrink-0 rounded-lg bg-teal-50 p-2">{b.icon}</div>
                <p className="text-sm font-semibold text-gray-800">{b.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Certification Process ────────────────────────────────────────── */}
      <section id="process" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700 mb-3">
              Procedure for certification
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              Our four-stage certification process
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {STEPS.map((step) => (
              <div key={step.n} className="relative">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-800 text-white font-extrabold text-lg">
                    {step.n}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Request a Quote ──────────────────────────────────────────────── */}
      <section id="enquiry" className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700 mb-3">
              Place your enquiry
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Request a Quote</h2>
            <p className="mt-4 text-lg text-gray-500">
              Tell us about your business and the standards you're interested in — we'll take it from there.
            </p>
          </div>
          <EnquiryForm />
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="bg-gray-50 py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700 mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              Common questions
            </h2>
          </div>
          <MarketingFaq />
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="py-24 bg-gradient-to-br from-teal-800 to-teal-950">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Ready to get certified?
          </h2>
          <p className="text-lg text-teal-50/90 mb-10 max-w-xl mx-auto">
            Whether you need the full ISO portfolio or a focused ISO 9001 track, we'll help you find the right fit.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#enquiry"
              className="w-full sm:w-auto rounded-xl bg-white px-10 py-4 text-sm font-bold text-teal-900 hover:bg-amber-50 transition-colors shadow-lg"
            >
              Request a Quote
            </a>
            <a
              href={`mailto:${CONTACT.email}`}
              className="w-full sm:w-auto rounded-xl border border-white/30 px-10 py-4 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Talk to us
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <Image
                  src="/logo.jpeg"
                  alt="ODCAPTS ISO Certifications Services"
                  width={44}
                  height={44}
                  className="rounded-lg object-contain"
                />
                <span className="leading-tight">
                  <span className="block font-bold text-white text-base">CertifyBusiness</span>
                  <span className="block text-xs text-teal-300 font-medium">ODCAPTS ISO Certifications Services</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                ISO standards training, assessment, and certification — via ODC Standards Certifications and APTS Quality Certifications.
              </p>
            </div>

            {/* Standards */}
            <div>
              <p className="text-sm font-semibold text-white mb-4">Standards</p>
              <ul className="space-y-2.5">
                {["Data Privacy Standards", "ESG Standards", "Industry Standards", "ISO 9001 (Micro & Small)"].map((l) => (
                  <li key={l}><a href="#standards" className="text-sm hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="text-sm font-semibold text-white mb-4">Company</p>
              <ul className="space-y-2.5">
                <li><a href="#who-we-serve" className="text-sm hover:text-white transition-colors">Who We Serve</a></li>
                <li><a href="#process" className="text-sm hover:text-white transition-colors">Certification Process</a></li>
                <li><a href="#faq" className="text-sm hover:text-white transition-colors">FAQ</a></li>
                <li><a href="#enquiry" className="text-sm hover:text-white transition-colors">Request a Quote</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p className="text-sm font-semibold text-white mb-4">Point of Contact</p>
              <p className="text-sm text-white font-medium">{CONTACT.name}</p>
              <p className="text-xs text-gray-500 mb-3">{CONTACT.title}</p>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <a href={`mailto:${CONTACT.email}`} className="hover:text-white transition-colors">{CONTACT.email}</a>
                </li>
                {CONTACT.phones.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                    <a href={`tel:+91${p}`} className="hover:text-white transition-colors">{p}</a>
                  </li>
                ))}
                <li className="flex items-center gap-2 text-sm">
                  <MessageCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    WhatsApp us
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs">
              &copy; {new Date().getFullYear()} ODCAPTS ISO Certifications Services (CertifyBusiness). All rights reserved.
            </p>
            <p className="text-xs flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> Serving Micro, Small, Medium &amp; Large Enterprises
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
