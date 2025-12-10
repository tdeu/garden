import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack for production builds due to compatibility issues with some packages
  experimental: {
    // Use webpack for production builds
  },
  // Transpile specific packages that need it
  transpilePackages: [
    '@rainbow-me/rainbowkit',
    'wagmi',
    'viem',
  ],
  // External packages that should not be bundled
  serverExternalPackages: [
    'pino',
    'thread-stream',
  ],
  // Image domains for remote images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'geoservices.wallonie.be',
        pathname: '/arcgis/**',
      },
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
        pathname: '/ipfs/**',
      },
    ],
  },
  // Webpack config for Web3 compatibility
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    // Handle MetaMask SDK's react-native dependency
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // The package is installed, so webpack will find it
      };
    }
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
};

export default nextConfig;
