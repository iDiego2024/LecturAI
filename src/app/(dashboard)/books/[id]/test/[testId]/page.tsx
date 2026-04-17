import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isDemoEmail } from '@/lib/demo';
import TestEditorPanel from './TestEditorPanel';
import TestActionsMenu from './TestActionsMenu';
import QuestionComposerPanel from './QuestionComposerPanel';

export default async function ReviewTestPage({
  params,
  searchParams,
}: {
  params: { id: string; testId: string };
  searchParams?: { mode?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lectur-ai.vercel.app';
  const isDemo = isDemoEmail(user?.email);

  const { data: test, error } = await supabase
    .from('tests')
    .select(
      `
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
    `
    )
    .eq('id', params.testId)
    .eq('user_id', user?.id)
    .single();

  if (error || !test) {
    notFound();
  }

  const t = test as any;
  const currentMode =
    searchParams?.mode === 'edit' || searchParams?.mode === 'add-question'
      ? searchParams.mode
      : null;
  const teacherRequest =
    typeof t.generation_config?.teacherRequest === 'string'
      ? t.generation_config.teacherRequest.trim()
      : '';
  const currentVersionLabel = t.variant_label ? `Variante ${t.variant_label}` : 'Version base';
  const familyId = t.variant_family_id || t.id;
  const items = t.test_items.sort((a: any, b: any) => a.item_order - b.item_order);

  const { data: siblingTests } = await supabase
    .from('tests')
    .select('id, title, variant_label, created_at')
    .eq('variant_family_id', familyId)
    .order('created_at', { ascending: true });

  const versions = [...(siblingTests || [])].sort((a: any, b: any) => {
    const rankA = a.variant_label ? 1 : 0;
    const rankB = b.variant_label ? 1 : 0;
    if (rankA !== rankB) return rankA - rankB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return (
    <div className="review-test">
      <div className="page-header pb-4 border-b border-light">
        <div className="page-heading">
          <Link href={`/books/${params.id}`} className="back-link mb-2">
            ← Volver al Libro
          </Link>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">
            {t.books.title} • {t.target_grade} • {t.total_score} puntos
          </p>
          <div className="header-badges">
            <span className="header-badge">{items.length} preguntas activas</span>
            <span className="header-badge">{currentVersionLabel}</span>
          </div>
        </div>
        <TestActionsMenu
          testId={t.id}
          bookId={params.id}
          testTitle={t.title}
          bookTitle={t.books.title}
          appUrl={appUrl}
          isDemo={isDemo}
          activeMode={currentMode}
          versionLabel={currentVersionLabel}
        />
      </div>

      {isDemo && (
        <div className="demo-note mb-8">
          Modo demo: puedes revisar la evaluacion, pero las descargas estan deshabilitadas.
        </div>
      )}

      <div className="overview-grid">
        <section className="scope-card">
          <p className="overview-kicker">Alcance de cambios</p>
          <h2 className="overview-title">Estas trabajando sobre {currentVersionLabel}</h2>
          <p className="scope-copy">
            Si agregas, editas o eliminas preguntas ahora, el cambio queda guardado solo en <strong>{currentVersionLabel}</strong>.
            Las otras variantes ya creadas permanecen como estan.
          </p>
          <p className="scope-copy">
            Si quieres que otra version herede estos cambios, crea una nueva variante desde esta vista.
          </p>
        </section>

        {teacherRequest && (
          <section className="teacher-brief-card">
            <p className="overview-kicker">Encargo docente para la IA</p>
            <h2 className="overview-title">Criterio pedagogico que orienta esta evaluacion</h2>
            <p className="teacher-brief-copy">{teacherRequest}</p>
          </section>
        )}

        <section className="variant-card">
          <p className="overview-kicker">Variantes</p>
          <h2 className="overview-title">Versiones A / B mas claras para el docente</h2>
          <p className="variant-copy">
            Las variantes son versiones independientes. Cuando creas una nueva, nace desde la evaluacion actual que ves aqui y respeta la cantidad de preguntas, sus tipos, el nivel cognitivo y tambien las preguntas agregadas manualmente o con IA.
          </p>
          <div className="variant-list">
            {versions.map((version: any) => (
              <Link
                key={version.id}
                href={`/books/${params.id}/test/${version.id}`}
                className={`variant-link ${version.id === t.id ? 'is-current' : ''}`}
              >
                <strong>{version.variant_label ? `Variante ${version.variant_label}` : 'Version base'}</strong>
                <span>{version.id === t.id ? 'Vista actual' : 'Abrir version'}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <QuestionComposerPanel
        testId={t.id}
        initialTargetGrade={t.target_grade || ''}
        initialTeacherRequest={teacherRequest}
        initialQuestions={items.map((item: any) => ({
          id: item.id,
          itemOrder: item.item_order,
          question: item.question_bank,
        }))}
        initialOpen={currentMode === 'add-question'}
        versionLabel={currentVersionLabel}
      />

      <TestEditorPanel
        testId={t.id}
        initialTitle={t.title}
        initialInstructions={
          t.instructions || 'Lee atentamente cada pregunta y responde según lo solicitado.'
        }
        initialTargetGrade={t.target_grade || ''}
        initialTeacherRequest={teacherRequest}
        initialQuestions={items.map((item: any) => ({
          id: item.id,
          itemOrder: item.item_order,
          points: item.points,
          question: item.question_bank,
        }))}
        initialEditMode={currentMode === 'edit'}
        versionLabel={currentVersionLabel}
      />

      <div className="test-content mt-8">
        <div className="instructions-box p-6 mb-8">
          <h3 className="section-title text-sm uppercase tracking-wide text-secondary mb-2">
            Instrucciones Generales
          </h3>
          <p className="text-primary">
            {t.instructions || 'Lee atentamente cada pregunta y responde según lo solicitado.'}
          </p>
        </div>

        <div className="questions-list">
          {items.map((item: any, i: number) => {
            const q = item.question_bank;
            return (
              <div key={item.id} className="question-card glass-panel" id={`q-${i + 1}`}>
                <div className="q-header">
                  <div className="q-number">{i + 1}</div>
                  <div className="q-meta">
                    <span className={`badge-level level-${q.cognitive_level}`}>
                      {translateLevel(q.cognitive_level)}
                    </span>
                    <span className="badge-type">{translateType(q.q_type)}</span>
                    <span className="badge-points">
                      {item.points} pt{item.points > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="q-body">
                  <h3 className="q-text">{q.question_text}</h3>
                  {q.metadata?.topic_label && <p className="q-topic">Tema: {q.metadata.topic_label}</p>}

                  {q.q_type === 'multiple_choice' && (
                    <div className="q-options">
                      <div className="option correct-option">
                        <span className="opt-letter">a)</span> {q.correct_answer}{' '}
                        <span className="correct-check">✓</span>
                      </div>
                      {q.distractors?.map((d: string, index: number) => (
                        <div key={index} className="option">
                          <span className="opt-letter">{['b', 'c', 'd'][index]})</span> {d}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.q_type === 'true_false' && (
                    <div className="q-tf">
                      <div className="tf-choice">Verdadero / Falso</div>
                      <div className="tf-answer">
                        Respuesta esperada: <strong>{q.correct_answer}</strong>
                      </div>
                    </div>
                  )}

                  {q.q_type === 'development' && (
                    <div className="q-dev">
                      <div className="dev-lines">
                        <div className="line"></div>
                        <div className="line"></div>
                        <div className="line"></div>
                        <div className="line"></div>
                      </div>
                      <div className="dev-rubric mt-4">
                        <div className="rubric-title">Pauta de Correccion (Docente)</div>
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
                      {q.metadata?.creative_task && (
                        <div className="creative-task">{q.metadata.creative_task}</div>
                      )}
                      {Array.isArray(q.metadata?.writing_focus) &&
                        q.metadata.writing_focus.length > 0 && (
                          <div className="creative-focus">
                            {q.metadata.writing_focus.map((focus: string, index: number) => (
                              <span key={index} className="focus-chip">
                                {focus}
                              </span>
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
                        <div className="rubric-title">Pauta de Correccion (Docente)</div>
                        <p>{q.rubric || q.correct_answer}</p>
                      </div>
                    </div>
                  )}
                </div>

                {q.justification && (
                  <div className="q-footer">
                    <div className="q-justification">
                      <span className="ai-icon">IA</span> <strong>Fundamento de la pregunta:</strong>{' '}
                      {q.justification}
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
          max-width: 960px;
          margin: 0 auto;
        }

        .back-link {
          color: var(--text-muted);
          display: inline-block;
        }
        .back-link:hover {
          color: var(--text-primary);
        }

        .border-b {
          border-bottom-width: 1px;
          border-bottom-style: solid;
        }
        .border-light {
          border-color: var(--border-light);
        }
        .pb-4 {
          padding-bottom: 1rem;
        }
        .mb-2 {
          margin-bottom: 0.5rem;
        }
        .mb-8 {
          margin-bottom: 2rem;
        }
        .mt-4 {
          margin-top: 1rem;
        }
        .mt-8 {
          margin-top: 2rem;
        }
        .p-6 {
          padding: 1.5rem;
        }
        .text-sm {
          font-size: 0.85rem;
        }
        .text-primary {
          color: var(--text-primary);
          font-size: 1.05rem;
          line-height: 1.6;
        }
        .uppercase {
          text-transform: uppercase;
        }
        .tracking-wide {
          letter-spacing: 0.05em;
        }
        .text-secondary {
          color: var(--text-secondary);
        }

        .instructions-box {
          background: linear-gradient(
            180deg,
            rgba(255, 253, 248, 0.94) 0%,
            rgba(255, 244, 230, 0.94) 100%
          );
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

        .header-badges {
          margin-top: 0.9rem;
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
        }

        .header-badge {
          padding: 0.35rem 0.7rem;
          border-radius: 999px;
          background: rgba(255, 247, 238, 0.92);
          border: 1px solid rgba(82, 52, 26, 0.1);
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 700;
        }

        .overview-grid {
          display: grid;
          gap: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          margin-top: 1.5rem;
        }

        .scope-card,
        .teacher-brief-card,
        .variant-card {
          padding: 1.3rem;
          border-radius: 1.1rem;
          border: 1px solid rgba(82, 52, 26, 0.1);
          background: rgba(255, 251, 246, 0.94);
        }

        .scope-card {
          background: linear-gradient(
            135deg,
            rgba(255, 248, 238, 0.98) 0%,
            rgba(255, 252, 248, 0.96) 100%
          );
        }
        .teacher-brief-card {
          background: linear-gradient(
            135deg,
            rgba(255, 239, 220, 0.98) 0%,
            rgba(255, 248, 240, 0.95) 100%
          );
          border-color: rgba(217, 102, 52, 0.22);
          box-shadow: 0 16px 40px rgba(217, 102, 52, 0.1);
        }

        .overview-kicker {
          margin: 0 0 0.25rem;
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .overview-title {
          margin: 0 0 0.8rem;
          color: var(--text-primary);
          font-size: 1.08rem;
        }

        .teacher-brief-copy,
        .variant-copy,
        .scope-copy {
          margin: 0;
          color: var(--text-secondary);
          line-height: 1.65;
        }
        .scope-copy + .scope-copy {
          margin-top: 0.65rem;
        }

        .variant-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          margin-top: 1rem;
        }

        .variant-link {
          min-width: 10rem;
          display: grid;
          gap: 0.2rem;
          padding: 0.9rem 1rem;
          border-radius: 0.95rem;
          border: 1px solid rgba(82, 52, 26, 0.08);
          background: rgba(255, 255, 255, 0.82);
          color: var(--text-primary);
          text-decoration: none;
        }

        .variant-link span {
          color: var(--text-secondary);
          font-size: 0.88rem;
        }

        .variant-link.is-current {
          border-color: rgba(217, 102, 52, 0.22);
          background: rgba(255, 242, 230, 0.96);
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
          background: linear-gradient(
            180deg,
            rgba(255, 249, 239, 0.9) 0%,
            rgba(255, 238, 220, 0.9) 100%
          );
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

        .badge-level,
        .badge-type,
        .badge-points {
          font-size: 0.75rem;
          padding: 0.2rem 0.6rem;
          border-radius: 999px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .badge-points {
          background: rgba(255, 250, 242, 0.95);
          border: 1px solid var(--border-light);
          color: var(--text-secondary);
        }
        .badge-type {
          background: rgba(255, 250, 242, 0.95);
          border: 1px solid var(--border-light);
          color: var(--text-primary);
        }

        .level-locate {
          background: rgba(47, 153, 103, 0.16);
          color: #2f9967;
        }
        .level-interpret {
          background: rgba(242, 165, 69, 0.18);
          color: #b77300;
        }
        .level-reflect {
          background: rgba(217, 102, 52, 0.18);
          color: #d96634;
        }

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

        .creative-task {
          margin-bottom: 1rem;
          padding: 0.95rem 1rem;
          border-radius: 0.9rem;
          background: rgba(255, 250, 242, 0.92);
          border: 1px solid rgba(82, 52, 26, 0.08);
          color: var(--text-primary);
          font-weight: 600;
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
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2rem;
          height: 2rem;
          margin-right: 0.35rem;
          border-radius: 999px;
          background: rgba(217, 102, 52, 0.12);
          color: #9d4d26;
          font-size: 0.8rem;
          font-weight: 800;
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

function translateLevel(level: string) {
  switch (level) {
    case 'locate':
      return 'Localizar';
    case 'interpret':
      return 'Interpretar';
    case 'reflect':
      return 'Reflexionar';
    default:
      return level;
  }
}

function translateType(type: string) {
  switch (type) {
    case 'multiple_choice':
      return 'Sel. Multiple';
    case 'true_false':
      return 'Verd. o Falso';
    case 'development':
      return 'Desarrollo';
    case 'matching':
      return 'Pareados';
    case 'creative_writing':
      return 'Escritura creativa';
    default:
      return type;
  }
}
