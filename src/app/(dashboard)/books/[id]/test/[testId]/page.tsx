import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isDemoEmail } from '@/lib/demo';
import TestEditorPanel from './TestEditorPanel';
import TestActionsMenu from './TestActionsMenu';

export default async function ReviewTestPage({
  params,
  searchParams,
}: {
  params: { id: string, testId: string };
  searchParams?: { mode?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lectur-ai.vercel.app';
  const isDemo = isDemoEmail(user?.email);

  // Fetch test details with all questions
  const { data: test, error } = await supabase
    .from('tests')
    .select(`
      *,
      books (title, author),
      test_items (
        id,
        item_order,
        points,
        question_bank (
          id,
          q_type,
          cognitive_level,
          question_text,
          correct_answer,
          distractors,
          metadata,
          rubric,
          justification
        )
      )
    `)
    .eq('id', params.testId)
    .eq('user_id', user?.id)
    .single();

  if (error || !test) {
    notFound();
  }

  const t = test as any;
  const editModeActive = searchParams?.mode === 'edit';

  // Sort items by order
  const items = t.test_items.sort((a: any, b: any) => a.item_order - b.item_order);

  return (
    <div className="review-test">
      <div className="page-header pb-4 border-b border-light">
        <div className="page-heading">
          <Link href={`/books/${params.id}`} className="back-link mb-2">← Volver al Libro</Link>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">
            {t.books.title} • {t.target_grade} • {t.total_score} puntos
          </p>
        </div>
        <TestActionsMenu
          testId={t.id}
          bookId={params.id}
          testTitle={t.title}
          bookTitle={t.books.title}
          appUrl={appUrl}
          isDemo={isDemo}
          editModeActive={editModeActive}
        />
      </div>

      {isDemo && (
        <div className="demo-note mb-8">
          Modo demo: puedes revisar la evaluacion, pero las descargas estan deshabilitadas.
        </div>
      )}

      <TestEditorPanel
        testId={t.id}
        initialTitle={t.title}
        initialInstructions={t.instructions || 'Lee atentamente cada pregunta y responde según lo solicitado.'}
        initialTargetGrade={t.target_grade || ''}
        initialQuestions={items.map((item: any) => ({
          id: item.id,
          itemOrder: item.item_order,
          points: item.points,
          question: item.question_bank,
        }))}
        initialEditMode={editModeActive}
      />

      <div className="test-content mt-8">
        <div className="instructions-box p-6 mb-8">
          <h3 className="section-title text-sm uppercase tracking-wide text-secondary mb-2">Instrucciones Generales</h3>
          <p className="text-primary">{t.instructions || 'Lee atentamente cada pregunta y responde según lo solicitado.'}</p>
        </div>

        <div className="questions-list">
          {items.map((item: any, i: number) => {
            const q = item.question_bank;
            return (
              <div key={item.id} className="question-card glass-panel" id={`q-${i+1}`}>
                <div className="q-header">
                  <div className="q-number">{i + 1}</div>
                  <div className="q-meta">
                    <span className={`badge-level level-${q.cognitive_level}`}>
                      {translateLevel(q.cognitive_level)}
                    </span>
                    <span className="badge-type">
                      {translateType(q.q_type)}
                    </span>
                    <span className="badge-points">{item.points} pt{item.points > 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="q-body">
                  <h3 className="q-text">{q.question_text}</h3>
                  {q.metadata?.topic_label && (
                    <p className="q-topic">Tema: {q.metadata.topic_label}</p>
                  )}
                  
                  {/* Options for Multiple Choice */}
                  {q.q_type === 'multiple_choice' && (
                    <div className="q-options">
                      {/* En una app de producción, aquí mezclaríamos las alternativas visualmente, 
                          pero marcando la correcta para el profesor */ }
                      <div className="option correct-option">
                        <span className="opt-letter">a)</span> {q.correct_answer} <span className="correct-check">✓</span>
                      </div>
                      {q.distractors?.map((d: string, index: number) => (
                        <div key={index} className="option">
                          <span className="opt-letter">{['b', 'c', 'd'][index]})</span> {d}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* True/False */}
                  {q.q_type === 'true_false' && (
                    <div className="q-tf">
                      <div className="tf-choice">Verdadero / Falso</div>
                      <div className="tf-answer">Respuesta esperada: <strong>{q.correct_answer}</strong></div>
                    </div>
                  )}

                  {/* Development */}
                  {q.q_type === 'development' && (
                    <div className="q-dev">
                      <div className="dev-lines">
                        <div className="line"></div>
                        <div className="line"></div>
                        <div className="line"></div>
                        <div className="line"></div>
                      </div>
                      <div className="dev-rubric mt-4">
                        <div className="rubric-title">Pauta de Corrección (Docente):</div>
                        <p>{q.rubric || q.correct_answer}</p>
                      </div>
                    </div>
                  )}

                  {q.q_type === 'matching' && (
                    <div className="q-options">
                      {(q.metadata?.matching_pairs || []).map((pair: any, index: number) => (
                        <div key={index} className="option">
                          <span className="opt-letter">{index + 1}.</span>
                          <span>
                            <strong>{pair.left}</strong> → {pair.right}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.q_type === 'creative_writing' && (
                    <div className="q-dev">
                      {Array.isArray(q.metadata?.writing_focus) && q.metadata.writing_focus.length > 0 && (
                        <div className="creative-focus">
                          {q.metadata.writing_focus.map((focus: string, index: number) => (
                            <span key={index} className="focus-chip">{focus}</span>
                          ))}
                        </div>
                      )}
                      <div className="dev-lines">
                        <div className="line"></div>
                        <div className="line"></div>
                        <div className="line"></div>
                        <div className="line"></div>
                        <div className="line"></div>
                      </div>
                      <div className="dev-rubric mt-4">
                        <div className="rubric-title">Pauta de Corrección (Docente):</div>
                        <p>{q.rubric || q.correct_answer}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Justification from AI */}
                {q.justification && (
                  <div className="q-footer">
                    <div className="q-justification">
                      <span className="ai-icon">📘</span> <strong>Por qué es correcta:</strong> {q.justification}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .review-test {
          padding-bottom: 4rem;
          max-width: 900px;
          margin: 0 auto;
        }
        
        .back-link { color: var(--text-muted); display: inline-block; }
        .back-link:hover { color: var(--text-primary); }
        
        .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
        .border-light { border-color: var(--border-light); }
        .pb-4 { padding-bottom: 1rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-8 { margin-bottom: 2rem; }
        .mt-4 { margin-top: 1rem; }
        .mt-8 { margin-top: 2rem; }
        .mr-2 { margin-right: 0.5rem; }
        .p-6 { padding: 1.5rem; }
        .text-sm { font-size: 0.85rem; }
        .text-primary { color: var(--text-primary); font-size: 1.05rem; line-height: 1.6; }
        .uppercase { text-transform: uppercase; }
        .tracking-wide { letter-spacing: 0.05em; }
        .text-secondary { color: var(--text-secondary); }
        
        .instructions-box {
          background: linear-gradient(180deg, rgba(255, 253, 248, 0.94) 0%, rgba(255, 244, 230, 0.94) 100%);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          border-left: 4px solid var(--accent-primary);
        }

        .demo-note {
          padding: 0.95rem 1rem;
          background: var(--warning-bg);
          color: var(--warning);
          border-radius: var(--radius-md);
          font-weight: 700;
        }
        
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1.25rem;
          margin-bottom: 0.75rem;
        }

        .page-heading {
          flex: 1 1 auto;
          min-width: 0;
          max-width: 100%;
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
          }
        }

        .questions-list {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .question-card {
          border-radius: var(--radius-lg);
          background: var(--bg-secondary);
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }

        .q-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          gap: 1.25rem;
          background: linear-gradient(180deg, rgba(255, 249, 239, 0.9) 0%, rgba(255, 238, 220, 0.9) 100%);
        }

        .q-number {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--accent-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: var(--text-inverse);
          flex-shrink: 0;
          box-shadow: var(--shadow-sm);
        }

        .q-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: center;
        }

        .badge-level, .badge-type, .badge-points {
          font-size: 0.75rem;
          padding: 0.2rem 0.6rem;
          border-radius: 999px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .badge-points { background: rgba(255, 250, 242, 0.95); border: 1px solid var(--border-light); color: var(--text-secondary); }
        .badge-type { background: rgba(255, 250, 242, 0.95); border: 1px solid var(--border-light); color: var(--text-primary); }
        
        .level-locate { background: rgba(47, 153, 103, 0.16); color: #2f9967; }
        .level-interpret { background: rgba(242, 165, 69, 0.18); color: #b77300; }
        .level-reflect { background: rgba(217, 102, 52, 0.18); color: #d96634; }

        .q-body {
          padding: 1.5rem;
        }

        .q-text {
          font-size: 1.08rem;
          color: var(--text-primary);
          margin-bottom: 1.2rem;
          line-height: 1.6;
          font-weight: 600;
          font-family: var(--font-serif);
        }

        .q-topic {
          margin-bottom: 1rem;
          color: var(--accent-primary);
          font-size: 0.9rem;
          font-weight: 700;
        }

        .q-options {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .option {
          padding: 1rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-light);
          background: rgba(255, 250, 242, 0.85);
          color: var(--text-secondary);
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          font-family: var(--font-serif);
        }

        .correct-option {
          border-color: rgba(16, 185, 129, 0.4);
          background: rgba(16, 185, 129, 0.1);
          color: var(--text-primary);
          font-weight: 500;
        }

        .opt-letter {
          font-weight: 600;
          min-width: 20px;
        }

        .correct-check {
          color: var(--success);
          margin-left: auto;
          font-weight: bold;
        }

        .q-tf {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .tf-choice {
          padding: 1rem;
          background: rgba(255, 250, 242, 0.85);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-sm);
          text-align: center;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: var(--text-secondary);
        }

        .tf-answer {
          color: var(--success);
          font-size: 0.95rem;
        }

        .dev-lines {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .line {
          width: 100%;
          height: 1px;
          background: var(--border-light);
        }

        .dev-rubric {
          padding: 1.25rem;
          background: rgba(47, 153, 103, 0.08);
          border-left: 3px solid var(--success);
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        }

        .rubric-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--success);
          margin-bottom: 0.5rem;
          text-transform: uppercase;
        }

        .dev-rubric p {
          color: var(--text-primary);
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .creative-focus {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .focus-chip {
          background: rgba(217, 102, 52, 0.12);
          border: 1px solid rgba(217, 102, 52, 0.18);
          color: #9b532d;
          padding: 0.3rem 0.65rem;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 700;
        }

        .q-footer {
          padding: 1rem 1.5rem;
          border-top: 1px dashed var(--border-light);
          background: rgba(255, 250, 242, 0.75);
        }

        .q-justification {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .ai-icon {
          color: var(--accent-primary);
          margin-right: 0.25rem;
        }
      `}</style>
    </div>
  );
}

// Helpers for translations
function translateLevel(level: string) {
  switch(level) {
    case 'locate': return 'Localizar';
    case 'interpret': return 'Interpretar';
    case 'reflect': return 'Reflexionar';
    default: return level;
  }
}

function translateType(type: string) {
  switch(type) {
    case 'multiple_choice': return 'Sel. Múltiple';
    case 'true_false': return 'Verd. o Falso';
    case 'development': return 'Desarrollo';
    case 'matching': return 'Pareados';
    case 'creative_writing': return 'Escritura creativa';
    default: return type;
  }
}
