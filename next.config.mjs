/** @type {import('next').NextConfig} */
const nextConfig = {
  // The stage owns a long-lived WebGL context and GSAP timelines, so double-mounting in dev is off.
  reactStrictMode: false,
  poweredByHeader: false,
  images: { unoptimized: true },
  devIndicators: false,
  async headers() {
    if (process.env.NODE_ENV !== 'production') return [];
    return [
      {
        source: '/(webgl|videos|audio|tracking)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
    ];
  },
};

export default nextConfig;
