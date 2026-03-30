import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import BookProcessingClient from './BookProcessingClient';

export default async function BookDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch book and related data
  const { data: bookData, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  const book = bookData as any;

  if (error || !book) {
    notFound();
  }

  // If still processing, don't show analysis yet
  if (book.processing_status !== 'ready') {
    return (
      <div className="animate-fade-in">
        <Link href="/books" className="back-link mb-4">← Volver a Biblioteca</Link>
        <BookProcessingClient 
          bookId={book.id} 
          initialStatus={book.processing_status} 
          initialProgress={book.processing_progress} 
        />
        <div className="glass-panel p-8 text-center mt-8">
          <h2 className="text-xl mb-4 text-warning">Libro en procesamiento: {book.processing_status}</h2>
          <p className="text-secondary">Vuelve en unos minutos cuando LecturAI haya terminado de leer la obra completa.</p>
        </div>
        <style>{`.back-link { color: var(--text-muted); } .mb-4 { margin-bottom: 1rem; } .mt-8 { margin-top: 2rem; } .p-8 { padding: 2rem; } .text-center { text-align: center; } .text-xl { font-size: 1.25rem; font-weight: 700; } .text-warning { color: var(--warning); } .text-secondary { color: var(--text-secondary); }`}</style>
      </div>
    );
  }

  // Fetch AI extracted entities (characters, conflicts, spaces)
  const { data: entities } = await supabase
    .from('book_entities')
    .select('*')
    .eq('book_id', book.id)
    .order('importance_score', { ascending: false });

  // Fetch themes
  const { data: themes } = await supabase
    .from('book_themes')
    .select('*')
    .eq('book_id', book.id);

  // Group entities
  const characters = (entities as any[])?.filter(e => e.entity_type === 'character') || [];
  const conflicts = (entities as any[])?.filter(e => e.entity_type === 'conflict') || [];
  const spaces = (entities as any[])?.filter(e => e.entity_type === 'space') || [];

  return (
    <div className="book-detail animate-fade-in">
      <Link href="/books" className="back-link mb-4">← Volver a Biblioteca</Link>
      
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">{book.title}</h1>
          <p className="page-subtitle">{book.author || 'Autor desconocido'} • {book.page_count} páginas leídas por IA</p>
        </div>
        
        <Link href={`/books/${book.id}/test/new`} className="btn btn-primary btn-glow">
          <span className="text-xl mr-2">✨</span> Generar Prueba
        </Link>
      </div>

      <div className="content-grid">
        {/* Left Column - Main Info */}
        <div className="main-col">
          <section className="glass-panel section-card">
            <h2 className="section-title">Resumen de la Obra</h2>
            <p className="summary-text">{book.summary || 'No hay resumen disponible.'}</p>
          </section>

          <section className="glass-panel section-card mt-6">
            <h2 className="section-title">Personajes Principales</h2>
            <div className="cards-list">
              {characters.slice(0, 5).map(char => (
                <div key={char.id} className="entity-card">
                  <div className="entity-header">
                    <h3 className="entity-name">{char.name}</h3>
                    <span className="entity-badge">{(char.metadata as any)?.role || 'personaje'}</span>
                  </div>
                  <p className="entity-desc">{char.description}</p>
                  {(char.metadata as any)?.traits && (
                    <div className="traits-list">
                      {((char.metadata as any).traits as string[]).map((trait, i) => (
                        <span key={i} className="trait-tag">{trait}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="glass-panel section-card mt-6">
            <h2 className="section-title">Conflicto Central</h2>
            <div className="cards-list">
              {conflicts.map((conf: any) => (
                <div key={conf.id} className="entity-card border-accent">
                  <h3 className="entity-name">{conf.name}</h3>
                  <p className="entity-desc">{conf.description}</p>
                  <div className="resolution-box mt-3">
                    <strong>Resolución:</strong> {conf.metadata?.resolution || 'Abierta/Desconocida'}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column - Context Info */}
        <div className="side-col">
          <section className="glass-panel section-card">
            <h2 className="section-title">Temáticas Centrales</h2>
            <ul className="themes-list">
              {(themes as any[])?.map((theme: any) => (
                <li key={theme.id} className="theme-item">
                  <h4 className="theme-name">{theme.theme_name}</h4>
                  <p className="theme-desc">{theme.description}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass-panel section-card mt-6">
            <h2 className="section-title">Espacios Físicos y Psicológicos</h2>
            <ul className="spaces-list">
              {spaces.slice(0, 4).map((space: any) => (
                <li key={space.id} className="space-item">
                  <h4 className="space-name">{space.name} <span className="text-muted text-sm">({space.metadata?.type})</span></h4>
                  <p className="space-desc">{space.description}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <style>{`
        .book-detail { padding-bottom: 4rem; }
        .back-link { color: var(--text-muted); display: inline-block; }
        .back-link:hover { color: white; }
        
        .mb-4 { margin-bottom: 1rem; }
        .mt-3 { margin-top: 0.75rem; }
        .mt-6 { margin-top: 1.5rem; }
        .mt-8 { margin-top: 2rem; }
        .mr-2 { margin-right: 0.5rem; }
        .text-xl { font-size: 1.25rem; }
        .text-sm { font-size: 0.85rem; }
        .text-muted { color: var(--text-muted); }
        
        .btn-glow {
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
          padding: 0.75rem 2rem;
          font-size: 1.1rem;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 1024px) {
          .content-grid { grid-template-columns: 1fr; }
        }

        .section-card {
          padding: 1.5rem;
        }

        .section-title {
          font-size: 1.25rem;
          color: var(--text-primary);
          margin-bottom: 1.25rem;
          border-bottom: 1px solid var(--border-light);
          padding-bottom: 0.5rem;
        }

        .summary-text {
          color: var(--text-secondary);
          line-height: 1.7;
          font-size: 1.05rem;
          white-space: pre-wrap;
        }

        .cards-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .entity-card {
          background: var(--bg-primary);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          padding: 1.25rem;
        }
        
        .border-accent { border-color: rgba(99, 102, 241, 0.3); background: rgba(99, 102, 241, 0.05); }

        .entity-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .entity-name {
          color: var(--text-primary);
          font-size: 1.1rem;
          font-weight: 600;
        }

        .entity-badge {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          text-transform: uppercase;
        }

        .entity-desc {
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .traits-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .trait-tag {
          font-size: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-muted);
          padding: 0.2rem 0.6rem;
          border-radius: 100px;
          border: 1px solid var(--border-light);
        }

        .resolution-box {
          background: var(--bg-secondary);
          padding: 0.75rem;
          border-radius: var(--radius-sm);
          font-size: 0.9rem;
          color: var(--text-secondary);
          border-left: 3px solid var(--accent-primary);
        }

        .themes-list, .spaces-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .theme-name, .space-name {
          color: var(--text-primary);
          font-size: 1rem;
          margin-bottom: 0.25rem;
        }

        .theme-desc, .space-desc {
          color: var(--text-secondary);
          font-size: 0.85rem;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
