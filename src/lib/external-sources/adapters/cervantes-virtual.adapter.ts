import { createAdapter, fetchHtmlFromSource, logExternalSource } from './base';
import type { ExternalResource, SearchFilters } from '../types';
import { absoluteUrl, cleanText, loadDocument } from '../parsing/html';

const SOURCE = 'cervantes_virtual' as const;
const BASE_URL = 'https://www.cervantesvirtual.com';

function buildSearchUrl(query: string, page = 1) {
  const params = new URLSearchParams({
    q: query,
    fformato: 'epub',
    fidioma: 'español',
  });

  if (page > 1) {
    params.set('page', String(page));
  }

  return `${BASE_URL}/obras/serie/epubs_todos/?${params.toString()}`;
}

function parseSearch(html: string) {
  const $ = loadDocument(html);
  const items: ExternalResource[] = [];

  $('li.item-obra').each((_, row) => {
    const titleLink = $(row).find('dd.titulo a[href]').first();
    const sourceUrl = absoluteUrl(BASE_URL, titleLink.attr('href'));
    const externalId = cleanText(titleLink.attr('href') || '')
      .replace(/^\/obra\//, '')
      .replace(/\/$/, '');
    if (!sourceUrl || !externalId) return;

    const title = cleanText(titleLink.find('strong').first().text()) || cleanText(titleLink.text());
    const author = cleanText(
      $(row)
        .find('dt')
        .filter((_, el) => /autor/i.test(cleanText($(el).text())))
        .first()
        .next('dd')
        .text()
    );
    const description = cleanText(
      $(row)
        .find('dt')
        .filter((_, el) => /materia/i.test(cleanText($(el).text())))
        .first()
        .next('dd')
        .text()
    );

    const downloadLinks = $(row)
      .find('dd.formatos a[href]')
      .map((_, link) => {
        const href = absoluteUrl(BASE_URL, $(link).attr('href'));
        const label = cleanText($(link).text());
        return { href, label };
      })
      .get();

    const epubLink =
      downloadLinks.find((entry) => /descargaepub/i.test(entry.href) || /epub/i.test(entry.label))?.href || '';
    const pdfLink =
      downloadLinks.find((entry) => /pdf/i.test(entry.href) || /pdf/i.test(entry.label))?.href || '';
    const availableFormats: Array<'pdf' | 'epub' | 'html'> = [];
    if (epubLink) availableFormats.push('epub');
    if (pdfLink) availableFormats.push('pdf');

    items.push({
      id: `${SOURCE}:${externalId}`,
      externalId,
      source: SOURCE,
      sourceUrl,
      title: title || `Obra ${externalId}`,
      author: author || undefined,
      description: description || undefined,
      language: 'es',
      fileType: epubLink ? 'epub' : pdfLink ? 'pdf' : 'unknown',
      downloadable: Boolean(epubLink || pdfLink),
      availableFormats,
      downloadUrl: epubLink || pdfLink || undefined,
      licenseLabel: 'Biblioteca Virtual Miguel de Cervantes',
      licenseUrl: BASE_URL,
      metadata: {
        rawHref: cleanText(titleLink.attr('href')),
      },
    });
  });

  const totalMatch = html.match(/<strong>([\d.]+)<\/strong>\s+resultados/i);
  const total = totalMatch?.[1] ? Number(totalMatch[1].replace(/\./g, '')) : undefined;
  const hasNextPage = $('a[rel="next"], .pagination a[title*="Siguiente"], .paginacion a[title*="Siguiente"]').length > 0;

  return {
    items,
    total,
    nextPageToken: hasNextPage ? 'next' : null,
  };
}

function parseDetail(html: string, externalId: string, finalUrl: string): ExternalResource {
  const $ = loadDocument(html);
  const title =
    cleanText($('#ficha-cv h1, #ficha-cv .titulo').first().text()) ||
    cleanText($('meta[property="og:title"]').attr('content')) ||
    cleanText($('h1').first().text());
  const author = cleanText(
    $('#ficha-cv dt')
      .filter((_, el) => /autor/i.test(cleanText($(el).text())))
      .first()
      .next('dd')
      .text()
  );
  const description =
    cleanText($('meta[name="description"]').attr('content')) ||
    cleanText($('#ficha-cv .descripcion').first().text());
  const languageMatch = html.match(/'idiomaObra':'([^']*)'/);
  const language = cleanText(languageMatch?.[1] || '') || 'es';
  const coverImageUrl = absoluteUrl(BASE_URL, $('#ficha-cv img, .portada img').first().attr('src'));

  const downloadLinks = $('a[href]')
    .map((_, link) => {
      const href = absoluteUrl(BASE_URL, $(link).attr('href'));
      const label = cleanText($(link).text());
      return { href, label };
    })
    .get()
    .filter((entry) => /descargaepub|descargapdf|\.epub(\?|$)|\.pdf(\?|$)/i.test(entry.href) || /epub|pdf/i.test(entry.label));

  const epubLink =
    downloadLinks.find((entry) => /descargaepub|\.epub(\?|$)/i.test(entry.href) || /epub/i.test(entry.label))?.href || '';
  const pdfLink =
    downloadLinks.find((entry) => /descargapdf|\.pdf(\?|$)/i.test(entry.href) || /pdf/i.test(entry.label))?.href || '';

  const availableFormats: Array<'pdf' | 'epub' | 'html'> = ['html'];
  if (epubLink) availableFormats.unshift('epub');
  if (pdfLink && !availableFormats.includes('pdf')) availableFormats.unshift('pdf');

  return {
    id: `${SOURCE}:${externalId}`,
    externalId,
    source: SOURCE,
    sourceUrl: finalUrl,
    title: title || `Obra ${externalId}`,
    author: author || undefined,
    description: description || undefined,
    language,
    fileType: epubLink ? 'epub' : pdfLink ? 'pdf' : 'html',
    downloadable: Boolean(epubLink || pdfLink),
    availableFormats,
    downloadUrl: epubLink || pdfLink || undefined,
    licenseLabel: 'Biblioteca Virtual Miguel de Cervantes',
    licenseUrl: BASE_URL,
    coverImageUrl: coverImageUrl || undefined,
    metadata: {
      availableDownloads: downloadLinks,
    },
  };
}

export const CervantesVirtualAdapter = createAdapter({
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
    let parsed = parseSearch(html);

    if (filters?.downloadableOnly) {
      parsed = {
        ...parsed,
        items: parsed.items.filter((item) => item.downloadable),
      };
    }

    logExternalSource('external_sources.search.success', {
      adapter: SOURCE,
      url: searchUrl,
      status,
      parsedItems: parsed.items.length,
    });

    return parsed;
  },

  async getResource(externalId: string) {
    const slug = cleanText(decodeURIComponent(externalId)).replace(/^.*\/obra\//, '').replace(/\/$/, '');
    const resourceUrl = `${BASE_URL}/obra/${slug}/`;

    logExternalSource('external_sources.resource.start', {
      adapter: SOURCE,
      externalId: slug,
      url: resourceUrl,
    });

    const { html, finalUrl, status } = await fetchHtmlFromSource(SOURCE, resourceUrl);
    const resource = parseDetail(html, slug, finalUrl);

    logExternalSource('external_sources.resource.success', {
      adapter: SOURCE,
      externalId: slug,
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

    const fileType = /pdf/i.test(resource.downloadUrl) ? 'pdf' : 'epub';
    const mimeType = fileType === 'pdf' ? 'application/pdf' : 'application/epub+zip';

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
