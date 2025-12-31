import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image domains for remote images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'geoservices.wallonie.be',
        pathname: '/arcgis/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/rails/active_storage/**',
      },
    ],
  },
};

export default nextConfig;
