import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let other devices on your home/office network use the dev server
  // (e.g. http://192.168.1.20:3000 from a laptop or phone). Dev-only.
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "*.local",
    ...(process.env.DEV_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()) ?? []),
  ],
};

export default nextConfig;
