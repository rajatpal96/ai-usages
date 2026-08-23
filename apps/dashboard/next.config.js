/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:4000/v1/:path*',
      },
      {
        source: '/ingest/v1/:path*',
        destination: 'http://localhost:4001/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
