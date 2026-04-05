import { createAdapter, fetchHtmlFromSource, logExternalSource } from './base';
import type { ExternalResource, SearchFilters } from '../types';
import { absoluteUrl, cleanText, loadDocument } from '../parsing/html';

const SOURCE = 'bne_digital' as const;
const BASE_URL = 'https://bnedigital.bne.es';

function buildSearchUrl(query: string, page = 1) {
  const params = new URLSearchParams({
    query,
    w: query,
    f: 'name',
    y: 's',
  });

  if (page > 1) {
    params.set('s', String((page - 1) * 10));
  }

  return `${BASE_URL}/bd/es/results?${params.toString()}`;
}

function parseSearch(html: string) {
  const $ = loadDocument(html);
  const items: ExternalResource[] = [];

  $('article.media').each((_, row) => {
    const shareUrl =
      $(row).find('input[value*="/bd/es/results?id="]').first().attr('value') ||
      '';
    const externalId = cleanText(shareUrl).match(/id=([a-f0-9-]+)/i)?.[1] || '';
    if (!externalId) return;

    const title = cleanText($(row).find('.list-item-name').first().text());
    const itemType = cleanText($(row).find('.list-item-type').first().text());
    const description = cleanText($(row).find('.list-item-description').first().text());
    const notice = cleanText($(row).find('.list-item-notice').first().text());
    const cardHref = absoluteUrl(BASE_URL, $(row).find('a[href*="/bd/es/card?sid="]').first().attr('href'));

    items.push({
      id: `${SOURCE}:${externalId}`,
      externalId,
      source: SOURCE,
      sourceUrl: `${BASE_URL}/bd/es/results?id=${externalId}`,
      title: title || `Registro ${externalId}`,
      description: description || notice || undefined,
      language: 'es',
      fileType: 'unknown',
      downloadable: false,
      licenseLabel: 'Biblioteca Nacional de España',
      licenseUrl: 'https://www.bne.es',
      metadata: {
        itemType,
        notice,
        cardUrl: cardHref || null,
      },
    });
  });

  const nextHref = $('a[title*="Siguiente"], .pagination a[rel="next"]').first().attr('href');

  return {
    items,
    total: items.length,
    nextPageToken: nextHref ? 'next' : null,
  };
}

function extractFields($: ReturnType<typeof loadDocument>) {
  const fields: Record<string, string> = {};

  $('label.label').each((_, label) => {
    const key = cleanText($(label).text()).toLowerCase();
    const value = cleanText($(label).next('.control').text());
    if (key && value) {
      fields[key] = value;
    }
  });

  return fields;
}

export const BneDigitalAdapter = createAdapter({
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
      parsed = { ...parsed, items: parsed.items.filter((item) => item.downloadable) };
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
    const detailUrl = `${BASE_URL}/bd/es/results?id=${encodeURIComponent(externalId)}`;

    logExternalSource('external_sources.resource.start', {
      adapter: SOURCE,
      externalId,
      url: detailUrl,
    });

    const { html, finalUrl, status } = await fetchHtmlFromSource(SOURCE, detailUrl);
    const $ = loadDocument(html);
    const row = $('article.media').first();
    const cardHref = absoluteUrl(BASE_URL, row.find('a[href*="/bd/es/card?sid="]').first().attr('href'));
    const detailLinks = row
      .find('a[href]')
      .map((_, link) => absoluteUrl(BASE_URL, $(link).attr('href')))
      .get()
      .filter(Boolean);

    let cardFields: Record<string, string> = {};
    let cardUrl = cardHref;

    if (cardHref) {
      const cardResponse = await fetchHtmlFromSource(SOURCE, cardHref);
      cardUrl = cardResponse.finalUrl;
      const cardDocument = loadDocument(cardResponse.html);
      cardFields = extractFields(cardDocument);
      detailLinks.push(
        ...cardDocument('a[href]')
          .map((_, link) => absoluteUrl(BASE_URL, cardDocument(link).attr('href')))
          .get()
          .filter(Boolean)
      );
    }

    const pdfLink = detailLinks.find((href) => /\.pdf(\?|$)/i.test(href));
    const epubLink = detailLinks.find((href) => /\.epub(\?|$)/i.test(href));
    const availableFormats: Array<'pdf' | 'epub' | 'html'> = ['html'];
    if (pdfLink) availableFormats.unshift('pdf');
    if (epubLink && !availableFormats.includes('epub')) availableFormats.unshift('epub');

    const resource: ExternalResource = {
      id: `${SOURCE}:${externalId}`,
      externalId,
      source: SOURCE,
      sourceUrl: finalUrl,
      title:
        cleanText(row.find('.list-item-name').first().text()) ||
        cardFields['título'] ||
        `Registro ${externalId}`,
      description:
        cleanText(row.find('.list-item-description').first().text()) ||
        cleanText(row.find('.list-item-notice').first().text()) ||
        undefined,
      publicationDate: cardFields['fecha'] || undefined,
      language: cardFields['idioma'] || 'es',
      fileType: pdfLink ? 'pdf' : epubLink ? 'epub' : 'html',
      downloadable: Boolean(pdfLink || epubLink),
      availableFormats,
      downloadUrl: pdfLink || epubLink || undefined,
      licenseLabel: 'Biblioteca Nacional de España',
      licenseUrl: 'https://www.bne.es',
      metadata: {
        cardUrl: cardUrl || null,
        cardFields,
      },
    };

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

    const fileType = /pdf/i.test(resource.downloadUrl) ? 'pdf' : 'epub';
    const mimeType = fileType === 'pdf' ? 'application/pdf' : 'application/epub+zip';

    return {
      url: resource.downloadUrl,
      fileType,
      mimeType,
      filename: `${resource.externalId}.${fileType}`,
    };
  },
});
