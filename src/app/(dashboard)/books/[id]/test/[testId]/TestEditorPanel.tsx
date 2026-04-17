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

type QuestionDraft = {
  id: string;
  itemOrder: number;
  points: number;
  question: {
    id: string;
    q_type: QuestionType;
    cognitive_level: CognitiveLevel;
    question_text: string;
    correct_answer: string;
    distractors: string[] | null;
    metadata: Record<string, any> | null;
    rubric: string | null;
    justification: string | null;
  };
};

type Props = {
  testId: string;
  initialTitle: string;
  initialInstructions: string;
  initialTargetGrade: string;
  initialTeacherRequest: string;
  initialQuestions: QuestionDraft[];
  initialEditMode?: boolean;
  versionLabel: string;
};

const COGNITIVE_LEVELS = [
  { value: 'locate', label: 'Localizar' },
  { value: 'interpret', label: 'Interpretar' },
  { value: 'reflect', label: 'Reflexionar' },
] as const;

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Seleccion multiple' },
  { value: 'true_false', label: 'Verdadero o falso' },
  { value: 'development', label: 'Desarrollo' },
  { value: 'matching', label: 'Terminos pareados' },
  { value: 'creative_writing', label: 'Escritura creativa' },
] as const;

function translateType(value: QuestionType) {
  return QUESTION_TYPES.find((type) => type.value === value)?.label || value;
}

