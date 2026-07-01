import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  // Note: headers cannot be used with output: 'export'. 
  // Any custom headers like Cross-Origin-Opener-Policy should be configured in firebase.json
  images: {
    unoptimized: true,
  }
};

export default nextConfig;
