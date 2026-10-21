/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // The participant pages live in the Astro app; this host serves only the admin.
  async redirects() {
    return [{ source: '/', destination: '/admin', permanent: false }];
  },
};

module.exports = nextConfig;
