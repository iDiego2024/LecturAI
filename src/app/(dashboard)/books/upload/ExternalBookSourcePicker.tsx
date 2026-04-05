'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SourceKey } from '@/lib/external-sources/types';

type SourceRow = {
  id: string;
  key: SourceKey;
  name: string;
  baseUrl: string;
  isInstitutional?: boolean;
};

type ExternalBookResource = {
  id: string;
  externalId: string;
  source: SourceRow['key'];
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
  fileType?: 'pdf' | 'epub' | 'unknown' | 'html';
  downloadable: boolean;
  availableFormats?: Array<'pdf' | 'epub' | 'html'>;
  downloadUrl?: string;
  licenseLabel?: string;
  licenseUrl?: string;
  coverImageUrl?: string;
  metadata: Record<string, unknown>;
};

type SearchResponse = {
  items: ExternalBookResource[];
  page: number;
  nextPageToken?: string | null;
  warnings?: { source: string; message: string }[];
};

export default function ExternalBookSourcePicker({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [sourceKey, setSourceKey] = useState<'all' | SourceRow['key']>('all');
  const [query, setQuery] = useState('');
  const [downloadableOnly, setDownloadableOnly] = useState(true);
  const [fileType, setFileType] = useState<'pdf' | 'unknown' | 'epub'>('pdf');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [loadingSources, setLoadingSources] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<ExternalBookResource[]>([]);
  const [warnings, setWarnings] = useState<Array<{ source: string; message: string }>>([]);

  const [selected, setSelected] = useState<ExternalBookResource | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [healthLoading, setHealthLoading] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [healthResults, setHealthResults] = useState<
    Array<{
      key: string;
      name: string;
      baseUrl: string;
      ok: boolean;
      httpStatus?: number;
      latencyMs: number;
      message: string;
      checkedAt: string;
    }>
  >([]);

  useEffect(() => {
    const loadSources = async () => {
      setLoadingSources(true);
      try {
        const res = await fetch('/api/book-sources');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No fue posible cargar las fuentes.');
        setSources(data.sources || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No fue posible cargar las fuentes.');
      } finally {
        setLoadingSources(false);
      }
    };

    void loadSources();
  }, []);

  const runHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/book-sources/health');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No fue posible diagnosticar fuentes.');
      setHealthResults(data.results || []);
    } catch (err) {
      setHealthResults([
        {
          key: 'system',
          name: 'Diagnostico',
          baseUrl: '',
          ok: false,
          latencyMs: 0,
          message: err instanceof Error ? err.message : 'No fue posible diagnosticar fuentes.',
          checkedAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setHealthLoading(false);
    }
  };

  const sourceLabel = useMemo(() => {
    const map = new Map(sources.map((s) => [s.key, s.name]));
    return (key: string) => (key === 'all' ? 'Todas las fuentes' : map.get(key as any) || key);
  }, [sources]);

  const doSearch = async (nextPage: number) => {
    const q = query.trim();
    if (!q) {
      setError('Ingresa un titulo, autor o palabra clave para buscar.');
      return;
    }

    setLoading(true);
    setError('');
    setSelected(null);
    setDetailError('');
    setResults([]);
    setWarnings([]);
    setShowDiagnostics(false);
    setHealthResults([]);

    try {
      const res = await fetch('/api/book-sources/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          source: sourceKey,
          filters: {
            fileType,
            downloadableOnly,
          },
          page: nextPage,
          pageSize,
        }),
      });
      const data = (await res.json()) as SearchResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || 'No fue posible buscar recursos.');
        setResults(data.items || []);
        setWarnings(data.warnings || []);
        setPage(data.page || nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible buscar recursos oficiales.');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (item: ExternalBookResource) => {
    setSelected(item);
    setDetailError('');
    setDetailLoading(true);

    try {
      const params = new URLSearchParams({
        source: item.source,
        id: item.externalId,
      });
      const res = await fetch(`/api/book-sources/resource?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No fue posible cargar el detalle.');
      setSelected(data.resource as ExternalBookResource);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'No fue posible cargar el detalle.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selected) return;
    setImporting(true);
    setImportStatus('Importando recurso seleccionado…');

    try {
      setImportStatus('Descargando PDF desde la fuente oficial…');
      const res = await fetch('/api/book-sources/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: selected.source,
          externalId: selected.externalId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No fue posible importar el recurso.');

      setImportStatus('El archivo fue importado correctamente. Iniciando analisis del libro.');
      router.push(`/books/${data.bookId}`);
    } catch (err) {
      setImportStatus('');
      setDetailError(err instanceof Error ? err.message : 'No fue posible importar este recurso.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="external-picker">
      <div className="picker-head">
        <div>
          <h2 className="picker-title">Buscar desde fuentes oficiales y bibliotecas abiertas</h2>
          <p className="picker-subtitle">
            Consultamos desde el backend fuentes confiables, registramos la procedencia y solo importamos archivos compatibles para analizarlos dentro de tu cuenta.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Volver
        </button>
      </div>

      {loadingSources ? (
        <div className="loading-box glass-panel">Cargando fuentes oficiales…</div>
      ) : (
        <div className="picker-grid">
          <div className="search-panel glass-panel">
            <div className="form-group">
              <label>Buscar</label>
              <input
                className="input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ej: Sub terra, Baldomero Lillo, 6° básico, lectura…"
              />
            </div>

            <div className="filters">
              <div className="form-group">
                <label>Fuente</label>
                <select className="input" value={sourceKey} onChange={(event) => setSourceKey(event.target.value as any)}>
                  <option value="all">Todas las fuentes</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.key}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select className="input" value={fileType} onChange={(event) => setFileType(event.target.value as any)}>
                  <option value="pdf">PDF</option>
                  <option value="epub">EPUB</option>
                  <option value="unknown">Cualquiera</option>
                </select>
              </div>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={downloadableOnly}
                onChange={(event) => setDownloadableOnly(event.target.checked)}
              />
              Solo con descarga directa
            </label>

            <div className="actions-row">
              <button type="button" className="btn btn-primary" onClick={() => doSearch(1)} disabled={loading}>
                {loading ? 'Buscando…' : 'Buscar recursos'}
              </button>
              <div className="pager">
                <button type="button" className="btn btn-secondary" onClick={() => doSearch(Math.max(1, page - 1))} disabled={loading || page <= 1}>
                  Anterior
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => doSearch(page + 1)} disabled={loading}>
                  Siguiente
                </button>
              </div>
            </div>

            {error && <div className="error-alert">{error}</div>}
            {!error && warnings.length > 0 && (
              <div className="warning-alert">
                <strong>Algunas fuentes no respondieron:</strong>
                <div className="warning-list">
                  {warnings.map((warning) => (
                    <div key={warning.source}>
                      {sourceLabel(warning.source)}: {warning.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(error || warnings.length > 0) && (
              <div className="health-block">
                <button
                  type="button"
                  className="diagnostics-link"
                  onClick={() => setShowDiagnostics((value) => !value)}
                  aria-expanded={showDiagnostics}
                >
                  Opciones avanzadas
                </button>

                {showDiagnostics && (
                  <div className="health-panel">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={runHealth}
                      disabled={healthLoading}
                    >
                      {healthLoading ? 'Diagnosticando…' : 'Diagnosticar fuentes'}
                    </button>

                    {healthResults.length > 0 && (
                      <div className="health-results">
                        {healthResults.map((item) => (
                          <div key={item.key} className={`health-row ${item.ok ? 'ok' : 'bad'}`}>
                            <div className="health-name">{item.name}</div>
                            <div className="health-meta">
                              {item.ok ? 'OK' : 'ERROR'} · {item.latencyMs}ms
                              {typeof item.httpStatus === 'number' ? ` · HTTP ${item.httpStatus}` : ''}
                            </div>
                            <div className="health-message">{item.message}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="results">
              {loading ? (
                <div className="loading-inline">Buscando recursos oficiales…</div>
              ) : results.length === 0 ? (
                <div className="empty-inline">Sin resultados. Prueba con otro termino o cambia la fuente.</div>
              ) : (
                results.map((item) => (
                  <button key={`${item.source}:${item.id}`} type="button" className="result-card" onClick={() => loadDetail(item)}>
                    <div className="result-top">
                      <span className="badge">{sourceLabel(item.source)}</span>
                      <span className={`badge badge-soft ${item.source === 'elejandria' || item.source === 'wikisource_es' ? 'badge-open' : ''}`}>
                        {item.source === 'elejandria' || item.source === 'wikisource_es' ? 'Abierta' : 'Institucional'}
                      </span>
                      <span className="badge badge-soft">{(item.fileType || 'unknown').toUpperCase()}</span>
                      <span className={`badge ${item.downloadable ? 'badge-ok' : 'badge-warn'}`}>
                        {item.downloadable ? 'Descargable' : 'Sin descarga directa'}
                      </span>
                    </div>
                    <div className="result-title">{item.title}</div>
                    <div className="result-meta">{item.author || item.institutionalAuthor || 'Autor institucional'}</div>
                    {item.description && <div className="result-desc">{item.description}</div>}
                    {item.availableFormats && item.availableFormats.length > 0 && (
                      <div className="result-taxonomy">
                        {item.availableFormats.map((format) => (
                          <span key={format}>Formato {format.toUpperCase()}</span>
                        ))}
                      </div>
                    )}
                    {(item.schoolLevel || item.subject) && (
                      <div className="result-taxonomy">
                        {item.schoolLevel && <span>{item.schoolLevel}</span>}
                        {item.subject && <span>{item.subject}</span>}
                      </div>
                    )}
                    <div className="result-action">Ver detalles</div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="detail-panel glass-panel">
            {!selected ? (
              <div className="detail-empty">
                <div className="detail-icon">🔎</div>
                <h3>Selecciona un recurso</h3>
                <p>Abre el detalle para ver procedencia, licencia y confirmar la importacion.</p>
              </div>
            ) : (
              <div className="detail-body">
                <div className="detail-top">
                  <div>
                    <p className="detail-kicker">Detalle del recurso</p>
                    <h3 className="detail-title">{selected.title}</h3>
                    <p className="detail-meta">
                      {selected.author || selected.institutionalAuthor || 'Autor institucional'} · {sourceLabel(selected.source)}
                    </p>
                  </div>
                  <span className={`badge ${selected.downloadable ? 'badge-ok' : 'badge-warn'}`}>
                    {selected.downloadable ? 'Listo para importar' : 'No importable'}
                  </span>
                </div>

                {detailLoading && <div className="loading-inline">Cargando detalle…</div>}
                {detailError && <div className="error-alert">{detailError}</div>}

                {selected.description && <p className="detail-desc">{selected.description}</p>}

                <div className="detail-grid">
                  <div>
                    <div className="detail-label">Origen</div>
                    <a className="detail-link" href={selected.sourceUrl} target="_blank" rel="noreferrer">
                      Ver en fuente oficial
                    </a>
                  </div>
                  <div>
                    <div className="detail-label">Tipo</div>
                    <div className="detail-value">{(selected.fileType || 'unknown').toUpperCase()}</div>
                  </div>
                  <div>
                    <div className="detail-label">Formatos disponibles</div>
                    <div className="detail-value">
                      {selected.availableFormats?.length
                        ? selected.availableFormats.map((format) => format.toUpperCase()).join(', ')
                        : 'No informado'}
                    </div>
                  </div>
                  <div>
                    <div className="detail-label">Nivel / Curso</div>
                    <div className="detail-value">{selected.schoolLevel || selected.gradeRange || 'No informado'}</div>
                  </div>
                  <div>
                    <div className="detail-label">Asignatura / Tema</div>
                    <div className="detail-value">{selected.subject || 'No informado'}</div>
                  </div>
                  <div>
                    <div className="detail-label">Idioma</div>
                    <div className="detail-value">{selected.language || 'No informado'}</div>
                  </div>
                  <div>
                    <div className="detail-label">Licencia</div>
                    {selected.licenseLabel ? (
                      selected.licenseUrl ? (
                        <a className="detail-link" href={selected.licenseUrl} target="_blank" rel="noreferrer">
                          {selected.licenseLabel}
                        </a>
                      ) : (
                        <div className="detail-value">{selected.licenseLabel}</div>
                      )
                    ) : (
                      <div className="detail-value">No informada</div>
                    )}
                  </div>
                </div>

                <div className="license-note">
                  Al importar, registraremos la procedencia y usaremos el PDF solo para analisis y generacion de evaluaciones dentro de tu cuenta.
                </div>

                <div className="detail-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-glow"
                    onClick={handleImport}
                    disabled={importing || !selected.downloadable}
                  >
                    {importing ? 'Importando…' : 'Usar este recurso'}
                  </button>
                </div>

                {importStatus && <div className="loading-box">{importStatus}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .external-picker {
          display: grid;
          gap: 1rem;
        }
        .picker-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }
        .picker-title {
          margin: 0;
          font-size: 1.35rem;
          color: var(--text-primary);
        }
        .picker-subtitle {
          margin: 0.4rem 0 0;
          color: var(--text-secondary);
          max-width: 46rem;
        }
        .picker-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
          gap: 1rem;
        }
        .search-panel,
        .detail-panel {
          padding: 1.2rem;
          border: 1px solid var(--border-light);
          background: rgba(255, 252, 247, 0.92);
        }
        .filters {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 0.9rem;
        }
        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          margin: 0.75rem 0 0.5rem;
          color: var(--text-secondary);
          font-weight: 650;
        }
        .actions-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.85rem;
          flex-wrap: wrap;
          margin-top: 0.8rem;
        }
        .pager {
          display: flex;
          gap: 0.6rem;
        }
        .results {
          display: grid;
          gap: 0.75rem;
          margin-top: 1rem;
        }
        .result-card {
          border: 1px solid rgba(82, 52, 26, 0.1);
          background: rgba(255, 255, 255, 0.72);
          border-radius: 1.1rem;
          padding: 0.9rem 0.95rem;
          text-align: left;
          cursor: pointer;
          transition: transform 0.15s ease, border-color 0.15s ease;
        }
        .result-card:hover {
          transform: translateY(-1px);
          border-color: rgba(217, 102, 52, 0.25);
        }
        .result-top {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-bottom: 0.55rem;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 0.28rem 0.6rem;
          border-radius: 999px;
          background: rgba(217, 102, 52, 0.12);
          color: #8f3e1f;
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .badge-soft {
          background: rgba(82, 52, 26, 0.08);
          color: var(--text-secondary);
        }
        .badge-open {
          background: rgba(68, 114, 88, 0.12);
          color: #37624b;
        }
        .badge-ok {
          background: rgba(42, 147, 98, 0.12);
          color: #1e6d4b;
        }
        .badge-warn {
          background: rgba(193, 63, 63, 0.1);
          color: #a13e33;
        }
        .result-title {
          font-weight: 900;
          color: var(--text-primary);
          font-size: 1.05rem;
        }
        .result-meta {
          color: var(--text-secondary);
          font-weight: 700;
          margin-top: 0.2rem;
        }
        .result-desc {
          color: var(--text-secondary);
          margin-top: 0.45rem;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .result-action {
          margin-top: 0.6rem;
          font-weight: 800;
          color: rgba(217, 102, 52, 0.95);
        }
        .result-taxonomy {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-top: 0.55rem;
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-weight: 650;
        }
        .result-taxonomy span {
          padding: 0.24rem 0.55rem;
          border-radius: 999px;
          background: rgba(82, 52, 26, 0.06);
          border: 1px solid rgba(82, 52, 26, 0.08);
        }
        .detail-empty {
          display: grid;
          place-items: center;
          text-align: center;
          height: 100%;
          min-height: 20rem;
          padding: 2rem 1rem;
          color: var(--text-secondary);
        }
        .detail-icon {
          font-size: 2rem;
          opacity: 0.7;
        }
        .detail-body {
          display: grid;
          gap: 0.9rem;
        }
        .detail-top {
          display: flex;
          justify-content: space-between;
          gap: 0.8rem;
          align-items: flex-start;
        }
        .detail-kicker {
          margin: 0;
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 800;
        }
        .detail-title {
          margin: 0.25rem 0 0;
          color: var(--text-primary);
        }
        .detail-meta {
          margin: 0.35rem 0 0;
          color: var(--text-secondary);
          font-weight: 650;
        }
        .detail-desc {
          margin: 0;
          color: var(--text-secondary);
          line-height: 1.55;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.9rem;
        }
        .detail-label {
          font-size: 0.78rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 850;
          color: var(--text-muted);
          margin-bottom: 0.25rem;
        }
        .detail-link {
          display: inline-flex;
          color: rgba(217, 102, 52, 0.95);
          font-weight: 800;
          text-decoration: none;
        }
        .detail-link:hover {
          text-decoration: underline;
        }
        .detail-value {
          color: var(--text-primary);
          font-weight: 750;
        }
        .license-note {
          padding: 0.85rem 0.95rem;
          border-radius: 1rem;
          background: rgba(255, 245, 232, 0.9);
          border: 1px solid rgba(217, 102, 52, 0.15);
          color: var(--text-secondary);
          font-weight: 650;
          line-height: 1.45;
        }
        .detail-actions {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
        }
        .btn-glow {
          box-shadow: 0 14px 30px rgba(217, 102, 52, 0.22);
        }
        .loading-box {
          padding: 0.85rem 0.95rem;
          border-radius: 1rem;
          border: 1px dashed rgba(82, 52, 26, 0.16);
          color: var(--text-secondary);
          font-weight: 750;
        }
        .loading-inline,
        .empty-inline {
          padding: 0.9rem 0.95rem;
          border-radius: 1rem;
          background: rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(82, 52, 26, 0.08);
          color: var(--text-secondary);
          font-weight: 650;
        }
        .error-alert {
          margin-top: 0.8rem;
          padding: 0.95rem 1rem;
          border-radius: 1rem;
          border: 1px solid rgba(193, 63, 63, 0.26);
          background: rgba(255, 242, 242, 0.86);
          color: #a13e33;
          font-weight: 800;
        }
        .warning-alert {
          margin-top: 0.8rem;
          padding: 0.95rem 1rem;
          border-radius: 1rem;
          border: 1px solid rgba(82, 52, 26, 0.18);
          background: rgba(255, 249, 240, 0.9);
          color: var(--text-secondary);
          font-weight: 750;
        }
        .warning-list {
          margin-top: 0.6rem;
          display: grid;
          gap: 0.35rem;
          font-weight: 650;
        }
        .health-block {
          margin-top: 0.9rem;
          display: grid;
          gap: 0.7rem;
        }
        .health-panel {
          display: grid;
          gap: 0.7rem;
        }
        .diagnostics-link {
          appearance: none;
          border: none;
          background: transparent;
          padding: 0;
          text-align: left;
          cursor: pointer;
          color: var(--text-muted);
          font-weight: 750;
          letter-spacing: 0.02em;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .diagnostics-link:hover {
          color: var(--text-secondary);
        }
        .health-results {
          display: grid;
          gap: 0.55rem;
          padding: 0.8rem 0.85rem;
          border-radius: 1rem;
          border: 1px dashed rgba(82, 52, 26, 0.16);
          background: rgba(255, 255, 255, 0.6);
        }
        .health-row {
          display: grid;
          gap: 0.2rem;
          padding: 0.6rem 0.65rem;
          border-radius: 0.85rem;
          border: 1px solid rgba(82, 52, 26, 0.08);
          background: rgba(255, 255, 255, 0.72);
        }
        .health-row.ok {
          border-color: rgba(42, 147, 98, 0.18);
          background: rgba(238, 252, 246, 0.7);
        }
        .health-row.bad {
          border-color: rgba(193, 63, 63, 0.18);
          background: rgba(255, 242, 242, 0.7);
        }
        .health-name {
          font-weight: 900;
          color: var(--text-primary);
        }
        .health-meta {
          font-size: 0.85rem;
          font-weight: 750;
          color: var(--text-secondary);
        }
        .health-message {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.4;
          overflow-wrap: anywhere;
        }
        @media (max-width: 960px) {
          .picker-grid {
            grid-template-columns: 1fr;
          }
          .detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
