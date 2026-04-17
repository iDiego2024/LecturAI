'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'development'
  | 'matching'
  | 'creative_writing';

type CognitiveLevel = 'locate' | 'interpret' | 'reflect';

type ExistingQuestion = {
  id: string;
  itemOrder: number;
  question: {
    q_type: QuestionType;
    cognitive_level: CognitiveLevel;
    question_text: string;
    metadata: Record<string, any> | null;
  };
};

type Props = {
  testId: string;
  initialTargetGrade: string;
  initialTeacherRequest: string;
  initialQuestions: ExistingQuestion[];
  initialOpen?: boolean;
  versionLabel: string;
};

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Seleccion multiple' },
  { value: 'true_false', label: 'Verdadero o falso' },
  { value: 'development', label: 'Desarrollo' },
  { value: 'matching', label: 'Terminos pareados' },
  { value: 'creative_writing', label: 'Escritura creativa' },
] as const;

const COGNITIVE_LEVELS = [
  { value: 'locate', label: 'Localizar' },
  { value: 'interpret', label: 'Interpretar' },
  { value: 'reflect', label: 'Reflexionar' },
] as const;

function parseLines(rawText: string) {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseMatchingPairs(rawText: string) {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, right] = line.split(/\s*=>\s*/);
      return {
        left: left?.trim() || '',
        right: right?.trim() || '',
      };
    })
    .filter((pair) => pair.left && pair.right);
}

