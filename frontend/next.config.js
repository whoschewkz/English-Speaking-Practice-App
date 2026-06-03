/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=15768000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              // Google Fonts CSS + inline styles (Tailwind, theme script)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Google Fonts file (.woff2)
              "font-src 'self' https://fonts.gstatic.com",
              // API calls ke backend + audio uploads
              "connect-src 'self'",
              // Gambar dari domain sendiri + data URI (avatar, icon)
              "img-src 'self' data:",
              // Audio dari backend (uploads/audio/)
              "media-src 'self'",
              // Blokir iframe embedding (anti-clickjacking)
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
