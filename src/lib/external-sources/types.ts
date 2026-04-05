export type SourceKey =
  | 'wikisource_es'
  | 'cervantes_virtual'
  | 'mineduc_biblioteca_digital'
  | 'memoria_chilena'
  | 'bne_digital'
  | 'elejandria'
  | 'project_gutenberg'
  | 'curriculum_cra_catalog';

export const SOURCE_KEYS: SourceKey[] = [
  'wikisource_es',
  'cervantes_virtual',
  'mineduc_biblioteca_digital',
  'memoria_chilena',
  'bne_digital',
  'elejandria',
  'project_gutenberg',
  'curriculum_cra_catalog',
];

export function isSourceKey(value: unknown): value is SourceKey {
  return typeof value === 'string' && SOURCE_KEYS.includes(value as SourceKey);
}

export type SearchFilters = {
  fileType?: 'pdf' | 'epub' | 'unknown';
  downloadableOnly?: boolean;
  schoolLevel?: string;
  subject?: string;
  gradeRange?: string;
  source?: SourceKey | 'all';
  language?: 'es';
};

export type ExternalResource = {
  id: string;
  source: SourceKey;
  externalId: string;
  sourceUrl: string;
  title: string;
  author?: string;
  institutionalAuthor?: string;
  description?: string;
  publicationDate?: string;
  language?: string;
  subject?: string;
  schoolLevel?: string;
  gradeRange?: string;
  fileType?: 'pdf' | 'epub' | 'html' | 'unknown';
  downloadable: boolean;
  availableFormats?: Array<'pdf' | 'epub' | 'html'>;
  downloadUrl?: string;
  licenseLabel?: string;
  licenseUrl?: string;
  coverImageUrl?: string;
  metadata: Record<string, unknown>;
};

export type SearchResult = {
  items: ExternalResource[];
  total?: number;
  nextPageToken?: string | null;
};

export type ResolvedDownload = {
  url: string;
  fileType: 'pdf' | 'epub';
  mimeType: string;
  filename?: string;
};

export interface SourceAdapter {
  source: SourceKey;
  search(query: string, filters?: SearchFilters, page?: number): Promise<SearchResult>;
  getResource(externalId: string): Promise<ExternalResource | null>;
  resolveDownload(resource: ExternalResource): Promise<ResolvedDownload | null>;
}
