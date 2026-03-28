import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import DeleteBookButton from './DeleteBookButton';

export default async function BooksPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
          <p className="page-subtitle">Sube libros para analizarlos y generar pruebas</p>
        </div>
        <Link href="/books/upload" className="btn btn-primary">
          <span style={{ fontSize: '1.2rem' }}>+</span> Subir Libro
        </Link>
      </div>

      {!books || books.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h3>Tu biblioteca está vacía</h3>
          <p>Sube tu primer libro en formato PDF para comenzar a generar evaluaciones con Inteligencia Artificial.</p>
          <Link href="/books/upload" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
            Subir mi primer libro
          </Link>
        </div>
      ) : (
        <div className="books-grid">
          {(books as any[])?.map((book: any) => (
            <div key={book.id} className="book-card glass-panel">
              <Link href={`/books/${book.id}`} className="book-card-link">
                <div className="book-cover">
                  {book.title.charAt(0)}
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

        .book-card {
          position: relative;
          display: flex;
          transition: all 0.2s;
        }

        .book-card:hover {
          transform: translateY(-3px);
          border-color: var(--border-focus);
          background: rgba(39, 39, 42, 0.8);
        }

        .book-card-link {
          display: flex;
          flex: 1;
          padding: 1rem;
          gap: 1rem;
          text-decoration: none;
          color: inherit;
        }

        .book-actions {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .book-card:hover .book-actions {
          opacity: 1;
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
          background: var(--accent-gradient);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-serif);
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
          flex-shrink: 0;
        }

        .book-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex: 1;
        }

        .book-title {
          font-size: 1.1rem;
          color: var(--text-primary);
          margin-bottom: 0.25rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .book-author {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: auto;
        }

        .book-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 1rem;
        }

        .book-date {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .status-badge {
          font-size: 0.7rem;
          padding: 0.25rem 0.5rem;
          border-radius: 100px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-ready { background: var(--success-bg); color: var(--success); }
        .status-failed { background: var(--danger-bg); color: var(--danger); }
        .status-pending, .status-extracting, .status-chunking, .status-embedding, .status-analyzing {
          background: var(--warning-bg); color: var(--warning);
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
