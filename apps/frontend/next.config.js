/** @type {import('next').NextConfig} */

// Set STATIC_EXPORT=true only for the GitHub Pages build (see
// .github/workflows/deploy-pages.yml). Regular `npm run dev` / `npm run build`
// stay a normal Next.js server build so the full app (dashboard + backend)
// can still be deployed to a Node host later — static export is opt-in, not
// the default, since GitHub Pages can only serve static files.
const isStaticExport = process.env.STATIC_EXPORT === "true";

const nextConfig = {
  reactStrictMode: true,
  ...(isStaticExport && { output: "export" }),
  images: {
    remotePatterns: [],
    // next/image's optimization API needs a server; GitHub Pages can't run
    // one, so serve images unoptimized-but-working in the static export.
    unoptimized: isStaticExport,
  },
};

module.exports = nextConfig;