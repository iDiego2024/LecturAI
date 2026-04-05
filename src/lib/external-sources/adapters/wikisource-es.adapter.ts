import { createAdapter, fetchHtmlFromSource, logExternalSource } from './base';
import type { ExternalResource, SearchFilters } from '../types';
import { cleanText } from '../parsing/html';

const SOURCE = 'wikisource_es' as const;
const BASE_URL = 'https://es.wikisource.org';

type MediaWikiSearchResponse = {
  query?: {
    search?: Array<{
      title: string;
      pageid: number;
      size?: number;
      snippet?: string;
      timestamp?: string;
    }>;
  };
};

type MediaWikiPageResponse = {
  query?: {
    pages?: Record<
      string,
      {
        pageid?: number;
        title?: string;
        fullurl?: string;
        extract?: string;
      }
    >;
  };
};

function buildSearchUrl(query: string, page = 1) {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '10',
    sroffset: String((Math.max(1, page) - 1) * 10),
    srprop: 'snippet|timestamp',
    format: 'json',
    utf8: '1',
  });

  return `${BASE_URL}/w/api.php?${params.toString()}`;
}

function buildDetailUrl(title: string) {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'info|extracts',
    inprop: 'url',
    exintro: '1',
    explaintext: '1',
    redirects: '1',
    titles: title,
    format: 'json',
    utf8: '1',
  });

  return `${BASE_URL}/w/api.php?${params.toString()}`;
}

function stripHtml(value?: string) {
  return cleanText((value || '').replace(/<[^>]+>/g, ' '));
}

function pdfUrlForTitle(title: string) {
  return `${BASE_URL}/api/rest_v1/page/pdf/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;
}

function mapSearchItem(item: NonNullable<MediaWikiSearchResponse['query']>['search'][number]): ExternalResource {
  const title = cleanText(item.title);
  const sourceUrl = `${BASE_URL}/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;

  return {
    id: `${SOURCE}:${title}`,
    externalId: title,
    source: SOURCE,
    sourceUrl,
    title,
    description: stripHtml(item.snippet) || undefined,
    publicationDate: item.timestamp || undefined,
    language: 'es',
    fileType: 'pdf',
    downloadable: true,
    availableFormats: ['pdf', 'html'],
    downloadUrl: pdfUrlForTitle(title),
    licenseLabel: 'Wikisource en español',
    licenseUrl: 'https://es.wikisource.org',
    metadata: {
      pageId: item.pageid,
    },
  };
}

export const WikisourceEsAdapter = createAdapter({
  source: SOURCE,
  async search(query: string, filters?: SearchFilters, page = 1) {
    const searchUrl = buildSearchUrl(query, page);

    logExternalSource('external_sources.search.start', {
      adapter: SOURCE,
      url: searchUrl,
      query,
      page,
    });

    const { html, status } = await fetchHtmlFromSource(SOURCE, searchUrl);
    const payload = JSON.parse(html) as MediaWikiSearchResponse;
    const rawItems = payload.query?.search || [];
    const items = rawItems.map(mapSearchItem).filter((item) => {
      if (filters?.downloadableOnly && !item.downloadable) return false;
      if (filters?.fileType && filters.fileType !== 'unknown' && item.fileType !== filters.fileType) {
        return false;
      }
      return true;
    });

    logExternalSource('external_sources.search.success', {
      adapter: SOURCE,
      url: searchUrl,
      status,
      parsedItems: items.length,
    });

    return {
      items,
      total: rawItems.length,
      nextPageToken: rawItems.length === 10 ? String(page + 1) : null,
    };
  },

  async getResource(externalId: string) {
    const title = cleanText(decodeURIComponent(externalId));
    const detailUrl = buildDetailUrl(title);

    logExternalSource('external_sources.resource.start', {
      adapter: SOURCE,
      externalId: title,
      url: detailUrl,
    });

    const { html, status } = await fetchHtmlFromSource(SOURCE, detailUrl);
    const payload = JSON.parse(html) as MediaWikiPageResponse;
    const page = Object.values(payload.query?.pages || {}).find((entry) => entry.title);

    if (!page?.title) return null;

    const resource: ExternalResource = {
      id: `${SOURCE}:${page.title}`,
      externalId: page.title,
      source: SOURCE,
      sourceUrl:
        page.fullurl || `${BASE_URL}/wiki/${encodeURIComponent(page.title.replace(/\s+/g, '_'))}`,
      title: page.title,
      description: cleanText(page.extract) || undefined,
      language: 'es',
      fileType: 'pdf',
      downloadable: true,
      availableFormats: ['pdf', 'html'],
      downloadUrl: pdfUrlForTitle(page.title),
      licenseLabel: 'Wikisource en español',
      licenseUrl: 'https://es.wikisource.org',
      metadata: {
        pageId: page.pageid || null,
      },
    };

    logExternalSource('external_sources.resource.success', {
      adapter: SOURCE,
      externalId: title,
      url: resource.sourceUrl,
      status,
      downloadable: resource.downloadable,
      downloadUrl: resource.downloadUrl,
    });

    return resource;
  },

  async resolveDownload(resource: ExternalResource) {
    const title = cleanText(resource.externalId || resource.title);
    const url = pdfUrlForTitle(title);

    logExternalSource('external_sources.download.resolved', {
      adapter: SOURCE,
      externalId: title,
      url,
      fileType: 'pdf',
    });

    return {
      url,
      fileType: 'pdf',
      mimeType: 'application/pdf',
      filename: `${title.replace(/[^\w.-]+/g, '_')}.pdf`,
    };
  },
});
