import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import DeleteBookButton from './DeleteBookButton';
import { DEMO_BOOK_TITLE, isDemoEmail } from '@/lib/demo';

export default async function BooksPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isDemo = isDemoEmail(user?.email);

  const { data: books, error } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tu Biblioteca</h1>
          <p className="page-subtitle">Tu rincón lector: sube libros y crea evaluaciones con apoyo IA.</p>
        </div>
        <Link href="/books/upload" className="btn btn-primary">
          <span style={{ fontSize: '1.2rem' }}>📘</span> {isDemo ? 'Usar libro demo' : 'Subir libro'}
        </Link>
      </div>

      {isDemo && (
        <div className="demo-banner">
          Modo demo: usaras solo &quot;{DEMO_BOOK_TITLE}&quot;, podras generar 1 evaluacion y las descargas estan deshabilitadas.
        </div>
      )}

      {!books || books.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h3>Tu biblioteca está vacía</h3>
          <p>{isDemo ? `Activa ${DEMO_BOOK_TITLE} para explorar el analisis y crear una evaluacion.` : 'Sube tu primer PDF o EPUB y en minutos tendrás material listo para evaluar.'}</p>
          <Link href="/books/upload" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
            {isDemo ? 'Usar libro demo' : 'Empezar con mi primer libro'}
          </Link>
        </div>
      ) : (
        <div className="books-grid">
          {(books as any[])?.map((book: any) => (
            <div key={book.id} className="book-card glass-panel">
              <Link href={`/books/${book.id}`} className="book-card-link">
                <div className="book-cover">
                  {book.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.cover_url} alt={`Caratula de ${book.title}`} />
                  ) : (
                    <div
                      className="cover-fallback"
                      style={{ background: getCoverGradient(book.title, book.author) }}
                    >
                      <div className="cover-title">{book.title}</div>
                      <div className="cover-author">{book.author || 'Autor desconocido'}</div>
                    </div>
                  )}
                </div>
                <div className="book-info">
                  <h3 className="book-title" title={book.title}>{book.title}</h3>
                  <p className="book-author">{book.author || 'Autor desconocido'}</p>
                  
                  <div className="book-meta">
                    <span className={`status-badge status-${book.processing_status}`}>
                      {getStatusLabel(book.processing_status)}
                    </span>
                    <span className="book-date">
                      {new Date(book.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
              <div className="book-actions">
                <DeleteBookButton bookId={book.id} bookTitle={book.title} />
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 6rem 2rem;
          background: var(--bg-secondary);
          border: 1px dashed var(--border-light);
          border-radius: var(--radius-lg);
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .empty-state h3 {
          font-size: 1.25rem;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }

        .empty-state p {
          color: var(--text-secondary);
          max-width: 400px;
        }

        .books-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .demo-banner {
          margin-bottom: 1.25rem;
          padding: 0.95rem 1rem;
          border-radius: var(--radius-md);
          background: var(--warning-bg);
          color: var(--warning);
          font-weight: 700;
        }

        .book-card {
          position: relative;
          display: flex;
          overflow: hidden;
          transition: all 0.2s;
        }

        .book-card:hover {
          transform: translateY(-3px);
          border-color: var(--border-focus);
          background: rgba(255, 251, 245, 0.92);
        }

        .book-card-link {
          display: flex;
          flex: 1;
          padding: 1rem;
          padding-right: 3.2rem;
          gap: 1rem;
          text-decoration: none;
          color: inherit;
          min-width: 0;
          align-items: flex-start;
        }

        .book-actions {
          position: absolute;
          top: 0.7rem;
          right: 0.7rem;
          opacity: 0;
          transform: translateY(-4px) scale(0.96);
          transition: opacity 0.2s, transform 0.2s;
          z-index: 2;
        }

        .book-card:hover .book-actions {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .delete-btn {
          background: rgba(239, 68, 68, 0.1);
          color: var(--danger);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 6px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .delete-btn:hover {
          background: var(--danger);
          color: var(--text-primary);
        }

        .delete-btn.deleting {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .book-cover {
          width: 80px;
          height: 110px;
          border-radius: var(--radius-sm);
          box-shadow: var(--shadow-sm);
          flex-shrink: 0;
          overflow: hidden;
        }

        .book-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .cover-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          flex-direction: column;
          padding: 0.6rem;
          font-family: var(--font-serif);
          font-size: 0.6rem;
          font-weight: 700;
          color: #fff9f2;
          gap: 0.25rem;
        }

        .cover-title {
          font-size: 0.65rem;
          line-height: 1.1;
          max-height: 2.6em;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .cover-author {
          font-size: 0.55rem;
          opacity: 0.85;
          line-height: 1.1;
          max-height: 2.2em;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .book-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex: 1;
          min-width: 0;
        }

        .book-title {
          font-size: 1.03rem;
          color: var(--text-primary);
          margin-bottom: 0.35rem;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
        }

        .book-author {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: auto;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          max-width: 100%;
        }

        .book-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        .book-date {
          font-size: 0.75rem;
          color: var(--text-muted);
          white-space: nowrap;
        }

        .status-badge {
          font-size: 0.72rem;
          padding: 0.28rem 0.6rem;
          border-radius: 100px;
          font-weight: 700;
          max-width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .status-ready { background: var(--success-bg); color: var(--success); }
        .status-failed { background: var(--danger-bg); color: var(--danger); }
        .status-pending, .status-extracting, .status-chunking, .status-embedding, .status-analyzing {
          background: var(--warning-bg); color: var(--warning);
        }

        @media (max-width: 640px) {
          .books-grid {
            grid-template-columns: 1fr;
          }

          .book-card-link {
            padding-right: 1rem;
          }

          .book-actions {
            opacity: 1;
            transform: none;
            position: static;
            align-self: flex-start;
            margin: 0.8rem 0.8rem 0 0;
          }

          .book-card {
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
}

function getStatusLabel(status: string) {
  switch(status) {
    case 'ready': return 'Listo';
    case 'failed': return 'Error';
    case 'pending': return 'En cola...';
    case 'extracting': return 'Leyendo PDF...';
    case 'chunking': return 'Procesando...';
    case 'embedding': return 'Vectorizando...';
    case 'analyzing': return 'I.A. Analizando...';
    default: return status;
  }
}

function getCoverGradient(title: string, author?: string | null) {
  const seed = `${title || ''}-${author || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  const hue = hash;
  const hue2 = (hash + 35) % 360;
  return `linear-gradient(160deg, hsl(${hue} 65% 45%) 0%, hsl(${hue2} 70% 38%) 100%)`;
}
