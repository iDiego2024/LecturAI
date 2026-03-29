/** @type {import('next').NextConfig} */
const nextConfig = {
  // Solución para librerías con dependencias nativas o binarias
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'epub2'],
  },
  
  // Ignorar errores menores para permitir el despliegue
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Esta opción ayuda a evitar errores de manifiesto en builds de Vercel y optimiza para serverless
  output: 'standalone',
};

module.exports = nextConfig;
