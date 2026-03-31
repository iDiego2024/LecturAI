import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PrintPdfButton from '@/components/PrintPdfButton';
import ShareByEmailButton from '@/components/ShareByEmailButton';

export default async function BookSummaryPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lectur-ai.vercel.app';

  if (!user) {
    redirect('/login');
  }

  const { data: book, error } = await supabase
    .from('books')
    .select('id, title, author, summary, user_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !book) {
    notFound();
  }

  const summaryText = book.summary || 'Todavia no hay un resumen disponible para este libro.';

  return (
    <div className="summary-page animate-fade-in">
      <div className="summary-header">
        <div>
          <Link href={`/books/${params.id}`} className="back-link">← Volver al libro</Link>
          <h1 className="page-title">Resumen completo</h1>
          <p className="page-subtitle">{book.title}{book.author ? ` • ${book.author}` : ''}</p>
        </div>
        <div className="summary-actions">
          <PrintPdfButton label="Guardar resumen como PDF" />
          <ShareByEmailButton
            subject={`Resumen del libro: ${book.title}`}
            body={`Te comparto el resumen del libro "${book.title}".`}
            shareUrl={`${appUrl}/books/${params.id}/summary`}
          />
        </div>
      </div>

      <article className="summary-card glass-panel">
        <p className="summary-text">{summaryText}</p>
      </article>

      <style>{`
        .summary-page {
          max-width: 960px;
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
        .summary-card {
          padding: 2rem;
          background: linear-gradient(180deg, rgba(255, 253, 248, 0.96) 0%, rgba(255, 244, 230, 0.94) 100%);
        }
        .summary-text {
          white-space: pre-wrap;
          color: var(--text-secondary);
          line-height: 1.9;
          font-size: 1.05rem;
        }
        @media (max-width: 768px) {
          .summary-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .summary-actions {
            width: 100%;
          }
          .summary-actions .btn {
            width: 100%;
            justify-content: center;
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
          .summary-card {
            box-shadow: none;
            border: none;
            background: white;
          }
          .summary-text {
            color: #222;
          }
        }
      `}</style>
    </div>
  );
}
