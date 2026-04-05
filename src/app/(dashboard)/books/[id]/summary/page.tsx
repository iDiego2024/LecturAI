import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PrintPdfButton from '@/components/PrintPdfButton';
import ShareButton from '@/components/ShareByEmailButton';

function formatRole(role?: string) {
  if (!role) return 'personaje';
  return role.replace(/_/g, ' ');
}

function formatSpaceType(type?: string) {
  switch (type) {
    case 'physical':
    case 'physcial':
      return 'fisico';
    case 'psychological':
      return 'psicologico';
    case 'social':
      return 'social';
    default:
      return type || 'sin clasificar';
  }
}

export default async function BookSummaryPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lectur-ai.vercel.app';

  if (!user) {
    redirect('/login');
  }

  const { data: book, error } = await supabase
    .from('books')
    .select('id, title, author, summary, raw_text, page_count, user_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !book) {
    notFound();
  }

  const summaryText = book.summary || 'Todavia no hay un resumen disponible para este libro.';

  const { data: entities } = await supabase
    .from('book_entities')
    .select('*')
    .eq('book_id', book.id)
    .order('importance_score', { ascending: false });

  const { data: themes } = await supabase
    .from('book_themes')
    .select('*')
    .eq('book_id', book.id)
    .order('theme_name', { ascending: true });

  const { data: chapters } = await supabase
    .from('book_chapters')
    .select('*')
    .eq('book_id', book.id)
    .order('chapter_number', { ascending: true });

  const { data: relationships } = await supabase
    .from('book_character_relationships')
    .select('*')
    .eq('book_id', book.id)
    .order('importance_score', { ascending: false });

  const allEntities = (entities as any[]) || [];
  const characters = allEntities.filter((entity) => entity.entity_type === 'character');
  const events = allEntities
    .filter((entity) => entity.entity_type === 'event')
    .sort(
      (a, b) =>
        (((a.metadata as any)?.chronological_order as number | undefined) || 9999) -
        (((b.metadata as any)?.chronological_order as number | undefined) || 9999)
    );
  const conflicts = allEntities.filter((entity) => entity.entity_type === 'conflict');
  const spaces = allEntities.filter((entity) => entity.entity_type === 'space');
  const processedExcerpt = book.raw_text?.trim();

  return (
    <div className="summary-page animate-fade-in">
      <div className="summary-header">
        <div>
          <Link href={`/books/${params.id}`} className="back-link">
            ← Volver al libro
          </Link>
          <h1 className="page-title">Resumen completo</h1>
          <p className="page-subtitle">
            {book.title}
            {book.author ? ` • ${book.author}` : ''}
          </p>
        </div>
        <div className="summary-actions">
          <PrintPdfButton label="Guardar resumen como PDF" />
          <ShareButton
            subject={`Resumen del libro: ${book.title}`}
            body={`Te comparto el resumen del libro "${book.title}".`}
            shareUrl={`${appUrl}/books/${params.id}/summary`}
          />
        </div>
      </div>

      <section className="summary-grid">
        <article className="summary-card glass-panel">
          <div className="section-head">
            <span className="section-kicker">Vista imprimible</span>
            <h2 className="section-title">Resumen de la obra</h2>
          </div>
          <p className="summary-text">{summaryText}</p>
        </article>

        <aside className="summary-card glass-panel stats-card">
          <div className="section-head">
            <span className="section-kicker">Panorama</span>
            <h2 className="section-title">Sintesis de extraccion</h2>
          </div>
          <div className="stats-list">
            <div className="stat-item">
              <span className="stat-label">Paginas leidas</span>
              <strong>{book.page_count || 0}</strong>
            </div>
            <div className="stat-item">
              <span className="stat-label">Personajes detectados</span>
              <strong>{characters.length}</strong>
            </div>
            <div className="stat-item">
              <span className="stat-label">Acontecimientos clave</span>
              <strong>{events.length}</strong>
            </div>
            <div className="stat-item">
              <span className="stat-label">Capitulos resumidos</span>
              <strong>{(chapters as any[])?.length || 0}</strong>
            </div>
            <div className="stat-item">
              <span className="stat-label">Interacciones entre personajes</span>
              <strong>{(relationships as any[])?.length || 0}</strong>
            </div>
            <div className="stat-item">
              <span className="stat-label">Conflictos identificados</span>
              <strong>{conflicts.length}</strong>
            </div>
            <div className="stat-item">
              <span className="stat-label">Espacios relevantes</span>
              <strong>{spaces.length}</strong>
            </div>
            <div className="stat-item">
              <span className="stat-label">Tematicas principales</span>
              <strong>{(themes as any[])?.length || 0}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="analysis-section glass-panel">
        <div className="section-head">
          <span className="section-kicker">Analisis narrativo</span>
          <h2 className="section-title">Personajes detectados</h2>
        </div>
        <div className="analysis-grid">
          {characters.length > 0 ? (
            characters.map((char) => (
              <article key={char.id} className="analysis-card">
                <div className="card-topline">
                  <h3>{char.name}</h3>
                  <span className="entity-badge">{formatRole((char.metadata as any)?.role)}</span>
                </div>
                <p>{char.description}</p>
                {(char.metadata as any)?.first_appearance && (
                  <p className="support-text">
                    <strong>Primera aparicion:</strong> {(char.metadata as any).first_appearance}
                  </p>
                )}
                {Array.isArray((char.metadata as any)?.aliases) &&
                  (char.metadata as any).aliases.length > 0 && (
                    <p className="support-text">
                      <strong>Alias:</strong>{' '}
                      {((char.metadata as any).aliases as string[]).join(', ')}
                    </p>
                  )}
                {Array.isArray((char.metadata as any)?.traits) &&
                  (char.metadata as any).traits.length > 0 && (
                    <div className="tag-list">
                      {((char.metadata as any).traits as string[]).map((trait, index) => (
                        <span key={index} className="tag-item">
                          {trait}
                        </span>
                      ))}
                    </div>
                  )}
                {Array.isArray((char.metadata as any)?.chapter_presence) &&
                  (char.metadata as any).chapter_presence.length > 0 && (
                    <p className="support-text">
                      <strong>Presencia:</strong> capitulos{' '}
                      {((char.metadata as any).chapter_presence as number[]).join(', ')}
                    </p>
                  )}
              </article>
            ))
          ) : (
            <p className="empty-state">Todavia no hay personajes registrados para esta obra.</p>
          )}
        </div>
      </section>

      <section className="analysis-section glass-panel">
        <div className="section-head">
          <span className="section-kicker">Estructura</span>
          <h2 className="section-title">Resumen por capitulos</h2>
        </div>
        <div className="stack-list">
          {(chapters as any[])?.length > 0 ? (
            (chapters as any[]).map((chapter: any) => (
              <article key={chapter.id} className="analysis-card">
                <div className="card-topline">
                  <h3>
                    Capitulo {chapter.chapter_number}: {chapter.title}
                  </h3>
                  <span className="entity-badge">
                    {chapter.start_page || chapter.end_page
                      ? `pag. ${chapter.start_page || '?'}-${chapter.end_page || chapter.start_page || '?'}`
                      : 'sin pagina'}
                  </span>
                </div>
                <p>{chapter.summary}</p>
                {Array.isArray(chapter.key_characters) && chapter.key_characters.length > 0 && (
                  <p className="support-text">
                    <strong>Personajes clave:</strong> {chapter.key_characters.join(', ')}
                  </p>
                )}
                {Array.isArray(chapter.key_events) && chapter.key_events.length > 0 && (
                  <p className="support-text">
                    <strong>Eventos clave:</strong> {chapter.key_events.join(' · ')}
                  </p>
                )}
              </article>
            ))
          ) : (
            <p className="empty-state">Todavia no hay capitulos resumidos para esta obra.</p>
          )}
        </div>
      </section>

      <section className="analysis-section glass-panel">
        <div className="section-head">
          <span className="section-kicker">Trama</span>
          <h2 className="section-title">Acontecimientos en orden cronologico</h2>
        </div>
        <div className="timeline-list">
          {events.length > 0 ? (
            events.map((event) => (
              <article key={event.id} className="timeline-item">
                <div className="timeline-order">
                  {(event.metadata as any)?.chronological_order || '•'}
                </div>
                <div className="timeline-content">
                  <h3>{event.name}</h3>
                  <p>{event.description}</p>
                  {(event.metadata as any)?.chapter_number && (
                    <p className="support-text">
                      <strong>Capitulo:</strong> {(event.metadata as any).chapter_number}
                    </p>
                  )}
                  {Array.isArray((event.metadata as any)?.involved_characters) &&
                    (event.metadata as any).involved_characters.length > 0 && (
                      <p className="support-text">
                        <strong>Participan:</strong>{' '}
                        {((event.metadata as any).involved_characters as string[]).join(', ')}
                      </p>
                    )}
                  {(event.metadata as any)?.evidence && (
                    <p className="support-text">
                      <strong>Ubicacion narrativa:</strong> {(event.metadata as any).evidence}
                    </p>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className="empty-state">Todavia no hay acontecimientos registrados para esta obra.</p>
          )}
        </div>
      </section>

      <section className="analysis-section glass-panel">
        <div className="section-head">
          <span className="section-kicker">Vinculos</span>
          <h2 className="section-title">Interacciones entre personajes</h2>
        </div>
        <div className="analysis-grid">
          {(relationships as any[])?.length > 0 ? (
            (relationships as any[]).map((relationship: any) => (
              <article key={relationship.id} className="analysis-card">
                <div className="card-topline">
                  <h3>
                    {relationship.source_character} ↔ {relationship.target_character}
                  </h3>
                  <span className="entity-badge">{relationship.relationship_type || 'relacion'}</span>
                </div>
                <p>{relationship.description}</p>
                {relationship.evolution && (
                  <p className="support-text">
                    <strong>Evolucion:</strong> {relationship.evolution}
                  </p>
                )}
              </article>
            ))
          ) : (
            <p className="empty-state">Todavia no hay interacciones registradas para esta obra.</p>
          )}
        </div>
      </section>

      <section className="dual-section">
        <article className="analysis-section glass-panel">
          <div className="section-head">
            <span className="section-kicker">Conflictos</span>
            <h2 className="section-title">Nudos narrativos</h2>
          </div>
          <div className="stack-list">
            {conflicts.length > 0 ? (
              conflicts.map((conflict) => (
                <article key={conflict.id} className="analysis-card">
                  <div className="card-topline">
                    <h3>{conflict.name}</h3>
                    <span className="entity-badge">
                      {(conflict.metadata as any)?.type === 'main' ? 'principal' : 'secundario'}
                    </span>
                  </div>
                  <p>{conflict.description}</p>
                  {Array.isArray((conflict.metadata as any)?.involved_characters) &&
                    (conflict.metadata as any).involved_characters.length > 0 && (
                      <p className="support-text">
                        <strong>Involucrados:</strong>{' '}
                        {((conflict.metadata as any).involved_characters as string[]).join(', ')}
                      </p>
                    )}
                  <p className="support-text">
                    <strong>Resolucion:</strong>{' '}
                    {(conflict.metadata as any)?.resolution || 'No especificada.'}
                  </p>
                </article>
              ))
            ) : (
              <p className="empty-state">Todavia no hay conflictos registrados para esta obra.</p>
            )}
          </div>
        </article>

        <article className="analysis-section glass-panel">
          <div className="section-head">
            <span className="section-kicker">Ambientes</span>
            <h2 className="section-title">Espacios relevantes</h2>
          </div>
          <div className="stack-list">
            {spaces.length > 0 ? (
              spaces.map((space) => (
                <article key={space.id} className="analysis-card">
                  <div className="card-topline">
                    <h3>{space.name}</h3>
                    <span className="entity-badge">
                      {formatSpaceType((space.metadata as any)?.type)}
                    </span>
                  </div>
                  <p>{space.description}</p>
                  {Array.isArray((space.metadata as any)?.related_chapters) &&
                    (space.metadata as any).related_chapters.length > 0 && (
                      <p className="support-text">
                        <strong>Capitulos:</strong>{' '}
                        {((space.metadata as any).related_chapters as number[]).join(', ')}
                      </p>
                    )}
                </article>
              ))
            ) : (
              <p className="empty-state">Todavia no hay espacios registrados para esta obra.</p>
            )}
          </div>
        </article>
      </section>

      <section className="analysis-section glass-panel">
        <div className="section-head">
          <span className="section-kicker">Lectura critica</span>
          <h2 className="section-title">Tematicas principales</h2>
        </div>
        <div className="analysis-grid">
          {(themes as any[])?.length ? (
            (themes as any[]).map((theme: any) => (
              <article key={theme.id} className="analysis-card">
                <div className="card-topline">
                  <h3>{theme.theme_name}</h3>
                </div>
                <p>{theme.description}</p>
                {Array.isArray((theme.evidence as any)?.related_chapters) &&
                  (theme.evidence as any).related_chapters.length > 0 && (
                    <p className="support-text">
                      <strong>Capitulos asociados:</strong>{' '}
                      {((theme.evidence as any).related_chapters as number[]).join(', ')}
                    </p>
                  )}
                {Array.isArray((theme.evidence as any)?.evidence) &&
                  (theme.evidence as any).evidence.length > 0 && (
                    <p className="support-text">
                      <strong>Evidencias:</strong>{' '}
                      {((theme.evidence as any).evidence as string[]).join(' · ')}
                    </p>
                  )}
              </article>
            ))
          ) : (
            <p className="empty-state">Todavia no hay tematicas registradas para esta obra.</p>
          )}
        </div>
      </section>

      {processedExcerpt && (
        <section className="analysis-section glass-panel">
          <div className="section-head">
            <span className="section-kicker">Texto base</span>
            <h2 className="section-title">Extracto procesado por la IA</h2>
          </div>
          <p className="support-text excerpt-note">
            Se muestra el texto almacenado como respaldo del procesamiento para acompanar el
            resumen exportable.
          </p>
          <div className="excerpt-box">{processedExcerpt}</div>
        </section>
      )}

      <style>{`
        .summary-page {
          max-width: 1100px;
          margin: 0 auto;
          padding-bottom: 3rem;
        }
        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .back-link {
          display: inline-block;
          margin-bottom: 0.75rem;
          color: var(--text-muted);
        }
        .summary-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .summary-grid,
        .dual-section {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .summary-card {
          padding: 2rem;
          background: linear-gradient(180deg, rgba(255, 253, 248, 0.96) 0%, rgba(255, 244, 230, 0.94) 100%);
        }
        .analysis-section {
          padding: 1.5rem;
          margin-bottom: 1rem;
          background: linear-gradient(180deg, rgba(255, 252, 247, 0.98) 0%, rgba(255, 246, 235, 0.95) 100%);
        }
        .section-head {
          margin-bottom: 1rem;
        }
        .section-kicker {
          display: inline-block;
          margin-bottom: 0.35rem;
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .section-title {
          margin: 0;
          color: var(--text-primary);
          font-size: 1.35rem;
        }
        .summary-text {
          white-space: pre-wrap;
          color: var(--text-secondary);
          line-height: 1.9;
          font-size: 1.05rem;
        }
        .stats-card {
          align-self: start;
        }
        .stats-list {
          display: grid;
          gap: 0.75rem;
        }
        .stat-item {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.9rem 1rem;
          border-radius: var(--radius-md);
          background: rgba(255, 250, 242, 0.88);
          border: 1px solid var(--border-light);
          color: var(--text-secondary);
        }
        .stat-label {
          color: var(--text-muted);
        }
        .analysis-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1rem;
        }
        .stack-list,
        .timeline-list {
          display: grid;
          gap: 1rem;
        }
        .analysis-card,
        .timeline-item {
          border: 1px solid var(--border-light);
          background: rgba(255, 250, 242, 0.88);
          border-radius: var(--radius-md);
          padding: 1rem 1.1rem;
        }
        .card-topline {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }
        .card-topline h3,
        .timeline-content h3 {
          margin: 0;
          color: var(--text-primary);
          font-size: 1.05rem;
        }
        .analysis-card p,
        .timeline-content p {
          margin: 0;
          color: var(--text-secondary);
          line-height: 1.7;
        }
        .entity-badge {
          flex-shrink: 0;
          background: rgba(255, 244, 232, 0.95);
          color: #8c4f2a;
          border: 1px solid rgba(225, 109, 61, 0.18);
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          font-size: 0.72rem;
          text-transform: uppercase;
        }
        .tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-top: 0.85rem;
        }
        .tag-item {
          padding: 0.28rem 0.55rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid var(--border-light);
          color: var(--text-secondary);
          font-size: 0.8rem;
        }
        .timeline-item {
          display: grid;
          grid-template-columns: 52px 1fr;
          align-items: start;
          gap: 1rem;
        }
        .timeline-order {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(217, 102, 52, 0.18), rgba(217, 102, 52, 0.08));
          color: #9b532d;
          font-weight: 700;
          border: 1px solid rgba(217, 102, 52, 0.22);
        }
        .support-text {
          margin-top: 0.75rem;
          color: var(--text-secondary);
          line-height: 1.7;
        }
        .empty-state {
          color: var(--text-muted);
          margin: 0;
        }
        .excerpt-note {
          margin-bottom: 1rem;
        }
        .excerpt-box {
          white-space: pre-wrap;
          line-height: 1.8;
          color: var(--text-secondary);
          max-height: 480px;
          overflow: auto;
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          padding: 1rem;
          background: rgba(255, 252, 247, 0.92);
        }
        @media (max-width: 768px) {
          .summary-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .summary-grid,
          .dual-section {
            grid-template-columns: 1fr;
          }
          .summary-actions {
            width: 100%;
          }
          .summary-actions .btn {
            width: 100%;
            justify-content: center;
          }
          .timeline-item {
            grid-template-columns: 1fr;
          }
          .timeline-order {
            width: 44px;
            height: 44px;
          }
        }
        @media print {
          .summary-header {
            display: none;
          }
          .summary-page {
            max-width: 100%;
            padding: 0;
          }
          .summary-card,
          .analysis-section {
            box-shadow: none;
            border: none;
            background: white;
            padding: 0;
            margin-bottom: 1.5rem;
          }
          .summary-text {
            color: #222;
          }
          .summary-grid,
          .dual-section,
          .analysis-grid {
            display: block;
          }
          .analysis-card,
          .timeline-item,
          .stat-item,
          .excerpt-box {
            border: 1px solid #ddd;
            background: white;
            break-inside: avoid;
            margin-bottom: 0.75rem;
          }
          .excerpt-box {
            max-height: none;
            overflow: visible;
          }
        }
      `}</style>
    </div>
  );
}
