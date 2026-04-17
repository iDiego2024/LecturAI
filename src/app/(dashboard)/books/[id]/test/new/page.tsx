'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type CognitiveKey = 'locate' | 'interpret' | 'reflect';
type QuestionTypeKey =
  | 'multiple_choice'
  | 'true_false'
  | 'development'
  | 'matching'
  | 'creative_writing';

const cognitiveLabels: Record<CognitiveKey, string> = {
  locate: 'Localizar',
  interpret: 'Interpretar',
  reflect: 'Reflexionar',
};

const typeLabels: Record<QuestionTypeKey, string> = {
  multiple_choice: 'Seleccion multiple',
  true_false: 'Verdadero o falso',
  development: 'Desarrollo',
  matching: 'Terminos pareados',
  creative_writing: 'Escritura creativa',
};

const defaultCognitiveCounts: Record<CognitiveKey, number> = {
  locate: 3,
  interpret: 4,
  reflect: 3,
};

const defaultTypeCounts: Record<QuestionTypeKey, number> = {
  multiple_choice: 4,
  true_false: 2,
  development: 2,
  matching: 1,
  creative_writing: 1,
};

const cognitiveDescriptions: Record<CognitiveKey, string> = {
  locate: 'Identifica información explícita del texto: hechos, personajes y datos directos.',
  interpret: 'Relaciona ideas e infiere motivaciones, causas y consecuencias.',
  reflect: 'Evalúa críticamente, argumenta y conecta la lectura con contexto personal o social.',
};

function buildDistributionArray<T extends string>(counts: Record<T, number>) {
  return (Object.keys(counts) as T[]).flatMap((key) =>
    Array.from({ length: counts[key] }, () => key)
  );
}

function interleavePlan(cognitiveCounts: Record<CognitiveKey, number>, typeCounts: Record<QuestionTypeKey, number>) {
  const cognitiveQueue = buildDistributionArray(cognitiveCounts);
  const typeQueue = buildDistributionArray(typeCounts);
  const size = Math.min(cognitiveQueue.length, typeQueue.length);

  return Array.from({ length: size }, (_, index) => ({
    cognitiveLevel: cognitiveQueue[index],
    questionType: typeQueue[index],
  }));
}

function totalCount<T extends string>(counts: Record<T, number>) {
  return (Object.keys(counts) as T[]).reduce((sum, key) => sum + counts[key], 0);
}

function updateCountsWithLimit<T extends string>(
  previous: Record<T, number>,
  key: T,
  value: number,
  maxTotal: number
) {
  const next: Record<T, number> = { ...previous, [key]: Math.max(0, Math.min(45, value)) };
  let overflow = totalCount(next) - maxTotal;

  if (overflow <= 0) return next;

  const orderedKeys = (Object.keys(next) as T[]).filter((currentKey) => currentKey !== key);
  for (const currentKey of orderedKeys) {
    if (overflow <= 0) break;
    const reducible = Math.min(next[currentKey], overflow);
    next[currentKey] -= reducible;
    overflow -= reducible;
  }

  if (overflow > 0) {
    next[key] = Math.max(0, next[key] - overflow);
  }

  return next;
}

function clampCountsToTotal<T extends string>(counts: Record<T, number>, maxTotal: number) {
  const normalized: Record<T, number> = { ...counts };
  const keys = Object.keys(normalized) as T[];
  let overflow = totalCount(normalized) - maxTotal;

  if (overflow <= 0) return normalized;

  for (const key of keys) {
    if (overflow <= 0) break;
    const reducible = Math.min(normalized[key], overflow);
    normalized[key] -= reducible;
    overflow -= reducible;
  }

  return normalized;
}

