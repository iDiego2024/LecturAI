import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function TestsListPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: tests, error } = await supabase
    .from('tests')
    .select(`
      id,
      title,
      target_grade,
      total_score,
      created_at,
      books ( id, title )
    `)
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false });

  return (
    <div className="tests-list animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mis Evaluaciones</h1>
          <p className="page-subtitle">Historial de pruebas generadas por Inteligencia Artificial</p>
        </div>
        <Link href="/books" className="btn btn-primary">
          Ir a Biblioteca (Crear Nueva)
        </Link>
      </div>

      {!tests || tests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon text-center mb-4">📝</div>
          <h3 className="text-xl text-white font-bold mb-2 text-center">No has generado ninguna prueba aún</h3>
          <p className="text-secondary text-center mb-6">Ve a tu biblioteca, selecciona un libro ya procesado y genera tu primera evaluación.</p>
          <div className="text-center">
            <Link href="/books" className="btn btn-primary">
              Ir a la Biblioteca
            </Link>
          </div>
        </div>
      ) : (
        <div className="tests-grid">
          {tests.map((test: any) => (
            <Link href={`/books/${test.books.id}/test/${test.id}`} key={test.id} className="test-card glass-panel">
              <div className="test-icon">📝</div>
              <div className="test-info">
                <h3 className="test-title">{test.title}</h3>
                <p className="test-book">Libro: {test.books.title}</p>
                <div className="test-meta mt-4">
                  <span className="badge">{test.target_grade}</span>
                  <span className="badge">{test.total_score} pts</span>
                  <span className="test-date">{new Date(test.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .empty-state {
          padding: 4rem 2rem;
          background: rgba(28, 28, 31, 0.4);
          border: 1px dashed var(--border-light);
          border-radius: var(--radius-lg);
          max-width: 600px;
          margin: 0 auto;
        }

        .empty-icon { font-size: 3rem; opacity: 0.5; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mt-4 { margin-top: 1rem; }
        .text-center { text-align: center; }
        .text-xl { font-size: 1.25rem; }
        .font-bold { font-weight: 700; }
        .text-white { color: white; }
        .text-secondary { color: var(--text-secondary); }

        .tests-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }

        .test-card {
          display: flex;
          padding: 1.5rem;
          gap: 1.25rem;
          transition: transform 0.2s, border-color 0.2s;
        }

        .test-card:hover {
          transform: translateY(-3px);
          border-color: var(--accent-primary);
        }

        .test-icon {
          width: 48px;
          height: 48px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
          border: 1px solid var(--border-light);
        }

        .test-info {
          flex: 1;
          overflow: hidden;
        }

        .test-title {
          font-size: 1.1rem;
          color: white;
          margin-bottom: 0.25rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .test-book {
          color: var(--text-secondary);
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .test-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .badge {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-light);
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .test-date {
          margin-left: auto;
          color: var(--text-muted);
          font-size: 0.8rem;
        }
      `}</style>
    </div>
  );
}
