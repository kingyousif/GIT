/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["172.18.1.68"],
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
