/** @type {import('next').NextConfig} */
const nextConfig = {
  // Solución para librerías con dependencias nativas o binarias
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'epub2', '@napi-rs/canvas', 'pdfjs-dist'],
    outputFileTracingIncludes: {
      '/api/demo/book': ['./El_fantasma_de_Canterville-Wilde_Oscar.epub'],
    },
  },

  // En Vercel no necesitamos `standalone`; Vercel realiza su propio tracing.
  // Mantenerlo desactivado evita errores ENOENT al copiar manifests en App Router.
};

module.exports = nextConfig;
