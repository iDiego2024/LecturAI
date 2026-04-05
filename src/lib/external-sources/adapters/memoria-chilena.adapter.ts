import { createAdapter, fetchHtmlFromSource, logExternalSource } from './base';
import type { ExternalResource, SearchFilters } from '../types';
import { absoluteUrl, cleanText, loadDocument } from '../parsing/html';

const SOURCE = 'memoria_chilena' as const;
const BASE_URL = 'https://www.memoriachilena.gob.cl';

type MemoriaSearchBucket = {
  articles?: {
    results?: Array<Record<string, unknown>>;
    num_results?: number;
  };
  paginador?: {
    nextPage?: number;
    num_results?: number;
  };
};

function buildSearchUrl(query: string, page = 1, phrase = false) {
  const params = new URLSearchParams({
    keywords: query,
    searchmode: phrase ? 'phrase' : 'and',
  });

  if (page > 1) {
    params.set('start', String((page - 1) * 10));
  }

  return `${BASE_URL}/602/w3-search.php?${params.toString()}`;
}

function parseEmbeddedJson<T>(html: string, varName: string): T | null {
  const match = html.match(new RegExp(`${varName}\\s*=\\s*(\\{[\\s\\S]*?\\});`));
  if (!match?.[1]) return null;

  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

function mapMemoriaItem(raw: Record<string, unknown>, formatHint: string): ExternalResource {
  const externalId = String(raw.aid || raw.id || '').trim();
  const title = cleanText(String(raw.hl1 || raw.title || ''));
  const description = cleanText(String(raw.abstract || raw.description || ''));
  const sourceUrl = cleanText(String(raw.w3_link || ''));
  const coverImageUrl = cleanText(
    String(
      ((raw.binaries as Record<string, { link?: string }> | undefined)?.recurso_img1?.link as string) || ''
    )
  );
  const author = cleanText(
    String((raw['property-value_551_name'] as string) || (raw['property-value_551'] as { name?: string } | undefined)?.name || '')
  );

  const isPotentiallyDownloadable = ['Libro', 'Artículo', 'Capítulo', 'Fragmento'].some((label) =>
    formatHint.toLowerCase().includes(label.toLowerCase())
  );

  return {
    id: `${SOURCE}:${externalId}`,
    externalId,
    source: SOURCE,
    sourceUrl,
    title: title || `Recurso ${externalId}`,
    author: author || undefined,
    description: description || undefined,
    language: 'es',
    fileType: isPotentiallyDownloadable ? 'pdf' : 'unknown',
    downloadable: isPotentiallyDownloadable,
    availableFormats: isPotentiallyDownloadable ? ['pdf'] : [],
    coverImageUrl: coverImageUrl || undefined,
    metadata: {
      formatHint,
      raw,
    },
  };
}

function collectSearchItems(html: string, downloadableOnly: boolean) {
  const buckets = [
    {
      bucket: parseEmbeddedJson<MemoriaSearchBucket>(html, 'objetos_ntg_data'),
      formatName: 'Objeto digital',
    },
    {
      bucket: parseEmbeddedJson<MemoriaSearchBucket>(html, 'capsulas_ntg_data'),
      formatName: 'Cápsula',
    },
    {
      bucket: parseEmbeddedJson<MemoriaSearchBucket>(html, 'minisitios_ntg_data'),
      formatName: 'Minisitio',
    },
    {
      bucket: parseEmbeddedJson<MemoriaSearchBucket>(html, 'todos_ntg_data'),
      formatName: 'Resultado',
    },
  ];

  const dedupe = new Map<string, ExternalResource>();

  for (const entry of buckets) {
    const results = entry.bucket?.articles?.results || [];
    for (const raw of results) {
      const item = mapMemoriaItem(raw, entry.formatName);
      if (!item.externalId || !item.sourceUrl) continue;
      if (downloadableOnly && !item.downloadable) continue;
      if (!dedupe.has(item.externalId)) {
        dedupe.set(item.externalId, item);
      }
    }
  }

  const todosBucket = parseEmbeddedJson<MemoriaSearchBucket>(html, 'todos_ntg_data');
  return {
    items: Array.from(dedupe.values()),
    total:
      todosBucket?.articles?.num_results ||
      todosBucket?.paginador?.num_results ||
      dedupe.size,
    nextPageToken:
      typeof todosBucket?.paginador?.nextPage === 'number' &&
      todosBucket.paginador.nextPage > 0
        ? String(todosBucket.paginador.nextPage)
        : null,
  };
}

function parseMemoriaResource(html: string, externalId: string, finalUrl: string): ExternalResource {
  const $ = loadDocument(html);
  const title =
    cleanText($('#titulo_objeto_digital .titulo').first().text()) ||
    cleanText($('#titulo_articuloUI .titulo').first().text()) ||
    cleanText($('h1').first().text());
  const author = cleanText(
    $('.ar_clasificaciones .recuadro p')
      .filter((_, p) => cleanText($(p).text()).startsWith('Autor:'))
      .first()
      .text()
      .replace(/^Autor:\s*/i, '')
  );
  const description =
    cleanText($('#articuloUI p').first().text()) ||
    cleanText($('.descripcion').first().text());
  const subject = cleanText(
    $('.ar_clasificaciones .recuadro p')
      .filter((_, p) => cleanText($(p).text()).startsWith('Materias:'))
      .first()
      .text()
      .replace(/^Materias:\s*/i, '')
  );
  const year = cleanText(
    $('.ar_clasificaciones .recuadro p')
      .filter((_, p) => cleanText($(p).text()).startsWith('Año:'))
      .first()
      .text()
      .replace(/^Año:\s*/i, '')
  );
  const directDownloadHref = absoluteUrl(
    BASE_URL,
    $('.descargar_recurso a[href]').first().attr('href')
  );
  const relatedPdfHref =
    absoluteUrl(
      BASE_URL,
      $('#objetos_relacionados .recuadro .figure a[href$=".pdf"]').first().attr('href')
    ) ||
    absoluteUrl(
      BASE_URL,
      $('#objetos_relacionados .recuadro .figure a[href*="/archivos2/pdfs/"]').first().attr('href')
    );
  const downloadUrl = directDownloadHref || relatedPdfHref || '';
  const licenseLabel = cleanText($('.propiedad_intelectual .descripcion').first().text());
  const coverImageUrl = absoluteUrl(
    BASE_URL,
    $('.articuloUI_recursos img, #titulo_objeto_digital img, #titulo_articuloUI img')
      .first()
      .attr('src')
  );

  return {
    id: `${SOURCE}:${externalId}`,
    externalId,
    source: SOURCE,
    sourceUrl: finalUrl,
    title: title || `Recurso ${externalId}`,
    author: author || undefined,
    description: description || undefined,
    publicationDate: year || undefined,
    language: 'es',
    subject: subject || undefined,
    fileType: downloadUrl.toLowerCase().endsWith('.epub')
      ? 'epub'
      : downloadUrl.toLowerCase().includes('.pdf')
        ? 'pdf'
        : 'unknown',
    downloadable: Boolean(downloadUrl),
    availableFormats: downloadUrl
      ? [downloadUrl.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf']
      : [],
    downloadUrl: downloadUrl || undefined,
    licenseLabel: licenseLabel || undefined,
    coverImageUrl: coverImageUrl || undefined,
    metadata: {
      directDownloadHref: directDownloadHref || null,
      relatedPdfHref: relatedPdfHref || null,
    },
  };
}

export const MemoriaChilenaAdapter = createAdapter({
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
    const parsed = collectSearchItems(html, Boolean(filters?.downloadableOnly));

    logExternalSource('external_sources.search.success', {
      adapter: SOURCE,
      url: searchUrl,
      status,
      parsedItems: parsed.items.length,
    });

    return parsed;
  },
  async getResource(externalId: string) {
    const normalizedId = externalId.replace(/^.*:/, '').replace(/^w3-article-/, '').replace(/\.html$/, '');
    const resourceUrl = `${BASE_URL}/602/w3-article-${normalizedId}.html`;

    logExternalSource('external_sources.resource.start', {
      adapter: SOURCE,
      externalId: normalizedId,
      url: resourceUrl,
    });

    const { html, finalUrl, status } = await fetchHtmlFromSource(SOURCE, resourceUrl);
    const resource = parseMemoriaResource(html, normalizedId, finalUrl);

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

    const lowerUrl = resource.downloadUrl.toLowerCase();
    const fileType = lowerUrl.endsWith('.epub') ? 'epub' : 'pdf';
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
