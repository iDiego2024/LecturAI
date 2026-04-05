import type { SourceKey } from './types';

export const SOURCE_DEFINITIONS: Record<
  SourceKey,
  {
    name: string;
    baseUrl: string;
  }
> = {
  wikisource_es: {
    name: 'Wikisource ES',
    baseUrl: 'https://es.wikisource.org',
  },
  cervantes_virtual: {
    name: 'Biblioteca Virtual Miguel de Cervantes',
    baseUrl: 'https://www.cervantesvirtual.com',
  },
  mineduc_biblioteca_digital: {
    name: 'Biblioteca Digital MINEDUC',
    baseUrl: 'https://bibliotecadigital.mineduc.cl',
  },
  memoria_chilena: {
    name: 'Memoria Chilena',
    baseUrl: 'https://www.memoriachilena.gob.cl',
  },
  bne_digital: {
    name: 'Biblioteca Digital Hispánica / BNE Digital',
    baseUrl: 'https://bnedigital.bne.es',
  },
  elejandria: {
    name: 'Elejandría',
    baseUrl: 'https://www.elejandria.com',
  },
  project_gutenberg: {
    name: 'Project Gutenberg',
    baseUrl: 'https://www.gutenberg.org',
  },
  curriculum_cra_catalog: {
    name: 'Catálogo Currículum / CRA',
    baseUrl: 'https://www.curriculumnacional.cl',
  },
};

export const ALLOWED_SOURCE_DOMAINS: Record<SourceKey, string[]> = {
  wikisource_es: ['es.wikisource.org'],
  cervantes_virtual: ['www.cervantesvirtual.com', 'cervantesvirtual.com'],
  mineduc_biblioteca_digital: ['bibliotecadigital.mineduc.cl'],
  memoria_chilena: [
    'www.memoriachilena.gob.cl',
    'memoriachilena.gob.cl',
  ],
  bne_digital: [
    'bnedigital.bne.es',
    'bdh-rd.bne.es',
    'www.bne.es',
    'datos.bne.es',
  ],
  elejandria: ['www.elejandria.com', 'elejandria.com'],
  project_gutenberg: ['www.gutenberg.org', 'gutenberg.org'],
  curriculum_cra_catalog: [
    'www.curriculumnacional.cl',
    'curriculumnacional.cl',
    'bibliotecadigital.mineduc.cl',
  ],
};

export type ExternalSourcesConfig = {
  enabledSources: Record<SourceKey, boolean>;
  timeoutMs: number;
  maxDownloadBytes: number;
  maxRedirects: number;
  cacheTtlMs: {
    search: number;
    resource: number;
  };
};

const DEFAULT_ENABLED: Record<SourceKey, boolean> = {
  wikisource_es: true,
  cervantes_virtual: true,
  mineduc_biblioteca_digital: true,
  memoria_chilena: true,
  bne_digital: true,
  elejandria: true,
  project_gutenberg: true,
  curriculum_cra_catalog: true,
};

export function getExternalSourcesConfig(): ExternalSourcesConfig {
  const enabledCsv = process.env.BOOK_SOURCES_ENABLED?.trim();
  const enabledSet = new Set(
    enabledCsv
      ? enabledCsv
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : []
  );

  const hasExplicitEnabledList = enabledSet.size > 0;

  const enabledSources = (Object.keys(DEFAULT_ENABLED) as SourceKey[]).reduce(
    (acc, key) => {
      acc[key] = hasExplicitEnabledList ? enabledSet.has(key) : DEFAULT_ENABLED[key];
      return acc;
    },
    {} as Record<SourceKey, boolean>
  );

  return {
    enabledSources,
    timeoutMs: Number(process.env.BOOK_SOURCES_TIMEOUT_MS || 15000),
    maxDownloadBytes: Number(process.env.BOOK_SOURCES_MAX_BYTES || 25 * 1024 * 1024),
    maxRedirects: Number(process.env.BOOK_SOURCES_MAX_REDIRECTS || 5),
    cacheTtlMs: {
      search: Number(process.env.BOOK_SOURCES_SEARCH_CACHE_MS || 15 * 60 * 1000),
      resource: Number(process.env.BOOK_SOURCES_RESOURCE_CACHE_MS || 60 * 60 * 1000),
    },
  };
}
