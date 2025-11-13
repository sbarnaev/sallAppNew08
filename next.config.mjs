/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: { allowedOrigins: ['*'] }
  },
  webpack: (config) => {
    // Исключаем папку n8n.prompting из компиляции Next.js
    config.module.rules.push({
      test: /app\/n8n\.prompting\/.*\.(js|json)$/,
      use: 'ignore-loader'
    });
    return config;
  }
};
export default nextConfig;
