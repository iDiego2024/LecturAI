import { ALLOWED_SOURCE_DOMAINS } from '../config';
import type { SourceKey } from '../types';

export function normalizeSourceUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (
    url.protocol === 'http:' &&
    (url.hostname === 'www.memoriachilena.gob.cl' || url.hostname === 'memoriachilena.gob.cl')
  ) {
    url.protocol = 'https:';
  }
  return url;
}

export function isAllowedSourceUrl(source: SourceKey, rawUrl: string) {
  let url: URL;
  try {
    url = normalizeSourceUrl(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;

  const allowedHosts = ALLOWED_SOURCE_DOMAINS[source] || [];
  return allowedHosts.includes(url.hostname.toLowerCase());
}

export function assertAllowedSourceUrl(source: SourceKey, rawUrl: string) {
  let url: URL;
  try {
    url = normalizeSourceUrl(rawUrl);
  } catch {
    throw new Error('La URL del recurso no es válida.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('La descarga fue bloqueada porque la URL no usa HTTPS.');
  }

  if (!isAllowedSourceUrl(source, url.toString())) {
    throw new Error('La descarga fue bloqueada porque la URL final no pertenece a un dominio permitido.');
  }

  return url;
}
