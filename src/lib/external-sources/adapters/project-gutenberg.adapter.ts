import { createAdapter, fetchHtmlFromSource, logExternalSource } from './base';
import type { ExternalResource, SearchFilters } from '../types';
import { absoluteUrl, cleanText, loadDocument } from '../parsing/html';

const SOURCE = 'project_gutenberg' as const;
const BASE_URL = 'https://www.gutenberg.org';

function buildSearchUrl(query: string, page = 1) {
  const params = new URLSearchParams({ query });
  if (page > 1) {
    params.set('start_index', String((page - 1) * 25 + 1));
  }
  return `${BASE_URL}/ebooks/search/?${params.toString()}`;
}

function parseSearch(html: string) {
  const $ = loadDocument(html);
  const items: ExternalResource[] = [];

  $('li.booklink').each((_, row) => {
    const link = $(row).find('a.link').first();
    const sourceUrl = absoluteUrl(BASE_URL, link.attr('href'));
    const externalId = cleanText(link.attr('href') || '').replace('/ebooks/', '');
    if (!sourceUrl || !externalId) return;

    const title = cleanText($(row).find('.title').first().text());
    const author = cleanText($(row).find('.subtitle').first().text());
    const coverImageUrl = absoluteUrl(BASE_URL, $(row).find('.cover-thumb').first().attr('src'));

    items.push({
      id: `${SOURCE}:${externalId}`,
      externalId,
      source: SOURCE,
      sourceUrl,
      title: title || `Libro ${externalId}`,
      author: author || undefined,
      language: 'en',
      downloadable: true,
      fileType: 'epub',
      availableFormats: ['epub'],
      coverImageUrl: coverImageUrl || undefined,
      metadata: {},
    });
  });

  const total = Number($('meta[name="totalResults"]').attr('content') || 0) || undefined;
  const startIndex = Number($('meta[name="startIndex"]').attr('content') || 1);
  const itemsPerPage = Number($('meta[name="itemsPerPage"]').attr('content') || 25);
  const hasMore = Boolean(total && startIndex - 1 + itemsPerPage < total);

  return {
    items,
    total,
    nextPageToken: hasMore ? 'next' : null,
  };
}

function parseDetail(html: string, externalId: string, finalUrl: string): ExternalResource {
  const $ = loadDocument(html);
  const title =
    cleanText($('h1').first().text()) ||
    cleanText($('meta[property="og:title"]').attr('content'));
  const author =
    cleanText($('tr[itemprop="creator"] td').first().text()) ||
    cleanText($('a[itemprop="creator"]').first().text()) ||
    cleanText($('.subtitle').first().text());
  const language = cleanText(
    $('tr')
      .filter((_, row) => cleanText($(row).find('th').first().text()) === 'Language')
      .first()
      .find('td')
      .first()
      .text()
  );
  const coverImageUrl = absoluteUrl(BASE_URL, $('.cover-art img').first().attr('src'));

  const downloadRows = $('table.files tr')
    .map((_, row) => {
      const link = $(row).find('a[href]').first();
      const href = absoluteUrl(BASE_URL, link.attr('href'));
      const type = cleanText(link.attr('type'));
      const label = cleanText(link.text());
      return { href, type, label };
    })
    .get()
    .filter((row) => row.href);

  const downloadUrl =
    downloadRows.find((row) => row.type === 'application/epub+zip' && /no images/i.test(row.label))?.href ||
    downloadRows.find((row) => row.type === 'application/epub+zip')?.href ||
    downloadRows.find((row) => row.type === 'application/pdf')?.href ||
    '';

  const fileType = downloadUrl.toLowerCase().includes('.epub') ? 'epub' : downloadUrl ? 'pdf' : 'unknown';

  return {
    id: `${SOURCE}:${externalId}`,
    externalId,
    source: SOURCE,
    sourceUrl: finalUrl,
    title: title || `Libro ${externalId}`,
    author: author || undefined,
    description: language ? `Idioma: ${language}` : undefined,
    language: language || undefined,
    fileType,
    downloadable: Boolean(downloadUrl),
    availableFormats: downloadUrl ? [fileType === 'epub' ? 'epub' : 'pdf'] : [],
    downloadUrl: downloadUrl || undefined,
    coverImageUrl: coverImageUrl || undefined,
    metadata: {
      language: language || null,
      availableDownloads: downloadRows,
    },
  };
}

export const ProjectGutenbergAdapter = createAdapter({
  source: SOURCE,
  async search(query: string, _filters?: SearchFilters, page = 1) {
    const searchUrl = buildSearchUrl(query, page);

    logExternalSource('external_sources.search.start', {
      adapter: SOURCE,
      url: searchUrl,
      query,
      page,
    });

    const { html, status } = await fetchHtmlFromSource(SOURCE, searchUrl);
    const parsed = parseSearch(html);

    logExternalSource('external_sources.search.success', {
      adapter: SOURCE,
      url: searchUrl,
      status,
      parsedItems: parsed.items.length,
    });

    return parsed;
  },
  async getResource(externalId: string) {
    const normalizedId = externalId.replace(/^.*:/, '').replace(/^\/?ebooks\//, '');
    const resourceUrl = `${BASE_URL}/ebooks/${normalizedId}`;

    logExternalSource('external_sources.resource.start', {
      adapter: SOURCE,
      externalId: normalizedId,
      url: resourceUrl,
    });

    const { html, finalUrl, status } = await fetchHtmlFromSource(SOURCE, resourceUrl);
    const resource = parseDetail(html, normalizedId, finalUrl);

    logExternalSource('external_sources.resource.success', {
      adapter: SOURCE,
      externalId: normalizedId,
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

    const fileType = resource.downloadUrl.toLowerCase().includes('.epub') ? 'epub' : 'pdf';
    const mimeType = fileType === 'epub' ? 'application/epub+zip' : 'application/pdf';

    logExternalSource('external_sources.download.resolved', {
      adapter: SOURCE,
      externalId: resource.externalId,
      url: resource.downloadUrl,
      fileType,
    });

    return {
      url: resource.downloadUrl,
      fileType,
      mimeType,
      filename: `${resource.externalId}.${fileType}`,
    };
  },
});
