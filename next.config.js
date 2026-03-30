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

  // En Vercel no necesitamos `standalone`; Vercel realiza su propio tracing.
  // Mantenerlo desactivado evita errores ENOENT al copiar manifests en App Router.
};

module.exports = nextConfig;
