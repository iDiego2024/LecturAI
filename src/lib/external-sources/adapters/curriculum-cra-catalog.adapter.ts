import { createAdapter, fetchHtmlFromSource, logExternalSource } from './base';
import type { ExternalResource, SearchFilters } from '../types';
import { absoluteUrl, cleanText, loadDocument } from '../parsing/html';

const SOURCE = 'curriculum_cra_catalog' as const;
const BASE_URL = 'https://www.curriculumnacional.cl';

function buildSearchUrl(query: string, page = 1) {
  const params = new URLSearchParams({
    search_text: query,
    page: String(Math.max(0, page - 1)),
  });
  return `${BASE_URL}/buscador?${params.toString()}`;
}

function parseSearch(html: string) {
  const $ = loadDocument(html);
  const items: ExternalResource[] = [];

  $('.view-buscador-search-api .views-row article').each((_, article) => {
    const link = $(article).find('h3 a').first();
    const sourceUrl = absoluteUrl(BASE_URL, link.attr('href'));
    const title = cleanText(link.text());
    if (!sourceUrl || !title) return;

    const externalId = new URL(sourceUrl).pathname.replace(/^\//, '');
    const grades = $(article)
      .find('.field--name-field-cn-grades .field__item')
      .map((_, item) => cleanText($(item).text()))
      .get()
      .filter(Boolean);
    const subjects = $(article)
      .find('.field--name-field-cn-subjects .field__item')
      .map((_, item) => cleanText($(item).text()))
      .get()
      .filter(Boolean);
    const description = cleanText($(article).find('.field--name-body, .field--name-field-bajada').first().text());
    const coverImageUrl = absoluteUrl(BASE_URL, $(article).find('img').first().attr('src'));
    const cardHtml = $.html(article);
    const looksLikePdf = /recurso_pdf|\.pdf/i.test(cardHtml);

    items.push({
      id: `${SOURCE}:${externalId}`,
      externalId,
      source: SOURCE,
      sourceUrl,
      title,
      description: description || undefined,
      language: 'es',
      schoolLevel: grades.join(' · ') || undefined,
      subject: subjects.join(' · ') || undefined,
      fileType: looksLikePdf ? 'pdf' : 'unknown',
      downloadable: false,
      availableFormats: looksLikePdf ? ['pdf'] : [],
      coverImageUrl: coverImageUrl || undefined,
      metadata: {
        grades,
        subjects,
      },
    });
  });

  const nextPageHref = $('.pager__item--next a').attr('href');
  return {
    items,
    nextPageToken: nextPageHref ? 'next' : null,
  };
}

function parseDetail(html: string, externalId: string, finalUrl: string): ExternalResource {
  const $ = loadDocument(html);
  const title =
    cleanText($('h1').first().text()) ||
    cleanText($('meta[property="og:title"]').attr('content'));
  const description =
    cleanText($('.field--name-body').first().text()) ||
    cleanText($('meta[name="description"]').attr('content'));
  const grades = $('.field--name-field-cn-grades .field__item')
    .map((_, item) => cleanText($(item).text()))
    .get()
    .filter(Boolean);
  const subjects = $('.field--name-field-cn-subjects .field__item')
    .map((_, item) => cleanText($(item).text()))
    .get()
    .filter(Boolean);
  const candidateLinks = $('a[href]')
    .map((_, link) => absoluteUrl(BASE_URL, $(link).attr('href')))
    .get()
    .filter(Boolean);

  const directFile =
    candidateLinks.find((href) => href.toLowerCase().endsWith('.pdf')) ||
    candidateLinks.find((href) => href.toLowerCase().endsWith('.epub')) ||
    '';

  return {
    id: `${SOURCE}:${externalId}`,
    externalId,
    source: SOURCE,
    sourceUrl: finalUrl,
    title: title || externalId,
    description: description || undefined,
    language: 'es',
    schoolLevel: grades.join(' · ') || undefined,
    subject: subjects.join(' · ') || undefined,
    fileType: directFile.toLowerCase().endsWith('.epub')
      ? 'epub'
      : directFile.toLowerCase().endsWith('.pdf')
        ? 'pdf'
        : 'unknown',
    downloadable: Boolean(directFile),
    availableFormats: directFile
      ? [directFile.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf']
      : [],
    downloadUrl: directFile || undefined,
    metadata: {
      grades,
      subjects,
      candidateLinks: candidateLinks.slice(0, 20),
    },
  };
}

export const CurriculumCraCatalogAdapter = createAdapter({
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
    const parsed = parseSearch(html);

    logExternalSource('external_sources.search.success', {
      adapter: SOURCE,
      url: searchUrl,
      status,
      parsedItems: parsed.items.length,
    });

    return {
      items: filters?.downloadableOnly
        ? parsed.items.filter((item) => item.downloadable)
        : parsed.items,
      nextPageToken: parsed.nextPageToken,
    };
  },
  async getResource(externalId: string) {
    const path = externalId.replace(/^.*:/, '').replace(/^\//, '');
    const resourceUrl = `${BASE_URL}/${path}`;

    logExternalSource('external_sources.resource.start', {
      adapter: SOURCE,
      externalId: path,
      url: resourceUrl,
    });

    const { html, finalUrl, status } = await fetchHtmlFromSource(SOURCE, resourceUrl);
    const resource = parseDetail(html, path, finalUrl);

    logExternalSource('external_sources.resource.success', {
      adapter: SOURCE,
      externalId: path,
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

    const fileType = resource.downloadUrl.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf';
    return {
      url: resource.downloadUrl,
      fileType,
      mimeType: fileType === 'epub' ? 'application/epub+zip' : 'application/pdf',
      filename: `${resource.externalId}.${fileType}`,
    };
  },
});
