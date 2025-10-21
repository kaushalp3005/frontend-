/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    esmExternals: 'loose'
  },
  // Add production optimizations
  swcMinify: true,
  compress: true,
  // Ensure proper client-side rendering
  reactStrictMode: false,
  // Handle dynamic routes better
  trailingSlash: false,
  // Prevent hydration issues
  generateEtags: false,
}

export default nextConfig
