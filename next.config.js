const path = require("node:path");

/** @type {import("next").NextConfig} */
const nextConfig = {
  devIndicators: false,
  serverExternalPackages: ["better-sqlite3"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
    };
    return config;
  },
};

module.exports = nextConfig;
