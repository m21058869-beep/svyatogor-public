/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Пакеты для сервера: не бандлим их, а подключаем из node_modules при запуске.
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg', 'bcryptjs', 'nodemailer'],
  },
  eslint: {
    // Линт запускается отдельной командой `npm run lint`, сборку не роняем.
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // Сгенерированный Prisma-клиент использует ESM-import'ы с расширением .js
    // (`./enums.js`, `./internal/class.js`), которые на самом деле лежат как .ts.
    // Учим webpack разрешать их так же, как это делает tsc с moduleResolution: bundler.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