function CountEditor<T extends string>({
  title,
  description,
  counts,
  labels,
  descriptions,
  onChange,
}: {
  title: string;
  description: string;
  counts: Record<T, number>;
  labels: Record<T, string>;
  descriptions?: Partial<Record<T, string>>;
  onChange: (key: T, value: number) => void;
}) {
  return (
    <section className="glass-panel count-editor-card">
      <h2 className="count-editor-title">{title}</h2>
      <p className="count-editor-help">{description}</p>
      <div className="count-editor-list">
        {Object.keys(counts).map((rawKey) => {
          const key = rawKey as T;
          return (
            <div key={key} className="count-editor-row">
              <div className="count-editor-label">
                <strong>{labels[key]}</strong>
                {descriptions?.[key] && (
                  <small className="count-editor-description">{descriptions[key]}</small>
                )}
              </div>
              <div className="count-editor-stepper">
                <button type="button" className="count-editor-btn" onClick={() => onChange(key, Math.max(0, counts[key] - 1))}>
                  -
                </button>
                <input
                  className="count-editor-input"
                  type="number"
                  min="0"
                  max="45"
                  value={counts[key]}
                  onChange={(event) => onChange(key, Math.max(0, Math.min(45, Number(event.target.value) || 0)))}
                />
                <button type="button" className="count-editor-btn" onClick={() => onChange(key, Math.min(45, counts[key] + 1))}>
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <style jsx>{`
        .count-editor-card {
          padding: 2rem;
          border-radius: var(--radius-lg);
        }
        .count-editor-title {
          font-size: 1.25rem;
          color: var(--text-primary);
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border-light);
        }
        .count-editor-help {
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 1rem;
        }
        .count-editor-list {
          display: grid;
          gap: 0.85rem;
        }
        .count-editor-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 0.85rem 1rem;
          border-radius: var(--radius-md);
          background: rgba(255, 250, 242, 0.88);
          border: 1px solid var(--border-light);
        }
        .count-editor-label {
          color: var(--text-primary);
          font-size: 1.02rem;
          display: grid;
          gap: 0.3rem;
          max-width: 72%;
        }
        .count-editor-description {
          color: var(--text-muted);
          font-size: 0.82rem;
          line-height: 1.35;
          font-weight: 500;
        }
        .count-editor-stepper {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          background: white;
          padding: 0.35rem 0.5rem;
          border-radius: 999px;
          border: 1px solid rgba(117, 84, 61, 0.38);
          box-shadow: 0 1px 0 rgba(117, 84, 61, 0.08);
        }
        .count-editor-btn {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          border: 1px solid rgba(166, 84, 44, 0.42);
          background: rgba(255, 242, 230, 0.95);
          color: #7f3f1f;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 1.12rem;
          line-height: 1;
        }
        .count-editor-input {
          width: 62px;
          height: 34px;
          text-align: center;
          border: 1px solid rgba(117, 84, 61, 0.45);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.98);
          font-weight: 800;
          color: #3f2516;
          font-size: 1.15rem;
          letter-spacing: 0.01em;
        }
        .count-editor-input::-webkit-outer-spin-button,
        .count-editor-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .count-editor-input[type='number'] {
          -moz-appearance: textfield;
        }
        @media (max-width: 768px) {
          .count-editor-row {
            flex-direction: column;
            align-items: stretch;
          }
          .count-editor-stepper {
            justify-content: center;
          }
        }
      `}</style>
    </section>
  );
}

export default function NewTestPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('Prueba de Comprension Lectora');
  const [targetGrade, setTargetGrade] = useState('8º Básico');
  const [instructions, setInstructions] = useState('Lee atentamente cada pregunta y responde según lo solicitado.');
  const [teacherRequest, setTeacherRequest] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [cognitiveCounts, setCognitiveCounts] = useState(defaultCognitiveCounts);
  const [typeCounts, setTypeCounts] = useState(defaultTypeCounts);

  const totalCognitive = totalCount(cognitiveCounts);
  const totalTypes = totalCount(typeCounts);
  const isValidDistribution =
    questionCount > 0 &&
    questionCount <= 45 &&
    totalTypes === questionCount &&
    totalCognitive === questionCount;

  const questionPlan = useMemo(
    () => interleavePlan(cognitiveCounts, typeCounts),
    [cognitiveCounts, typeCounts]
  );

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidDistribution) {
      alert('Los conteos cognitivos y de tipos deben coincidir y sumar entre 1 y 45 preguntas.');
      return;
    }

    setLoading(true);
    let createdTestId: string | null = null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Debes iniciar sesion para generar una evaluacion.');
      }

      const generationConfig = {
        targetGrade,
        teacherRequest,
        questionPlan,
        cognitiveCounts,
        typeCounts,
      };

      const { data: test, error: testErr } = await supabase
        .from('tests')
        .insert({
          user_id: user.id,
          book_id: params.id,
          title,
          target_grade: targetGrade,
          instructions,
          status: 'draft',
          generation_config: generationConfig,
          total_score: 0,
        })
        .select()
        .single();

      if (testErr) throw testErr;
      if (!test) throw new Error('No se pudo crear el registro de la evaluacion.');
      createdTestId = test.id;

      const res = await fetch('/api/tests/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: params.id,
          config: generationConfig,
        }),
      });

      const generationData = await res.json();
      if (!res.ok) throw new Error(generationData.error);

      const questions = generationData.questions;
      let totalPoints = 0;

      const testItems = questions.map((question: any, index: number) => {
        const points =
          question.q_type === 'development' || question.q_type === 'creative_writing' ? 3 : 1;
        totalPoints += points;
        return {
          test_id: test.id,
          question_id: question.id,
          item_order: index + 1,
          points,
        };
      });

      const { error: testItemsError } = await supabase.from('test_items').insert(testItems);
      if (testItemsError) throw testItemsError;

      const { error: scoreError } = await supabase
        .from('tests')
        .update({ total_score: totalPoints })
        .eq('id', test.id);
      if (scoreError) throw scoreError;

      router.push(`/books/${params.id}/test/${test.id}`);
    } catch (error) {
      if (createdTestId) {
        await supabase.from('tests').delete().eq('id', createdTestId);
      }
      console.error('Error generating test:', error);
      alert(error instanceof Error ? error.message : 'Error al generar la prueba.');
      setLoading(false);
    }
  };

  return (
    <div className="test-config animate-fade-in">
      <div className="page-header mb-8">
        <Link href={`/books/${params.id}`} className="back-link mb-2">
          ← Volver al Libro
        </Link>
        <h1 className="page-title">Diseñar Evaluacion</h1>
        <p className="page-subtitle">
          Arma la prueba con cantidades exactas, nuevos formatos y una instruccion docente clara para la IA.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="config-grid">
        <section className="glass-panel section-card">
          <h2 className="section-title">Datos Generales</h2>

          <div className="form-group">
            <label>Titulo de la evaluacion</label>
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} required />
          </div>

          <div className="form-group">
            <label>Curso / nivel educativo</label>
            <select className="input" value={targetGrade} onChange={(event) => setTargetGrade(event.target.value)} required>
              <option value="1º Básico">1º Básico</option>
              <option value="2º Básico">2º Básico</option>
              <option value="3º Básico">3º Básico</option>
              <option value="4º Básico">4º Básico</option>
              <option value="5º Básico">5º Básico</option>
              <option value="6º Básico">6º Básico</option>
              <option value="7º Básico">7º Básico</option>
              <option value="8º Básico">8º Básico</option>
              <option value="1º Medio">1º Medio</option>
              <option value="2º Medio">2º Medio</option>
              <option value="3º Medio">3º Medio</option>
              <option value="4º Medio">4º Medio</option>
              <option value="Educación Superior">Educación Superior</option>
            </select>
          </div>

          <div className="form-group">
            <label>Instrucciones para estudiantes</label>
            <textarea className="input" rows={3} value={instructions} onChange={(event) => setInstructions(event.target.value)} />
          </div>

          <div className="teacher-request-card">
            <div className="teacher-request-head">
              <div>
                <p className="teacher-request-kicker">Criterio central del docente</p>
                <label>Encargo docente para la IA</label>
              </div>
              <span className="teacher-request-pill">Define enfoque, temas y capitulos</span>
            </div>
            <textarea
              className="input teacher-request-input"
              rows={5}
              value={teacherRequest}
              onChange={(event) => setTeacherRequest(event.target.value)}
              placeholder="Ej: evita preguntas repetidas sobre el protagonista, prioriza capitulos finales y agrega foco en conflicto, simbolismo y decisiones del antagonista."
            />
            <small className="help-text">
              Este encargo es la pauta pedagógica que la IA debe respetar al construir la prueba.
            </small>
          </div>

          <div className={`summary-card ${isValidDistribution ? 'ok' : 'warn'}`}>
            <div className="summary-metric">
              <span>Preguntas totales</span>
              <strong>{questionCount}</strong>
            </div>
            <div className="summary-metric">
              <span>Habilidades configuradas</span>
              <strong>{totalCognitive}</strong>
            </div>
            <div className="summary-metric">
              <span>Estado</span>
              <strong>{isValidDistribution ? 'Lista para generar' : 'Ajusta los conteos'}</strong>
            </div>
          </div>
        </section>

        <div className="stack-col">
          <section className="glass-panel section-card total-questions-card">
            <h2 className="section-title">Cantidad total de preguntas</h2>
            <div className="total-questions-row">
              <input
                className="input total-questions-input"
                type="number"
                min="1"
                max="45"
                value={questionCount}
                onChange={(event) => {
                  const nextTotal = Math.max(1, Math.min(45, Number(event.target.value) || 1));
                  setQuestionCount(nextTotal);
                  setCognitiveCounts((current) => clampCountsToTotal(current, nextTotal));
                  setTypeCounts((current) => clampCountsToTotal(current, nextTotal));
                }}
              />
              <span className="total-questions-pill">Max 45</span>
            </div>
            <small className="help-text">
              Las habilidades cognitivas y los tipos de pregunta no pueden superar este total.
            </small>
          </section>

          <CountEditor
            title="Habilidades Cognitivas"
            description="Define cuantas preguntas trabajaran localizacion, interpretacion y reflexion."
            counts={cognitiveCounts}
            labels={cognitiveLabels}
            descriptions={cognitiveDescriptions}
            onChange={(key, value) =>
              setCognitiveCounts((current) => updateCountsWithLimit(current, key, value, questionCount))
            }
          />

          <CountEditor
            title="Tipos de Pregunta"
            description="Distribuye la prueba en formatos concretos. La suma total aqui define cuantas preguntas tendrá la evaluacion."
            counts={typeCounts}
            labels={typeLabels}
            onChange={(key, value) =>
              setTypeCounts((current) => updateCountsWithLimit(current, key, value, questionCount))
            }
          />
        </div>

        <div className="action-bar glass-panel">
          <div className="action-copy">
            La IA generará <strong>{questionCount}</strong> preguntas variadas, evitando repetir el mismo tema cuando sea posible.
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-glow" disabled={loading || !isValidDistribution}>
            {loading ? 'Generando evaluacion...' : 'Generar evaluacion'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-modal glass-panel text-center">
            <div className="spinner">IA</div>
            <h2 className="loading-title">Construyendo la evaluacion</h2>
            <p className="loading-copy">Estamos equilibrando temas, tipos de pregunta y nivel cognitivo para que la prueba salga más variada.</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .config-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
          gap: 1.5rem;
          padding-bottom: 2rem;
        }
        .stack-col {
          display: grid;
          gap: 1rem;
        }
        .total-questions-card {
          position: sticky;
          top: 1rem;
          z-index: 4;
        }
        .total-questions-row {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          margin-bottom: 0.55rem;
        }
        .total-questions-input {
          max-width: 140px;
          font-size: 1.15rem;
          font-weight: 800;
          text-align: center;
        }
        .total-questions-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 2.2rem;
          padding: 0 0.75rem;
          border-radius: 999px;
          border: 1px solid rgba(117, 84, 61, 0.3);
          background: rgba(255, 250, 242, 0.9);
          color: #7f3f1f;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .section-card {
          padding: 2rem;
          border-radius: var(--radius-lg);
        }
        .section-title {
          font-size: 1.25rem;
          color: var(--text-primary);
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border-light);
        }
        .section-help {
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 1rem;
        }
        .form-group {
          display: grid;
          gap: 0.45rem;
          margin-bottom: 1rem;
        }
        .form-group label {
          color: var(--text-primary);
          font-weight: 600;
        }
        .teacher-request-card {
          margin-bottom: 1rem;
          padding: 1.2rem;
          border-radius: 1rem;
          background: linear-gradient(135deg, rgba(255, 239, 220, 0.98) 0%, rgba(255, 248, 240, 0.95) 100%);
          border: 1px solid rgba(217, 102, 52, 0.24);
          box-shadow: 0 16px 40px rgba(217, 102, 52, 0.1);
        }
        .teacher-request-head {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: flex-start;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }
        .teacher-request-kicker {
          margin: 0 0 0.25rem;
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .teacher-request-pill {
          display: inline-flex;
          align-items: center;
          padding: 0.45rem 0.8rem;
          border-radius: 999px;
          background: rgba(217, 102, 52, 0.14);
          color: #9d4d26;
          font-size: 0.82rem;
          font-weight: 700;
        }
        .teacher-request-input {
          border-color: rgba(217, 102, 52, 0.3);
          background: rgba(255, 255, 255, 0.96);
        }
        .help-text {
          color: var(--text-muted);
          font-size: 0.82rem;
        }
        .summary-card {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.8rem;
          padding: 1rem;
          border-radius: var(--radius-md);
          margin-top: 1rem;
        }
        .summary-card.ok {
          background: rgba(47, 153, 103, 0.08);
          border: 1px solid rgba(47, 153, 103, 0.18);
        }
        .summary-card.warn {
          background: rgba(217, 102, 52, 0.08);
          border: 1px solid rgba(217, 102, 52, 0.18);
        }
        .summary-metric {
          display: grid;
          gap: 0.2rem;
        }
        .summary-metric span {
          color: var(--text-muted);
          font-size: 0.82rem;
        }
        .summary-metric strong {
          color: var(--text-primary);
        }
        .action-bar {
          position: sticky;
          bottom: 1rem;
          width: 100%;
          padding: 1rem 1.5rem;
          border-radius: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          z-index: 5;
          margin-top: 1.5rem;
          background: linear-gradient(180deg, rgba(255, 250, 242, 0.96) 0%, rgba(255, 240, 220, 0.98) 100%);
          border: 1px solid rgba(180, 110, 68, 0.22);
          box-shadow: 0 14px 30px rgba(160, 101, 58, 0.14);
        }
        .action-copy {
          color: var(--text-secondary);
        }
        .btn-glow {
          box-shadow: 0 12px 26px rgba(217, 102, 52, 0.28);
        }
        .loading-overlay {
          position: fixed;
          inset: 0;
          background: rgba(255, 248, 239, 0.9);
          backdrop-filter: blur(5px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .loading-modal {
          max-width: 400px;
          width: 90%;
          padding: 2rem;
          text-align: center;
        }
        .spinner {
          width: 72px;
          height: 72px;
          margin: 0 auto 1rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: white;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          animation: pulse 1.5s infinite;
        }
        .loading-title {
          margin: 0 0 0.5rem;
          color: var(--text-primary);
        }
        .loading-copy {
          color: var(--text-secondary);
          line-height: 1.6;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.78; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (max-width: 960px) {
          .config-grid {
            grid-template-columns: 1fr;
          }
          .total-questions-card {
            position: static;
          }
        }
        @media (max-width: 768px) {
          .teacher-request-head {
            flex-direction: column;
          }
          .action-bar,
          .summary-card {
            grid-template-columns: 1fr;
          }
          .action-bar {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  );
}
