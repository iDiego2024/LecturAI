import { getExternalSourcesConfig } from '../config';
import { getResourceCache, setResourceCache } from '../cache/external-resource-cache';
import { getAdapter } from '../registry';
import type { ExternalResource, SourceKey } from '../types';

export async function getExternalResource(source: SourceKey, externalId: string) {
  const config = getExternalSourcesConfig();
  const cacheKey = `${source}:${externalId}`;
  const cached = getResourceCache<ExternalResource>(cacheKey);
  if (cached) return cached;

  const adapter = getAdapter(source);
  const resource = await adapter.getResource(externalId);
  if (!resource) return null;

  setResourceCache(cacheKey, resource, config.cacheTtlMs.resource);
  return resource;
}
