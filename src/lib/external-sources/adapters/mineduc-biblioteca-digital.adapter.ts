import { createAdapter, ExternalSourceError, fetchHtmlFromSource, logExternalSource } from './base';
import type { ExternalResource, SearchFilters } from '../types';
import { absoluteUrl, cleanText, loadDocument, readMetaTags } from '../parsing/html';
import { getExternalSourcesConfig } from '../config';

const SOURCE = 'mineduc_biblioteca_digital' as const;
const BASE_URL = 'https://bibliotecadigital.mineduc.cl';

function normalizeHandleId(rawValue: string) {
  if (!rawValue) return '';
  const match = rawValue.match(/\/handle\/(.+)$/);
  if (match?.[1]) return match[1];
  return rawValue.replace(/^\/+/, '');
}

function buildSearchUrl(query: string, page: number) {
  const params = new URLSearchParams({
    rpp: '10',
    etal: '0',
    query,
    group_by: 'none',
    page: String(page),
  });
  return `${BASE_URL}/discover?${params.toString()}`;
}

function pickSummaryValueForBox(
  $: ReturnType<typeof loadDocument>,
  box: any,
  termMatch: RegExp
) {
  let found = '';
  $(box)
    .find('.o-resource__term')
    .each((_, term) => {
      const label = cleanText($(term).text());
      if (!termMatch.test(label)) return;
      const value = cleanText($(term).next('.o-resource__def').text());
      if (value) found = value;
    });
  return found;
}

function parseSearchResults(html: string) {
  const $ = loadDocument(html);
  const items: ExternalResource[] = [];

  $('#aspect_discovery_SimpleSearch_div_search-results .o-box').each((_, box) => {
    const titleLink = $(box).find('.o-resource__title').first();
    const handleHref = absoluteUrl(BASE_URL, titleLink.attr('href'));
    const externalId = normalizeHandleId(handleHref);
    if (!handleHref || !externalId) return;

    const title = cleanText(titleLink.text());
    const author =
      pickSummaryValueForBox($, box, /autor\(es\)|autor$/i) ||
      pickSummaryValueForBox($, box, /corporativo/i);
    const publicationDate = pickSummaryValueForBox($, box, /fecha de publicaci/i);
    const subject = pickSummaryValueForBox($, box, /tem[aá]tica/i);
    const description = cleanText($(box).find('.abstract').first().text());
    const imageUrl = absoluteUrl(BASE_URL, $(box).find('.o-resource__image').first().attr('src'));
    const downloadable = imageUrl.includes('/bitstream/handle/') && imageUrl.toLowerCase().includes('.pdf.jpg');

    items.push({
      id: `${SOURCE}:${externalId}`,
      externalId,
      source: SOURCE,
      sourceUrl: handleHref,
      title: title || `Recurso ${externalId}`,
      author: author || undefined,
      description: description || undefined,
      publicationDate: publicationDate || undefined,
      language: 'es',
      subject: subject || undefined,
      fileType: downloadable ? 'pdf' : 'unknown',
      downloadable,
      availableFormats: downloadable ? ['pdf'] : [],
      coverImageUrl: imageUrl || undefined,
      metadata: {
        previewImage: imageUrl || null,
      },
    });
  });

  const nextPageToken = $('.c-paginator__link.next-page-link').attr('href') ? 'next' : null;
  const totalMatch = cleanText($('.pagination-info').text()).match(/of\s+(\d+)/i);
  return {
    items,
    total: totalMatch ? Number(totalMatch[1]) : undefined,
    nextPageToken,
  };
}

