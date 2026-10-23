const path = require("node:path");

const isPagesExport =
  process.env.GITHUB_PAGES === "1" || process.env.NEXT_PUBLIC_STATIC_DEMO === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import("next").NextConfig} */
const nextConfig = {
  devIndicators: false,
  ...(isPagesExport
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
        basePath: basePath || undefined,
        assetPrefix: basePath ? `${basePath}/` : undefined,
      }
    : {
        serverExternalPackages: ["better-sqlite3"],
      }),
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
    };
    return config;
  },
};

module.exports = nextConfig;
