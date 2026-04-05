import { getExternalSourcesConfig } from '../config';
import { getSearchCache, setSearchCache } from '../cache/external-resource-cache';
import { getAdapter, listEnabledAdapters } from '../registry';
import type { ExternalResource, SearchFilters, SearchResult, SourceKey } from '../types';
import { ExternalSourceError } from '../adapters/base';

type SearchInput = {
  query: string;
  source?: SourceKey | 'all';
  filters?: SearchFilters;
  page?: number;
};

export type SearchExternalResourcesResult = SearchResult & {
  page: number;
  warnings: Array<{ source: SourceKey; message: string }>;
};

function buildSearchCacheKey(input: SearchInput, source: SourceKey) {
  return JSON.stringify({
    source,
    query: input.query.trim().toLowerCase(),
    filters: input.filters || {},
    page: input.page || 1,
  });
}

function dedupeItems(items: ExternalResource[]) {
  const map = new Map<string, ExternalResource>();
  for (const item of items) {
    map.set(`${item.source}:${item.externalId}`, item);
  }
  return Array.from(map.values());
}

function normalizeForRanking(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function rankItems(items: ExternalResource[], query: string) {
  const normalizedQuery = normalizeForRanking(query);
  const institutionalSources = new Set<SourceKey>([
    'mineduc_biblioteca_digital',
    'memoria_chilena',
    'bne_digital',
    'curriculum_cra_catalog',
  ]);

  return [...items].sort((a, b) => {
    const score = (item: ExternalResource) => {
      const title = normalizeForRanking(item.title);
      const author = normalizeForRanking(item.author || item.institutionalAuthor || '');
      const fileBoost = item.fileType === 'pdf' ? 28 : item.fileType === 'epub' ? 24 : item.fileType === 'html' ? 6 : 0;
      const languageBoost = item.language?.toLowerCase() === 'es' ? 40 : 0;
      const downloadableBoost = item.downloadable ? 32 : 0;
      const institutionalBoost = institutionalSources.has(item.source) ? 18 : 8;
      const exactTitleBoost = title === normalizedQuery ? 90 : title.includes(normalizedQuery) ? 50 : 0;
      const authorBoost = author.includes(normalizedQuery) ? 18 : 0;
      return fileBoost + languageBoost + downloadableBoost + institutionalBoost + exactTitleBoost + authorBoost;
    };

    return score(b) - score(a);
  });
}

function applyCommonFilters(items: ExternalResource[], filters?: SearchFilters) {
  let nextItems = items;

  if (filters?.downloadableOnly) {
    nextItems = nextItems.filter((item) => item.downloadable);
  }

  if (filters?.fileType && filters.fileType !== 'unknown') {
    nextItems = nextItems.filter((item) => item.fileType === filters.fileType);
  }

  if (filters?.subject) {
    const expected = filters.subject.toLowerCase();
    nextItems = nextItems.filter((item) => (item.subject || '').toLowerCase().includes(expected));
  }

  if (filters?.schoolLevel) {
    const expected = filters.schoolLevel.toLowerCase();
    nextItems = nextItems.filter((item) =>
      ((item.schoolLevel || '') + ' ' + (item.gradeRange || '')).toLowerCase().includes(expected)
    );
  }

  if (filters?.language) {
    const expected = filters.language.toLowerCase();
    nextItems = nextItems.filter((item) => (item.language || '').toLowerCase().includes(expected));
  }

  return nextItems;
}

export async function searchExternalResources(
  input: SearchInput
): Promise<SearchExternalResourcesResult> {
  const config = getExternalSourcesConfig();
  const page = Math.max(1, input.page || 1);
  const query = input.query.trim();

  const adapters =
    !input.source || input.source === 'all'
      ? listEnabledAdapters()
      : config.enabledSources[input.source]
        ? [getAdapter(input.source)]
        : [];

  const warnings: Array<{ source: SourceKey; message: string }> = [];
  const collected: ExternalResource[] = [];
  let nextPageToken: string | null = null;
  let total = 0;

  for (const adapter of adapters) {
    const cacheKey = buildSearchCacheKey(input, adapter.source);
    const cached = getSearchCache<SearchResult>(cacheKey);

    if (cached) {
      collected.push(...cached.items);
      total += cached.total || 0;
      if (cached.nextPageToken) nextPageToken = cached.nextPageToken;
      continue;
    }

    try {
      const result = await adapter.search(query, input.filters, page);
      setSearchCache(cacheKey, result, config.cacheTtlMs.search);
      collected.push(...result.items);
      total += result.total || 0;
      if (result.nextPageToken) nextPageToken = result.nextPageToken;
    } catch (error) {
      warnings.push({
        source: adapter.source,
        message:
          error instanceof ExternalSourceError || error instanceof Error
            ? error.message
            : 'No fue posible consultar esta fuente en este momento.',
      });
    }
  }

  const items = rankItems(applyCommonFilters(dedupeItems(collected), input.filters), query);
  return {
    items,
    total: total || items.length,
    nextPageToken,
    warnings,
    page,
  };
}
