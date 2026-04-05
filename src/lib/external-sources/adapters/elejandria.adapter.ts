import { createAdapter, fetchHtmlFromSource, logExternalSource } from './base';
import type { ExternalResource, SearchFilters } from '../types';
import { absoluteUrl, cleanText, loadDocument } from '../parsing/html';

const SOURCE = 'elejandria' as const;
const BASE_URL = 'https://www.elejandria.com';
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;

type CatalogEntry = {
  externalId: string;
  sourceUrl: string;
  title: string;
  author?: string;
};

let sitemapCache:
  | {
      loadedAt: number;
      entries: CatalogEntry[];
    }
  | null = null;

function normalizeForSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function titleCaseFromSlug(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

async function loadCatalog() {
  const now = Date.now();
  if (sitemapCache && now - sitemapCache.loadedAt < 6 * 60 * 60 * 1000) {
    return sitemapCache.entries;
  }

  const { html } = await fetchHtmlFromSource(SOURCE, SITEMAP_URL);
  const entries = Array.from(html.matchAll(/<loc>(https:\/\/www\.elejandria\.com\/libro\/([^<]+))<\/loc>/g))
    .map((match) => {
      const sourceUrl = match[1];
      const path = match[2];
      const parts = path.split('/');
      const [titleSlug, authorSlug, id] = parts;
      if (!titleSlug || !authorSlug || !id) return null;
      return {
        externalId: id,
        sourceUrl,
        title: titleCaseFromSlug(titleSlug),
        author: titleCaseFromSlug(authorSlug),
      } satisfies CatalogEntry;
    })
    .filter(Boolean) as CatalogEntry[];

  sitemapCache = {
    loadedAt: now,
    entries,
  };

  return entries;
}

function scoreEntry(entry: CatalogEntry, normalizedQuery: string) {
  const haystack = normalizeForSearch(`${entry.title} ${entry.author || ''}`);
  if (haystack === normalizedQuery) return 120;
  if (haystack.startsWith(normalizedQuery)) return 100;
  if (haystack.includes(normalizedQuery)) return 80;

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const matches = terms.filter((term) => haystack.includes(term)).length;
  return matches > 0 ? matches * 10 : 0;
}

function parseDetail(html: string, externalId: string, finalUrl: string): ExternalResource {
  const $ = loadDocument(html);
  const title =
    cleanText($('h1').first().text()) ||
    cleanText($('meta[property="og:title"]').attr('content'));
  const author =
    cleanText($('.book-description-author a').first().text()) ||
    cleanText($('a[href*="/autor/"]').first().text());
  const description =
    cleanText($('meta[name="description"]').attr('content')) ||
    cleanText($('.book-description').first().text());
  const coverImageUrl = absoluteUrl(BASE_URL, $('meta[property="og:image"]').attr('content') || $('img').first().attr('src'));

  const downloadLinks = $('a.download-link[href], a[href*="/libro/descargar/"]')
    .map((_, link) => {
      const href = absoluteUrl(BASE_URL, $(link).attr('href'));
      const label = cleanText($(link).text());
      return { href, label };
    })
    .get();

  const pdfLink = downloadLinks.find((entry) => /\/\d+\/\d+\b/.test(entry.href) && /pdf/i.test(entry.label))?.href || '';
  const epubLink = downloadLinks.find((entry) => /\/\d+\/\d+\b/.test(entry.href) && /epub/i.test(entry.label))?.href || '';

  const availableFormats: Array<'pdf' | 'epub' | 'html'> = [];
  if (pdfLink) availableFormats.push('pdf');
  if (epubLink) availableFormats.push('epub');

  return {
    id: `${SOURCE}:${externalId}`,
    externalId,
    source: SOURCE,
    sourceUrl: finalUrl,
    title: title || `Libro ${externalId}`,
    author: author || undefined,
    description: description || undefined,
    language: 'es',
    fileType: pdfLink ? 'pdf' : epubLink ? 'epub' : 'unknown',
    downloadable: Boolean(pdfLink || epubLink),
    availableFormats,
    downloadUrl: pdfLink || epubLink || undefined,
    licenseLabel: 'Dominio público o licencias abiertas',
    licenseUrl: `${BASE_URL}/copyright`,
    coverImageUrl: coverImageUrl || undefined,
    metadata: {
      availableDownloads: downloadLinks,
      isInstitutional: false,
    },
  };
}

export const ElejandriaAdapter = createAdapter({
  source: SOURCE,
  async search(query: string, filters?: SearchFilters, page = 1) {
    const normalizedQuery = normalizeForSearch(query);
    const catalog = await loadCatalog();
    const ranked = catalog
      .map((entry) => ({
        entry,
        score: scoreEntry(entry, normalizedQuery),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    const pageSize = 10;
    const slice = ranked.slice((page - 1) * pageSize, page * pageSize);
    const items = slice.map(({ entry }) => ({
      id: `${SOURCE}:${entry.externalId}`,
      externalId: entry.externalId,
      source: SOURCE,
      sourceUrl: entry.sourceUrl,
      title: entry.title,
      author: entry.author,
      language: 'es',
      fileType: filters?.fileType === 'epub' ? 'epub' : 'pdf',
      downloadable: true,
      availableFormats: ['pdf', 'epub'],
      licenseLabel: 'Dominio público o licencias abiertas',
      licenseUrl: `${BASE_URL}/copyright`,
      metadata: {
        isInstitutional: false,
      },
    } satisfies ExternalResource));

    logExternalSource('external_sources.search.success', {
      adapter: SOURCE,
      url: SITEMAP_URL,
      page,
      parsedItems: items.length,
      totalCandidates: ranked.length,
    });

    return {
      items,
      total: ranked.length,
      nextPageToken: ranked.length > page * pageSize ? String(page + 1) : null,
    };
  },

  async getResource(externalId: string) {
    const catalog = await loadCatalog();
    const entry = catalog.find((item) => item.externalId === externalId);
    if (!entry) return null;

    logExternalSource('external_sources.resource.start', {
      adapter: SOURCE,
      externalId,
      url: entry.sourceUrl,
    });

    const { html, finalUrl, status } = await fetchHtmlFromSource(SOURCE, entry.sourceUrl);
    const resource = parseDetail(html, externalId, finalUrl);

    logExternalSource('external_sources.resource.success', {
      adapter: SOURCE,
      externalId,
      url: finalUrl,
      status,
      downloadable: resource.downloadable,
      downloadUrl: resource.downloadUrl || null,
    });

    return resource;
  },

  async resolveDownload(resource: ExternalResource) {
    if (!resource.downloadable || !resource.downloadUrl) {
      const hydrated = await this.getResource(resource.externalId);
      if (!hydrated?.downloadable || !hydrated.downloadUrl) return null;
      resource = hydrated;
    }

    const preferEpub = resource.fileType === 'epub' && /epub/i.test(resource.downloadUrl);
    const fileType = preferEpub ? 'epub' : /pdf/i.test(resource.downloadUrl) ? 'pdf' : 'epub';
    const mimeType = fileType === 'pdf' ? 'application/pdf' : 'application/epub+zip';

    let finalUrl = resource.downloadUrl;
    if (!/link_descarga_libro/i.test(finalUrl)) {
      const { html } = await fetchHtmlFromSource(SOURCE, finalUrl);
      const $ = loadDocument(html);
      finalUrl =
        absoluteUrl(BASE_URL, $('a[href*="/libro/link_descarga_libro/"]').first().attr('href')) || finalUrl;
    }

    logExternalSource('external_sources.download.resolved', {
      adapter: SOURCE,
      externalId: resource.externalId,
      url: finalUrl,
      fileType,
    });

    return {
      url: finalUrl,
      fileType,
      mimeType,
      filename: `${resource.externalId}.${fileType}`,
    };
  },
});
