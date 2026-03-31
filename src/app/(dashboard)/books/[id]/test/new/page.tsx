'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function NewTestPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  
  // Test parameters
  const [title, setTitle] = useState('Prueba de Comprensión Lector');
  const [targetGrade, setTargetGrade] = useState('8º Básico');
  const [instructions, setInstructions] = useState('Lee atentamente cada pregunta y responde según lo solicitado.');
  const [questionCount, setQuestionCount] = useState(10);
  
  // Distribution sliders (must sum to 100 or be proportional)
  const [cogLocate, setCogLocate] = useState(30);
  const [cogInterpret, setCogInterpret] = useState(50);
  const [cogReflect, setCogReflect] = useState(20);
  
  const [typeMultiple, setTypeMultiple] = useState(60);
  const [typeTrueFalse, setTypeTrueFalse] = useState(20);
  const [typeDev, setTypeDev] = useState(20);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Calculate distributions into arrays for the API
      // E.g. [ 'locate', 'locate', 'interpret', 'interpret' ] proportional to count
      const calculateArray = (count: number, ratios: Record<string, number>) => {
        const totalParams = Object.values(ratios).reduce((a, b) => a + b, 0);
        let result: string[] = [];
        Object.entries(ratios).forEach(([key, ratio]) => {
          const amount = Math.round((ratio / totalParams) * count);
          for(let i=0; i<amount; i++) result.push(key);
        });
        
        // Adjust if rounding caused length mismatch
        if (result.length > count) result = result.slice(0, count);
        while (result.length < count) result.push(Object.keys(ratios)[0]);
        
        return result;
      };

      const cognitiveDist = calculateArray(questionCount, {
        locate: cogLocate,
        interpret: cogInterpret,
        reflect: cogReflect
      });

      const typesDist = calculateArray(questionCount, {
        multiple_choice: typeMultiple,
        true_false: typeTrueFalse,
        development: typeDev
      });

      const config = {
        targetGrade,
        distribution: {
          cognitive: cognitiveDist,
          types: typesDist
        }
      };

      // 2. Create Test Record
      const { data: { user } } = await supabase.auth.getUser();
      const { data: test, error: testErr } = await supabase
        .from('tests')
        .insert({
          user_id: user?.id,
          book_id: params.id,
          title,
          target_grade: targetGrade,
          instructions,
          status: 'draft'
        })
        .select()
        .single();

      if (testErr) throw testErr;

      // 3. Call Generation API
      const res = await fetch('/api/tests/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: params.id,
          count: questionCount,
          config
        })
      });

      const generationData = await res.json();
      if (!res.ok) throw new Error(generationData.error);

      // 4. Link questions to test via test_items
      const questions = generationData.questions;
      let totalPoints = 0;
      
      const testItems = questions.map((q: any, i: number) => {
        const points = q.q_type === 'development' ? 3 : 1;
        totalPoints += points;
        return {
          test_id: test.id,
          question_id: q.id,
          item_order: i + 1,
          points: points
        };
      });

      await supabase.from('test_items').insert(testItems);
      
      // Update total score
      await supabase.from('tests').update({ total_score: totalPoints }).eq('id', test.id);

      // 5. Redirect to review page
      router.push(`/books/${params.id}/test/${test.id}`);

    } catch (error) {
      console.error('Error generating test:', error);
      alert('Error al generar la prueba. Por favor intenta nuevamente.');
      setLoading(false);
    }
  };

  return (
    <div className="test-config animate-fade-in">
      <div className="page-header mb-8">
        <Link href={`/books/${params.id}`} className="back-link mb-2">← Volver al Libro</Link>
        <h1 className="page-title">Configurar Evaluación</h1>
        <p className="page-subtitle">Parametriza la prueba antes de que la Inteligencia Artificial genere las preguntas.</p>
      </div>

      <form onSubmit={handleGenerate} className="config-grid">
        
        {/* Left Column - General Settings */}
        <div className="config-col">
          <section className="glass-panel section-card">
            <h2 className="section-title">Datos Generales</h2>
            
            <div className="form-group">
              <label>Título de la Prueba</label>
              <input 
                type="text" 
                className="input" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                required 
              />
            </div>
            
            <div className="form-group mt-4">
              <label>Curso / Nivel Educativo</label>
              <select 
                className="input" 
                value={targetGrade} 
                onChange={e => setTargetGrade(e.target.value)} 
                required 
              >
                <option value="" disabled>Selecciona un nivel</option>
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
              <small className="help-text">La IA ajustará el vocabulario a este nivel.</small>
            </div>

            <div className="form-group mt-4">
              <label>Instrucciones</label>
              <textarea 
                className="input" 
                rows={3}
                value={instructions} 
                onChange={e => setInstructions(e.target.value)} 
              />
            </div>

            <div className="form-group mt-4">
              <label>Cantidad de Preguntas Totales</label>
              <div className="number-input-wrap">
                <input 
                  type="range" 
                  min="5" 
                  max="30" 
                  value={questionCount} 
                  onChange={e => setQuestionCount(parseInt(e.target.value))} 
                  className="range-slider accent-slider"
                />
                <span className="number-display">{questionCount}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column - Distributions */}
        <div className="config-col">
          <section className="glass-panel section-card h-full">
            <h2 className="section-title">Distribución Pedagógica</h2>
            
            <div className="distribution-block">
              <h3 className="sub-heading">Habilidades Cognitivas</h3>
              
              <div className="slider-group">
                <div className="slider-label">
                  <span>Localizar Información (%)</span>
                  <span>{cogLocate}%</span>
                </div>
                <input type="range" min="0" max="100" value={cogLocate} onChange={e => setCogLocate(parseInt(e.target.value))} className="range-slider" />
                <small className="help-text">Recordar hechos, personajes y datos explícitos.</small>
              </div>

              <div className="slider-group">
                <div className="slider-label">
                  <span>Interpretar (%)</span>
                  <span>{cogInterpret}%</span>
                </div>
                <input type="range" min="0" max="100" value={cogInterpret} onChange={e => setCogInterpret(parseInt(e.target.value))} className="range-slider" />
                <small className="help-text">Inferir intenciones, relaciones y motivos.</small>
              </div>

              <div className="slider-group">
                <div className="slider-label">
                  <span>Reflexionar (%)</span>
                  <span>{cogReflect}%</span>
                </div>
                <input type="range" min="0" max="100" value={cogReflect} onChange={e => setCogReflect(parseInt(e.target.value))} className="range-slider" />
                <small className="help-text">Evaluar, conectar y emitir juicios críticos.</small>
              </div>
            </div>

            <hr className="divider" />

            <div className="distribution-block">
              <h3 className="sub-heading">Tipos de Preguntas</h3>
              
              <div className="slider-group">
                <div className="slider-label">
                  <span>Selección Múltiple (%)</span>
                  <span>{typeMultiple}%</span>
                </div>
                <input type="range" min="0" max="100" value={typeMultiple} onChange={e => setTypeMultiple(parseInt(e.target.value))} className="range-slider" />
              </div>

              <div className="slider-group">
                <div className="slider-label">
                  <span>Verdadero y Falso (%)</span>
                  <span>{typeTrueFalse}%</span>
                </div>
                <input type="range" min="0" max="100" value={typeTrueFalse} onChange={e => setTypeTrueFalse(parseInt(e.target.value))} className="range-slider" />
              </div>

              <div className="slider-group">
                <div className="slider-label">
                  <span>Desarrollo (%)</span>
                  <span>{typeDev}%</span>
                </div>
                <input type="range" min="0" max="100" value={typeDev} onChange={e => setTypeDev(parseInt(e.target.value))} className="range-slider" />
              </div>
            </div>
          </section>
        </div>

        {/* Floating Action */}
        <div className="action-bar glass-panel">
          <div className="action-info">
            La IA leerá sus análisis y generará <strong>{questionCount} preguntas</strong> únicas.
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-glow" disabled={loading}>
            {loading ? 'Generando con IA...' : 'Generar Prueba'}
          </button>
        </div>
      </form>

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-modal glass-panel text-center">
            <div className="spinner">✨</div>
            <h2 className="text-xl font-bold mt-4 mb-2 text-white">Generando Evaluación</h2>
            <p className="text-muted">LecturAI está diseñando preguntas basadas en pedagogía crítica. Esto tomará unos 20-40 segundos.</p>
            
            <div className="loading-steps mt-6 text-left">
              <div className="step active">Recuperando extractos del texto...</div>
              <div className="step active">Aplicando modelos cognitivos...</div>
              <div className="step">Escribiendo distractores plausibles...</div>
              <div className="step">Armando la pauta de corrección...</div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .config-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          padding-bottom: 8rem; /* space for fixed action bar */
        }
        
        @media (max-width: 900px) {
          .config-grid { grid-template-columns: 1fr; }
        }

        .section-card { padding: 2rem; border-radius: var(--radius-lg); }
        .h-full { height: 100%; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .mt-4 { margin-top: 1rem; }
        .mt-6 { margin-top: 1.5rem; }
        .font-bold { font-weight: 700; }
        .text-white { color: var(--text-primary); }
        
        .section-title {
          font-size: 1.25rem;
          color: var(--text-primary);
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border-light);
        }

        .sub-heading {
          font-size: 1.05rem;
          color: var(--text-primary);
          margin-bottom: 1.25rem;
          font-weight: 600;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
          font-weight: 500;
          font-size: 0.95rem;
        }

        .help-text {
          display: block;
          margin-top: 0.4rem;
          color: var(--text-muted);
          font-size: 0.8rem;
        }

        .number-input-wrap {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .number-display {
          background: var(--bg-tertiary);
          padding: 0.5rem 1rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-light);
          font-weight: 700;
          color: var(--text-primary);
          min-width: 60px;
          text-align: center;
        }

        .distribution-block { margin-bottom: 1rem; }
        
        .divider {
          border: none;
          height: 1px;
          background: var(--border-light);
          margin: 2rem 0;
        }

        .slider-group { margin-bottom: 1.25rem; }
        
        .slider-label {
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        /* Custom Range Slider */
        .range-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 6px;
          background: var(--bg-tertiary);
          border-radius: 3px;
          outline: none;
        }

        .range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--text-secondary);
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .range-slider.accent-slider::-webkit-slider-thumb {
          background: var(--accent-primary);
        }

        /* Action Bar fixed at bottom */
        .action-bar {
          position: fixed;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          width: 90%;
          max-width: 800px;
          padding: 1.25rem 2rem;
          border-radius: 100px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 20;
          background: linear-gradient(180deg, rgba(255, 250, 242, 0.94) 0%, rgba(255, 240, 220, 0.96) 100%);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(180, 110, 68, 0.22);
          box-shadow: 0 18px 36px rgba(160, 101, 58, 0.16);
        }

        @media (max-width: 768px) {
          .action-bar {
            flex-direction: column;
            gap: 1rem;
            border-radius: var(--radius-lg);
            text-align: center;
          }
        }

        .action-info {
          color: var(--text-secondary);
          font-size: 0.95rem;
        }

        .btn-glow {
          box-shadow: 0 12px 26px rgba(217, 102, 52, 0.28);
        }

        /* Loading Overlay */
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
          padding: 2.5rem;
          border: 1px solid rgba(180, 110, 68, 0.28);
          box-shadow: 0 18px 40px rgba(160, 101, 58, 0.2);
        }

        .spinner {
          font-size: 3rem;
          display: inline-block;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }

        .loading-steps {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .step {
          font-size: 0.85rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .step::before {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--text-muted);
        }

        .step.active {
          color: var(--accent-primary);
        }

        .step.active::before {
          background: var(--accent-primary);
          box-shadow: 0 0 8px var(--accent-primary);
        }
      `}</style>
    </div>
  );
}
