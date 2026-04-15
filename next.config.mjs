/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(ttf|html)$/i,
      type: 'asset/resource'
    });
    return config;
  },
  experimental: {
    serverMinification: false, // the server minification unfortunately breaks the selector class names
    // Don't bundle native / browser-automation packages. They do dynamic
    // require.resolve at load time, which webpack replaces with numeric
    // module IDs → `path.dirname(number)` crashes at build. Leaving them
    // external (loaded via native Node require at runtime) fixes "Collecting
    // page data" on Vercel.
    serverComponentsExternalPackages: [
      'playwright',
      'playwright-core',
      'rebrowser-playwright-core',
      '@playwright/browser-chromium',
      'chromium-bidi',
      'electron',
      'ghost-cursor-playwright',
      '@2captcha/captcha-solver',
    ],
  },
};

export default nextConfig;
