/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "8mb" }, // allow image uploads
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
  webpack: (config) => {
    // tesseract.js worker needs fs fallback disabled on the client
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

export default nextConfig;