function parseMineducResource(html: string, fallbackUrl: string, externalId: string): ExternalResource {
  const $ = loadDocument(html);
  const meta = readMetaTags(html);
  const config = getExternalSourcesConfig();

  const parseHumanSizeToBytes = (value: string) => {
    const normalized = value.replace(/\s+/g, '').trim();
    const match = normalized.match(/(\d+(?:\.\d+)?)(bytes|b|kb|mb|gb)$/i);
    if (!match) return 0;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) return 0;
    const unit = match[2].toLowerCase();
    if (unit === 'bytes' || unit === 'b') return Math.round(amount);
    if (unit === 'kb') return Math.round(amount * 1024);
    if (unit === 'mb') return Math.round(amount * 1024 * 1024);
    if (unit === 'gb') return Math.round(amount * 1024 * 1024 * 1024);
    return 0;
  };

  const title =
    meta['DC.title']?.[0] ||
    meta['DCTERMS.title']?.[0] ||
    cleanText($('.item-page-field-wrapper h2, .item-page-title').first().text());
  const author =
    meta['DC.creator']?.[0] ||
    meta['DC.contributor']?.[0] ||
    meta['DCTERMS.creator']?.[0] ||
    cleanText($('.item-page-field-wrapper .simple-item-view-authors').first().text());
  const description =
    meta['DC.description']?.[0] ||
    meta['DCTERMS.abstract']?.[0] ||
    cleanText($('.item-page-field-wrapper .simple-item-view-description').first().text());
  const publicationDate =
    meta['DCTERMS.issued']?.[0] ||
    meta['DC.date']?.[0] ||
    '';
  const subject =
    meta['DC.subject']?.join(' · ') ||
    cleanText($('.item-page-field-wrapper .simple-item-view-subject').first().text());

  const bitstreamLinks = $('a[href*="/bitstream/handle/"]')
    .map((_, link) => {
      const url = absoluteUrl(BASE_URL, $(link).attr('href'));
      const text = cleanText($(link).text());
      return { url, text };
    })
    .get()
    .filter((entry) => Boolean(entry.url));

  const pdfCandidates = bitstreamLinks
    .filter((entry) => {
      const lower = entry.url.toLowerCase();
      return lower.includes('.pdf') && !lower.includes('.pdf.jpg');
    })
    .map((entry) => {
      const sizeMatch = entry.text.match(/\(([^)]+)\)/);
      const bytes = sizeMatch?.[1] ? parseHumanSizeToBytes(sizeMatch[1]) : 0;
      return { ...entry, bytes };
    });

  const primaryButtonUrl = absoluteUrl(
    BASE_URL,
    $('a.o-btn[href*="/bitstream/handle/"]').first().attr('href')
  );

  const pickBestPdf = () => {
    const uniqueByUrl = new Map<string, { url: string; text: string; bytes: number }>();
    for (const item of pdfCandidates) uniqueByUrl.set(item.url, item);
    const unique = Array.from(uniqueByUrl.values());

    const primary =
      primaryButtonUrl && uniqueByUrl.get(primaryButtonUrl)
        ? uniqueByUrl.get(primaryButtonUrl)!
        : primaryButtonUrl
          ? { url: primaryButtonUrl, text: '', bytes: 0 }
          : null;

    const underLimit = unique
      .filter((item) => item.bytes > 0 && item.bytes <= config.maxDownloadBytes)
      .sort((a, b) => a.bytes - b.bytes);

    if (primary && primary.bytes > 0 && primary.bytes <= config.maxDownloadBytes) return primary;
    if (underLimit.length > 0) return underLimit[0];
    if (primary) return primary;
    return unique[0] || null;
  };

  const selectedPdf = pickBestPdf();
  const preferredPdf = selectedPdf?.url || '';

  const licenseLabel = meta['DC.rights']?.[0] || undefined;
  const licenseUrl = meta['DCTERMS.license']?.[0] || undefined;
  const coverImageUrl = absoluteUrl(
    BASE_URL,
    $('img[src*="/bitstream/handle/"]').first().attr('src')
  );

  return {
    id: `${SOURCE}:${externalId}`,
    externalId,
    source: SOURCE,
    sourceUrl: fallbackUrl,
    title: cleanText(title) || `Recurso ${externalId}`,
    author: cleanText(author) || undefined,
    description: cleanText(description) || undefined,
    publicationDate: cleanText(publicationDate) || undefined,
    language: 'es',
    subject: cleanText(subject) || undefined,
    fileType: preferredPdf ? 'pdf' : 'unknown',
    downloadable: Boolean(preferredPdf),
    availableFormats: preferredPdf ? ['pdf'] : [],
    downloadUrl: preferredPdf || undefined,
    licenseLabel: cleanText(licenseLabel) || undefined,
    licenseUrl: cleanText(licenseUrl) || undefined,
    coverImageUrl: coverImageUrl || undefined,
    metadata: {
      meta,
      bitstreams: pdfCandidates.map((item) => ({ url: item.url, bytes: item.bytes || null })),
      selectedBitstream: selectedPdf
        ? { url: selectedPdf.url, bytes: selectedPdf.bytes || null }
        : null,
      maxDownloadBytes: config.maxDownloadBytes,
    },
  };
}

export const MineducBibliotecaDigitalAdapter = createAdapter({
  source: SOURCE,
  async search(query: string, filters?: SearchFilters, page = 1) {
    const searchUrl = buildSearchUrl(query, Math.max(1, page));
    logExternalSource('external_sources.search.start', {
      adapter: SOURCE,
      url: searchUrl,
      query,
      page,
    });

    const { html, status } = await fetchHtmlFromSource(SOURCE, searchUrl);
    const parsed = parseSearchResults(html);

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
      total: parsed.total,
      nextPageToken: parsed.nextPageToken,
    };
  },
  async getResource(externalId: string) {
    const normalizedId = normalizeHandleId(externalId);
    const resourceUrl = `${BASE_URL}/handle/${normalizedId}`;

    logExternalSource('external_sources.resource.start', {
      adapter: SOURCE,
      externalId: normalizedId,
      url: resourceUrl,
    });

    const { html, finalUrl, status } = await fetchHtmlFromSource(SOURCE, resourceUrl);
    const resource = parseMineducResource(html, finalUrl, normalizedId);

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

    if (!resource.downloadUrl.toLowerCase().includes('.pdf')) {
      throw new ExternalSourceError(
        'unsupported_download',
        'El recurso no tiene un archivo PDF descargable.',
        400,
        {
          adapter: SOURCE,
          externalId: resource.externalId,
          downloadUrl: resource.downloadUrl,
        }
      );
    }

    logExternalSource('external_sources.download.resolved', {
      adapter: SOURCE,
      externalId: resource.externalId,
      url: resource.downloadUrl,
    });

    return {
      url: resource.downloadUrl,
      fileType: 'pdf',
      mimeType: 'application/pdf',
      filename: `${resource.externalId}.pdf`,
    };
  },
});