function buildInitialForms(initialQuestions: QuestionDraft[]) {
  return initialQuestions.reduce<Record<string, any>>((acc, item) => {
    acc[item.id] = {
      questionText: item.question.question_text || '',
      correctAnswer: item.question.correct_answer || '',
      distractorsText: (item.question.distractors || []).join('\n'),
      rubric: item.question.rubric || '',
      justification: item.question.justification || '',
      points: item.points || 1,
      topicLabel: item.question.metadata?.topic_label || '',
      writingFocusText: Array.isArray(item.question.metadata?.writing_focus)
        ? item.question.metadata.writing_focus.join('\n')
        : '',
      creativeTask: item.question.metadata?.creative_task || '',
      matchingPairsText: Array.isArray(item.question.metadata?.matching_pairs)
        ? item.question.metadata.matching_pairs
            .map((pair: any) => `${pair?.left || ''} => ${pair?.right || ''}`)
            .join('\n')
        : '',
    };
    return acc;
  }, {});
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

function parseLines(rawText: string) {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function TestEditorPanel({
  testId,
  initialTitle,
  initialInstructions,
  initialTargetGrade,
  initialTeacherRequest,
  initialQuestions,
  initialEditMode = false,
  versionLabel,
}: Props) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(initialEditMode);
  const [title, setTitle] = useState(initialTitle);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [targetGrade, setTargetGrade] = useState(initialTargetGrade);
  const [teacherRequest, setTeacherRequest] = useState(initialTeacherRequest);
  const [saving, setSaving] = useState(false);
  const [questionForms, setQuestionForms] = useState<Record<string, any>>(() =>
    buildInitialForms(initialQuestions)
  );
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);

  const sortedQuestions = useMemo(
    () => [...initialQuestions].sort((a, b) => a.itemOrder - b.itemOrder),
    [initialQuestions]
  );

  useEffect(() => {
    setQuestionForms(buildInitialForms(initialQuestions));
  }, [initialQuestions]);

  useEffect(() => {
    setEditMode(initialEditMode);
  }, [initialEditMode]);

  useEffect(() => {
    setTitle(initialTitle);
    setInstructions(initialInstructions);
    setTargetGrade(initialTargetGrade);
    setTeacherRequest(initialTeacherRequest);
  }, [initialTitle, initialInstructions, initialTargetGrade, initialTeacherRequest]);

  const closeEditMode = () => {
    setEditMode(false);
    router.push(window.location.pathname);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tests/${testId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          instructions,
          targetGrade,
          teacherRequest,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la evaluacion.');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo guardar la evaluacion.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuestionField = (itemId: string, field: string, value: string | number) => {
    setQuestionForms((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        [field]: value,
      },
    }));
  };

  const handleSaveQuestion = async (item: QuestionDraft) => {
    const form = questionForms[item.id];
    if (!form) return;

    setSavingQuestionId(item.id);
    try {
      const metadata: Record<string, any> = {
        ...(item.question.metadata || {}),
        topic_label: form.topicLabel?.trim() || null,
      };

      if (item.question.q_type === 'matching') {
        metadata.matching_pairs = parseMatchingPairs(form.matchingPairsText || '');
      }

      if (item.question.q_type === 'creative_writing') {
        metadata.creative_task = form.creativeTask?.trim() || null;
        metadata.writing_focus = parseLines(form.writingFocusText || '');
      }

      const res = await fetch(`/api/tests/${testId}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: form.questionText,
          correctAnswer: form.correctAnswer,
          distractors: parseLines(form.distractorsText || ''),
          rubric: form.rubric,
          justification: form.justification,
          points: Number(form.points || 1),
          metadata,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la pregunta.');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo guardar la pregunta.');
    } finally {
      setSavingQuestionId(null);
    }
  };

  const handleDeleteQuestion = async (item: QuestionDraft) => {
    const confirmed = window.confirm(
      `Se eliminara la pregunta ${item.itemOrder}. Esta accion no se puede deshacer.`
    );
    if (!confirmed) return;

    setDeletingQuestionId(item.id);
    try {
      const res = await fetch(`/api/tests/${testId}/items/${item.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar la pregunta.');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo eliminar la pregunta.');
    } finally {
      setDeletingQuestionId(null);
    }
  };

  return (
    <section className="editor-shell">
      {editMode && (
        <section className="editor-panel glass-panel">
          <div className="editor-header">
            <div>
              <p className="editor-kicker">Edicion docente</p>
              <h3 className="editor-section-title">Ajusta la configuracion y revisa las preguntas existentes</h3>
              <p className="editor-scope-copy">
                Todo lo que guardes aqui modifica solo <strong>{versionLabel}</strong>.
              </p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={closeEditMode}>
              Cerrar modo edicion
            </button>
          </div>

          <div className="editor-grid">
            <div className="editor-block">
              <label>Titulo</label>
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="editor-block">
              <label>Curso</label>
              <input
                className="input"
                value={targetGrade}
                onChange={(event) => setTargetGrade(event.target.value)}
              />
            </div>
          </div>

          <div className="editor-block">
            <label>Instrucciones</label>
            <textarea
              className="input"
              rows={3}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </div>

          <div className="teacher-request-box">
            <div className="teacher-request-head">
              <div>
                <p className="editor-kicker">Criterio pedagógico</p>
                <h3 className="editor-section-title">Encargo docente para la IA</h3>
              </div>
              <span className="status-chip emphasis-chip">Guia el enfoque de toda la prueba</span>
            </div>
            <p className="teacher-request-copy">
              Usa este espacio para indicar capitulos, temas, personajes, habilidades o sesgos que quieres priorizar. Esta pauta se conserva como referencia central de la evaluacion.
            </p>
            <textarea
              className="input teacher-request-input"
              rows={5}
              value={teacherRequest}
              onChange={(event) => setTeacherRequest(event.target.value)}
              placeholder="Ej: concentra la prueba en los capitulos finales, evita preguntas literales repetidas y da prioridad al conflicto principal y al simbolismo."
            />
          </div>

          <div className="editor-actions">
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : `Guardar configuracion de ${versionLabel}`}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push(`${window.location.pathname}?mode=add-question`)}
            >
              Agregar pregunta a esta version
            </button>
          </div>

          <div className="question-manager">
            <div className="assistant-head">
              <div>
                <p className="editor-kicker">Edicion de preguntas</p>
                <h3 className="editor-section-title">Corrige, ajusta o elimina preguntas ya creadas</h3>
              </div>
              <span className="status-chip">{sortedQuestions.length} preguntas cargadas</span>
            </div>

            <div className="question-manager-note">
              Las preguntas nuevas se agregan desde el modo separado <strong>Agregar pregunta</strong> para que la edición y la composición no se mezclen.
            </div>

            <div className="question-stack">
              {sortedQuestions.map((item) => {
                const form = questionForms[item.id];
                if (!form) return null;

                return (
                  <article key={item.id} className="question-editor-card">
                    <div className="question-editor-head">
                      <div>
                        <strong>Pregunta {item.itemOrder}</strong>
                        <p>
                          {translateType(item.question.q_type)} ·{' '}
                          {
                            COGNITIVE_LEVELS.find(
                              (level) => level.value === item.question.cognitive_level
                            )?.label
                          }
                        </p>
                      </div>
                      <div className="question-head-actions">
                        <label className="mini-field">
                          <span>Puntaje</span>
                          <input
                            className="input mini-input"
                            type="number"
                            min={1}
                            value={form.points}
                            onChange={(event) =>
                              handleQuestionField(item.id, 'points', event.target.value)
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => handleSaveQuestion(item)}
                          disabled={savingQuestionId === item.id}
                        >
                          {savingQuestionId === item.id ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          onClick={() => handleDeleteQuestion(item)}
                          disabled={deletingQuestionId === item.id}
                        >
                          {deletingQuestionId === item.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </div>

                    <div className="editor-block">
                      <label>Enunciado</label>
                      <textarea
                        className="input"
                        rows={3}
                        value={form.questionText}
                        onChange={(event) =>
                          handleQuestionField(item.id, 'questionText', event.target.value)
                        }
                      />
                    </div>

                    <div className="editor-grid">
                      <div className="editor-block">
                        <label>Respuesta esperada</label>
                        <textarea
                          className="input"
                          rows={item.question.q_type === 'true_false' ? 2 : 3}
                          value={form.correctAnswer}
                          onChange={(event) =>
                            handleQuestionField(item.id, 'correctAnswer', event.target.value)
                          }
                        />
                      </div>
                      <div className="editor-block">
                        <label>Tema de referencia</label>
                        <input
                          className="input"
                          value={form.topicLabel}
                          onChange={(event) =>
                            handleQuestionField(item.id, 'topicLabel', event.target.value)
                          }
                        />
                      </div>
                    </div>

                    {item.question.q_type === 'multiple_choice' && (
                      <div className="editor-block">
                        <label>Alternativas incorrectas</label>
                        <textarea
                          className="input"
                          rows={4}
                          value={form.distractorsText}
                          onChange={(event) =>
                            handleQuestionField(item.id, 'distractorsText', event.target.value)
                          }
                          placeholder="Una alternativa por linea"
                        />
                      </div>
                    )}

                    {item.question.q_type === 'matching' && (
                      <div className="editor-block">
                        <label>Pares de relacion</label>
                        <textarea
                          className="input"
                          rows={5}
                          value={form.matchingPairsText}
                          onChange={(event) =>
                            handleQuestionField(item.id, 'matchingPairsText', event.target.value)
                          }
                          placeholder="Concepto => relacion correcta"
                        />
                      </div>
                    )}

                    {item.question.q_type === 'creative_writing' && (
                      <>
                        <div className="editor-block">
                          <label>Consigna creativa</label>
                          <input
                            className="input"
                            value={form.creativeTask}
                            onChange={(event) =>
                              handleQuestionField(item.id, 'creativeTask', event.target.value)
                            }
                          />
                        </div>
                        <div className="editor-block">
                          <label>Focos de escritura</label>
                          <textarea
                            className="input"
                            rows={4}
                            value={form.writingFocusText}
                            onChange={(event) =>
                              handleQuestionField(item.id, 'writingFocusText', event.target.value)
                            }
                            placeholder="Un foco por linea"
                          />
                        </div>
                      </>
                    )}

                    {(item.question.q_type === 'development' ||
                      item.question.q_type === 'creative_writing') && (
                      <div className="editor-block">
                        <label>Rubrica o pauta</label>
                        <textarea
                          className="input"
                          rows={4}
                          value={form.rubric}
                          onChange={(event) => handleQuestionField(item.id, 'rubric', event.target.value)}
                        />
                      </div>
                    )}

                    <div className="editor-block">
                      <label>Justificacion pedagogica</label>
                      <textarea
                        className="input"
                        rows={3}
                        value={form.justification}
                        onChange={(event) =>
                          handleQuestionField(item.id, 'justification', event.target.value)
                        }
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <style jsx>{`
        .editor-shell {
          margin: 1rem 0 2rem;
        }
        .editor-panel {
          padding: 1.4rem;
          border: 1px solid var(--border-light);
          background: linear-gradient(
            180deg,
            rgba(255, 252, 247, 0.98) 0%,
            rgba(255, 244, 231, 0.94) 100%
          );
        }
        .editor-header,
        .assistant-head,
        .question-editor-head,
        .question-head-actions,
        .editor-actions,
        .teacher-request-head {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .editor-header,
        .assistant-head,
        .question-editor-head,
        .teacher-request-head {
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        .editor-kicker {
          margin: 0 0 0.2rem;
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .editor-scope-copy {
          margin: 0.35rem 0 0;
          color: var(--text-secondary);
          line-height: 1.55;
        }
        .editor-section-title {
          margin: 0;
          font-size: 1.05rem;
          color: var(--text-primary);
        }
        .editor-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }
        .editor-block {
          display: grid;
          gap: 0.45rem;
          margin-bottom: 1rem;
        }
        .editor-block label,
        .mini-field span {
          color: var(--text-primary);
          font-weight: 600;
          font-size: 0.92rem;
        }
        .teacher-request-box,
        .question-manager {
          margin-top: 1.6rem;
          padding-top: 1.25rem;
          border-top: 1px solid var(--border-light);
        }
        .teacher-request-box {
          padding: 1.25rem;
          border-radius: 1.1rem;
          border: 1px solid rgba(217, 102, 52, 0.22);
          background: linear-gradient(
            135deg,
            rgba(255, 239, 220, 0.98) 0%,
            rgba(255, 248, 240, 0.95) 100%
          );
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
          background: rgba(255, 255, 255, 0.7);
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 700;
        }
        .emphasis-chip {
          background: rgba(217, 102, 52, 0.14);
          color: #9d4d26;
        }
        .btn-small {
          padding: 0.72rem 0.95rem;
          font-size: 0.9rem;
        }
        .btn-danger {
          background: linear-gradient(135deg, #b84a36 0%, #d9654d 100%);
          color: #fff;
          border: none;
        }
        .question-manager-note {
          margin-bottom: 1rem;
          padding: 0.95rem 1rem;
          border-radius: 0.9rem;
          background: rgba(255, 250, 242, 0.92);
          border: 1px solid rgba(82, 52, 26, 0.08);
          color: var(--text-secondary);
          line-height: 1.55;
        }
        .question-stack {
          display: grid;
          gap: 1rem;
        }
        .question-editor-card {
          padding: 1rem;
          border-radius: 1rem;
          border: 1px solid rgba(82, 52, 26, 0.12);
          background: rgba(255, 255, 255, 0.72);
        }
        .question-editor-head p {
          margin: 0.25rem 0 0;
          color: var(--text-secondary);
          font-size: 0.92rem;
        }
        .mini-field {
          display: grid;
          gap: 0.35rem;
        }
        .mini-input {
          width: 5.5rem;
          min-width: 5.5rem;
        }
        @media (max-width: 768px) {
          .editor-header,
          .assistant-head,
          .question-editor-head,
          .teacher-request-head {
            flex-direction: column;
          }
          .question-head-actions {
            width: 100%;
          }
          .editor-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
