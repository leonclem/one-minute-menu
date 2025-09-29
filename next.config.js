/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['uztyljbiqyrykzwtdbpa.supabase.co', 'localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Security headers
  async headers() {
    const isProd = process.env.NODE_ENV === 'production'
    const imgSrc = isProd
      ? "img-src 'self' data: https: blob:;"
      : "img-src 'self' data: https: http://localhost:54321 blob:;"
    const connectSrc = isProd
      ? "connect-src 'self' https://*.supabase.co https://*.supabase.com;"
      : "connect-src 'self' https://*.supabase.co https://*.supabase.com http://localhost:54321;"
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          // Only enable HSTS in production on HTTPS
          ...(isProd
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
            : []),
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; ${imgSrc} font-src 'self' data:; ${connectSrc}`,
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;