export default function QuestionComposerPanel({
  testId,
  initialTargetGrade,
  initialTeacherRequest,
  initialQuestions,
  initialOpen = false,
  versionLabel,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [targetGrade, setTargetGrade] = useState(initialTargetGrade);
  const [questionType, setQuestionType] = useState<QuestionType>('multiple_choice');
  const [cognitiveLevel, setCognitiveLevel] = useState<CognitiveLevel>('interpret');
  const [topicHint, setTopicHint] = useState('');
  const [teacherRequest, setTeacherRequest] = useState(initialTeacherRequest);
  const [questionText, setQuestionText] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [distractorsText, setDistractorsText] = useState('');
  const [rubric, setRubric] = useState('');
  const [justification, setJustification] = useState('');
  const [topicLabel, setTopicLabel] = useState('');
  const [creativeTask, setCreativeTask] = useState('');
  const [writingFocusText, setWritingFocusText] = useState('');
  const [matchingPairsText, setMatchingPairsText] = useState('');
  const [points, setPoints] = useState('1');
  const [saving, setSaving] = useState(false);

  const recentTopics = useMemo(
    () =>
      initialQuestions
        .map((item) => item.question.metadata?.topic_label)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .slice(0, 6),
    [initialQuestions]
  );

  useEffect(() => {
    setOpen(initialOpen);
  }, [initialOpen]);

  useEffect(() => {
    setTargetGrade(initialTargetGrade);
    setTeacherRequest(initialTeacherRequest);
  }, [initialTargetGrade, initialTeacherRequest]);

  const resetManualFields = () => {
    setQuestionText('');
    setCorrectAnswer('');
    setDistractorsText('');
    setRubric('');
    setJustification('');
    setTopicLabel('');
    setCreativeTask('');
    setWritingFocusText('');
    setMatchingPairsText('');
    setPoints('1');
  };

  const closeComposer = () => {
    setOpen(false);
    router.push(window.location.pathname);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const metadata: Record<string, unknown> = {
        topic_label: topicLabel.trim() || null,
      };

      if (questionType === 'matching') {
        metadata.matching_pairs = parseMatchingPairs(matchingPairsText);
      }

      if (questionType === 'creative_writing') {
        metadata.creative_task = creativeTask.trim() || null;
        metadata.writing_focus = parseLines(writingFocusText);
      }

      const body =
        mode === 'ai'
          ? {
              mode,
              targetGrade,
              topicHint,
              teacherRequest,
              questionType,
              cognitiveLevel,
            }
          : {
              mode,
              targetGrade,
              questionType,
              cognitiveLevel,
              questionText,
              correctAnswer,
              distractors: parseLines(distractorsText),
              rubric,
              justification,
              points: Number(points || 1),
              metadata,
            };

      const res = await fetch(`/api/tests/${testId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la pregunta.');

      setTopicHint('');
      if (mode === 'manual') {
        resetManualFields();
      }
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo crear la pregunta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="composer-shell">
      {open ? (
        <section className="composer-panel glass-panel">
          <div className="composer-head">
            <div>
              <p className="composer-kicker">Composicion docente</p>
              <h3 className="composer-title">Agregar pregunta nueva</h3>
              <p className="composer-copy">
                Elige si quieres que la IA proponga la pregunta o si prefieres redactarla manualmente. Esta accion afecta solo a <strong>{versionLabel}</strong>.
              </p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={closeComposer}>
              Cerrar
            </button>
          </div>

          <div className="mode-tabs" role="tablist" aria-label="Modo de creacion de pregunta">
            <button
              type="button"
              className={`mode-tab ${mode === 'ai' ? 'is-active' : ''}`}
              onClick={() => setMode('ai')}
            >
              Agregar con IA
            </button>
            <button
              type="button"
              className={`mode-tab ${mode === 'manual' ? 'is-active' : ''}`}
              onClick={() => setMode('manual')}
            >
              Agregar manualmente
            </button>
          </div>

          <div className="scope-box">
            <strong>Alcance actual:</strong> la nueva pregunta se agregara solo a <strong>{versionLabel}</strong>. Las otras variantes ya creadas no se modifican automaticamente.
          </div>

          <div className="composer-grid">
            <div className="editor-block">
              <label>Tipo de pregunta</label>
              <select
                className="input"
                value={questionType}
                onChange={(event) => setQuestionType(event.target.value as QuestionType)}
              >
                {QUESTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="editor-block">
              <label>Habilidad cognitiva</label>
              <select
                className="input"
                value={cognitiveLevel}
                onChange={(event) => setCognitiveLevel(event.target.value as CognitiveLevel)}
              >
                {COGNITIVE_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="editor-block">
            <label>Curso o nivel</label>
            <input className="input" value={targetGrade} onChange={(event) => setTargetGrade(event.target.value)} />
          </div>

          {mode === 'ai' ? (
            <>
              <div className="editor-block">
                <label>Tema o eje del libro</label>
                <input
                  className="input"
                  value={topicHint}
                  onChange={(event) => setTopicHint(event.target.value)}
                  placeholder="Ej: conflicto principal, capitulo 7, simbolos del desenlace"
                />
              </div>

              <div className="teacher-request-box">
                <div className="teacher-request-head">
                  <div>
                    <p className="composer-kicker">Encargo destacado</p>
                    <h4 className="teacher-request-title">Encargo docente para la IA</h4>
                  </div>
                  <span className="status-chip emphasis-chip">Define el enfoque de esta nueva pregunta</span>
                </div>
                <p className="teacher-request-copy">
                  Aqui el docente puede exigir un enfoque preciso: capitulos, temas, personajes, profundidad o tono de la pregunta.
                </p>
                <textarea
                  className="input teacher-request-input"
                  rows={5}
                  value={teacherRequest}
                  onChange={(event) => setTeacherRequest(event.target.value)}
                  placeholder="Ej: enfocate en el conflicto del capitulo final, evita repetir al protagonista y pide una inferencia desafiante."
                />
              </div>
            </>
          ) : (
            <>
              <div className="editor-block">
                <label>Enunciado</label>
                <textarea
                  className="input"
                  rows={3}
                  value={questionText}
                  onChange={(event) => setQuestionText(event.target.value)}
                  placeholder="Escribe la pregunta tal como la veran los estudiantes."
                />
              </div>

              <div className="composer-grid">
                <div className="editor-block">
                  <label>Respuesta esperada</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={correctAnswer}
                    onChange={(event) => setCorrectAnswer(event.target.value)}
                  />
                </div>
                <div className="editor-block">
                  <label>Tema de referencia</label>
                  <input
                    className="input"
                    value={topicLabel}
                    onChange={(event) => setTopicLabel(event.target.value)}
                    placeholder="Ej: cierre del conflicto, caracterizacion del antagonista"
                  />
                </div>
              </div>

              {questionType === 'multiple_choice' && (
                <div className="editor-block">
                  <label>Alternativas incorrectas</label>
                  <textarea
                    className="input"
                    rows={4}
                    value={distractorsText}
                    onChange={(event) => setDistractorsText(event.target.value)}
                    placeholder="Una alternativa por linea"
                  />
                </div>
              )}

              {questionType === 'matching' && (
                <div className="editor-block">
                  <label>Pares de relacion</label>
                  <textarea
                    className="input"
                    rows={5}
                    value={matchingPairsText}
                    onChange={(event) => setMatchingPairsText(event.target.value)}
                    placeholder="Concepto => relacion correcta"
                  />
                </div>
              )}

              {questionType === 'creative_writing' && (
                <>
                  <div className="editor-block">
                    <label>Consigna creativa</label>
                    <input
                      className="input"
                      value={creativeTask}
                      onChange={(event) => setCreativeTask(event.target.value)}
                    />
                  </div>
                  <div className="editor-block">
                    <label>Focos de escritura</label>
                    <textarea
                      className="input"
                      rows={4}
                      value={writingFocusText}
                      onChange={(event) => setWritingFocusText(event.target.value)}
                      placeholder="Un foco por linea"
                    />
                  </div>
                </>
              )}

              {(questionType === 'development' || questionType === 'creative_writing') && (
                <div className="editor-block">
                  <label>Rubrica o pauta</label>
                  <textarea
                    className="input"
                    rows={4}
                    value={rubric}
                    onChange={(event) => setRubric(event.target.value)}
                  />
                </div>
              )}

              <div className="composer-grid">
                <div className="editor-block">
                  <label>Justificacion pedagogica</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={justification}
                    onChange={(event) => setJustification(event.target.value)}
                  />
                </div>
                <div className="editor-block">
                  <label>Puntaje</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={points}
                    onChange={(event) => setPoints(event.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {recentTopics.length > 0 && (
            <div className="recent-topics">
              <span className="recent-topics-label">Temas ya presentes:</span>
              {recentTopics.map((topic) => (
                <span key={topic} className="topic-chip">
                  {topic}
                </span>
              ))}
            </div>
          )}

          <div className="composer-actions">
            <button type="button" className="btn btn-primary btn-glow" onClick={handleCreate} disabled={saving}>
              {saving
                ? mode === 'ai'
                  ? 'Creando pregunta...'
                  : 'Guardando pregunta...'
                : mode === 'ai'
                  ? `Agregar pregunta con IA a ${versionLabel}`
                  : `Agregar pregunta manual a ${versionLabel}`}
            </button>
          </div>
        </section>
      ) : null}

      <style jsx>{`
        .composer-shell {
          margin: 1rem 0 2rem;
        }
        .composer-panel {
          padding: 1.4rem;
          border: 1px solid rgba(217, 102, 52, 0.16);
          background: linear-gradient(
            180deg,
            rgba(255, 252, 247, 0.98) 0%,
            rgba(255, 244, 231, 0.94) 100%
          );
        }
        .composer-head,
        .teacher-request-head,
        .composer-actions {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .composer-head,
        .teacher-request-head {
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        .composer-kicker {
          margin: 0 0 0.2rem;
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .composer-title,
        .teacher-request-title {
          margin: 0;
          color: var(--text-primary);
        }
        .composer-copy {
          margin: 0.4rem 0 0;
          color: var(--text-secondary);
          line-height: 1.6;
        }
        .mode-tabs {
          display: inline-flex;
          gap: 0.5rem;
          padding: 0.35rem;
          border-radius: 999px;
          background: rgba(255, 250, 242, 0.92);
          border: 1px solid rgba(82, 52, 26, 0.08);
          margin-bottom: 1.1rem;
        }
        .scope-box {
          margin-bottom: 1rem;
          padding: 0.95rem 1rem;
          border-radius: 0.95rem;
          background: rgba(255, 250, 242, 0.92);
          border: 1px solid rgba(82, 52, 26, 0.1);
          color: var(--text-secondary);
          line-height: 1.55;
        }
        .mode-tab {
          border: none;
          border-radius: 999px;
          padding: 0.75rem 1rem;
          background: transparent;
          color: var(--text-secondary);
          font-weight: 700;
        }
        .mode-tab.is-active {
          background: linear-gradient(135deg, rgba(217, 102, 52, 0.16) 0%, rgba(255, 237, 220, 0.95) 100%);
          color: #9d4d26;
          box-shadow: 0 10px 24px rgba(217, 102, 52, 0.14);
        }
        .composer-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }
        .editor-block {
          display: grid;
          gap: 0.45rem;
          margin-bottom: 1rem;
        }
        .editor-block label {
          color: var(--text-primary);
          font-weight: 600;
          font-size: 0.92rem;
        }
        .teacher-request-box {
          margin-bottom: 1rem;
          padding: 1.2rem;
          border-radius: 1rem;
          background: linear-gradient(
            135deg,
            rgba(255, 239, 220, 0.98) 0%,
            rgba(255, 248, 240, 0.95) 100%
          );
          border: 1px solid rgba(217, 102, 52, 0.24);
          box-shadow: 0 16px 40px rgba(217, 102, 52, 0.1);
        }
        .teacher-request-copy {
          margin: 0 0 0.85rem;
          color: var(--text-secondary);
          line-height: 1.6;
        }
        .teacher-request-input {
          border-color: rgba(217, 102, 52, 0.3);
          background: rgba(255, 255, 255, 0.96);
        }
        .status-chip {
          display: inline-flex;
          align-items: center;
          padding: 0.45rem 0.8rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.76);
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 700;
        }
        .emphasis-chip {
          background: rgba(217, 102, 52, 0.14);
          color: #9d4d26;
        }
        .recent-topics {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: 1rem;
        }
        .recent-topics-label {
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-weight: 700;
        }
        .topic-chip {
          padding: 0.3rem 0.65rem;
          border-radius: 999px;
          background: rgba(255, 250, 242, 0.95);
          border: 1px solid rgba(82, 52, 26, 0.1);
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 700;
        }
        .btn-glow {
          box-shadow: 0 12px 26px rgba(217, 102, 52, 0.24);
        }
        @media (max-width: 768px) {
          .composer-head,
          .teacher-request-head {
            flex-direction: column;
          }
          .composer-grid {
            grid-template-columns: 1fr;
          }
          .mode-tabs {
            width: 100%;
            display: grid;
          }
        }
      `}</style>
    </section>
  );
}
