import Navbar from '@/components/landing/Navbar';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="landing-page">
      <Navbar />
      
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-bg-glow"></div>
        <div className="container hero-content animate-fade-in">
          <div className="badge">🍎 Hecho para profes que enseñan con corazón</div>
          
          <h1 className="hero-title">
            Evaluaciones de lectura con una mirada <span className="text-gradient font-serif">cercana, cálida y pedagógica</span>
          </h1>
          
          <p className="hero-description">
            LecturAI lee el libro completo contigo, detecta personajes y conflictos clave, y transforma todo en evaluaciones claras para tus estudiantes. Menos carga administrativa, más tiempo para enseñar.
          </p>
          
          <div className="hero-actions">
            <Link href="/signup" className="btn btn-primary btn-lg">
              Crear mi primera evaluación
            </Link>
            <a href="#features" className="btn btn-secondary btn-lg">
              Ver cómo se siente
            </a>
          </div>

          <div className="hero-note glass-panel">
            <span className="hero-note-icon">✦</span>
            <p>Diseñado para contextos escolares reales: lenguaje claro, decisiones visibles y una experiencia más amable para docentes.</p>
          </div>
          
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-val">100%</span>
              <span className="stat-label">Lectura Completa</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat">
              <span className="stat-val">3</span>
              <span className="stat-label">Habilidades Lectoras</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat">
              <span className="stat-val">1</span>
              <span className="stat-label">Exportación Lista</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <h2 className="section-title text-center">Diseñado para aula real</h2>
          <p className="section-subtitle text-center">Una experiencia educativa accesible, clara y útil para tu día a día.</p>
          
          <div className="features-grid">
            <div className="feature-card glass-panel">
              <div className="feature-icon">📚</div>
              <h3 className="feature-title">Análisis Narrativo Completo</h3>
              <p className="feature-desc">Leemos la obra completa e identificamos personajes, espacios y conflictos con foco escolar.</p>
            </div>
            
            <div className="feature-card glass-panel">
              <div className="feature-icon">🧠</div>
              <h3 className="feature-title">Niveles de Comprensión</h3>
              <p className="feature-desc">Genera preguntas para localizar, interpretar y reflexionar, en equilibrio pedagógico.</p>
            </div>
            
            <div className="feature-card glass-panel">
              <div className="feature-icon">🎯</div>
              <h3 className="feature-title">Cero Alucinaciones</h3>
              <p className="feature-desc">Cada pregunta se construye desde fragmentos del libro, con trazabilidad y lenguaje claro.</p>
            </div>
            
            <div className="feature-card glass-panel">
              <div className="feature-icon">📝</div>
              <h3 className="feature-title">Pautas de Corrección</h3>
              <p className="feature-desc">Obtén versión estudiante y docente con respuestas y pauta para corregir con confianza.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="how-it-works">
        <div className="container">
          <h2 className="section-title text-center">Cómo funciona</h2>
          <div className="steps-grid">
            <article className="step-card glass-panel">
              <div className="step-icon">1️⃣</div>
              <h3>Sube tu lectura</h3>
              <p>Arrastra PDF o EPUB y completa datos básicos del libro.</p>
            </article>
            <article className="step-card glass-panel">
              <div className="step-icon">2️⃣</div>
              <h3>La IA analiza por ti</h3>
              <p>Extrae lo importante de la obra para entenderla antes de evaluar.</p>
            </article>
            <article className="step-card glass-panel">
              <div className="step-icon">3️⃣</div>
              <h3>Genera y exporta</h3>
              <p>Define nivel, tipos de pregunta y descarga Word listo para clase.</p>
            </article>
          </div>
        </div>
      </section>

      <style>{`
        .landing-page {
          overflow-x: hidden;
        }
        
        .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          padding: 7.5rem 0 4rem;
        }
        
        .hero-bg-glow {
          position: absolute;
          top: -4%;
          left: 50%;
          transform: translateX(-50%);
          width: 980px;
          height: 980px;
          background:
            radial-gradient(circle, rgba(242, 165, 69, 0.26) 0%, rgba(255, 248, 240, 0) 55%),
            radial-gradient(circle at 50% 60%, rgba(217, 102, 52, 0.14) 0%, rgba(255, 248, 240, 0) 62%);
          z-index: -1;
          pointer-events: none;
          filter: blur(6px);
        }
        
        .hero-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          max-width: 920px;
          margin: 0 auto;
        }
        
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.6rem 1.15rem;
          background: rgba(255, 244, 232, 0.84);
          color: #8c4f2a;
          border-radius: 100px;
          font-size: 0.92rem;
          font-weight: 700;
          margin-bottom: 1.8rem;
          border: 1px solid rgba(225, 109, 61, 0.28);
          box-shadow: 0 10px 22px rgba(170, 102, 57, 0.1);
        }
        
        .hero-title {
          font-size: clamp(2.2rem, 4.6vw, 4.1rem);
          line-height: 1.05;
          max-width: 980px;
          margin-bottom: 1.35rem;
          color: var(--text-primary);
          letter-spacing: -0.045em;
        }
        
        .text-gradient {
          background: linear-gradient(135deg, #b75226 0%, #e58a37 45%, #f0ad53 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          display: inline-block;
        }
        
        .hero-description {
          font-size: 1.1rem;
          color: var(--text-secondary);
          max-width: 760px;
          margin-bottom: 2rem;
          line-height: 1.78;
        }
        
        .hero-actions {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .btn-lg {
          padding: 1rem 1.9rem;
          font-size: 1.02rem;
        }

        .hero-note {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          max-width: 700px;
          padding: 1rem 1.2rem;
          margin-bottom: 3.2rem;
          background: linear-gradient(180deg, rgba(255, 253, 248, 0.94) 0%, rgba(255, 245, 231, 0.96) 100%);
        }

        .hero-note-icon {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-soft-gradient);
          color: var(--accent-primary);
          font-size: 1rem;
          flex-shrink: 0;
        }

        .hero-note p {
          text-align: left;
          color: var(--text-secondary);
          font-size: 0.98rem;
        }
        
        .hero-stats {
          display: flex;
          align-items: center;
          gap: 2rem;
          padding: 1.6rem 2rem;
          width: min(760px, 100%);
          background: linear-gradient(180deg, rgba(255, 251, 245, 0.82) 0%, rgba(255, 242, 224, 0.9) 100%);
          border: 1px solid rgba(144, 100, 68, 0.16);
          border-radius: var(--radius-xl);
          box-shadow: 0 18px 40px rgba(166, 102, 60, 0.08);
        }
        
        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
        }
        
        .stat-val {
          font-size: 2rem;
          font-weight: 800;
          color: var(--text-primary);
        }
        
        .stat-label {
          font-size: 0.82rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        
        .stat-divider {
          width: 1px;
          height: 40px;
          background: var(--border-light);
        }

        /* Features */
        .features-section {
          padding: 7rem 0 3rem;
          background: transparent;
          position: relative;
        }
        
        .text-center {
          text-align: center;
        }
        
        .section-title {
          font-size: clamp(2.2rem, 4vw, 3.2rem);
          color: var(--text-primary);
          margin-bottom: 1rem;
          letter-spacing: -0.03em;
        }
        
        .section-subtitle {
          color: var(--text-secondary);
          font-size: 1.1rem;
          margin-bottom: 4rem;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
        }
        
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.4rem;
        }
        
        .feature-card {
          padding: 2rem;
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        
        .feature-card:hover {
          transform: translateY(-6px);
          border-color: var(--border-focus);
          box-shadow: 0 18px 30px rgba(160, 101, 58, 0.14);
        }
        
        .feature-icon {
          font-size: 2rem;
          margin-bottom: 1.5rem;
          background: var(--accent-soft-gradient);
          width: 72px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          border: 1px solid var(--border-light);
        }
        
        .feature-title {
          font-size: 1.25rem;
          color: var(--text-primary);
          margin-bottom: 0.75rem;
        }
        
        .feature-desc {
          color: var(--text-secondary);
          line-height: 1.68;
          font-size: 0.98rem;
        }

        .how-it-works {
          padding: 2rem 0 7rem;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.4rem;
        }

        .step-card {
          padding: 1.7rem;
        }

        .step-icon {
          font-size: 1.8rem;
          margin-bottom: 0.8rem;
        }

        .step-card h3 {
          color: var(--text-primary);
          margin-bottom: 0.45rem;
          font-size: 1.2rem;
        }

        .step-card p {
          color: var(--text-secondary);
          line-height: 1.65;
        }
        
        @media (max-width: 768px) {
          .nav-links { display: none; }
          .hero {
            padding-top: 6.5rem;
          }
          .hero-actions { flex-direction: column; width: 100%; }
          .hero-actions .btn {
            width: 100%;
          }
          .hero-note {
            flex-direction: column;
            align-items: flex-start;
          }
          .hero-stats { flex-direction: column; gap: 1rem; padding: 1.5rem; }
          .stat-divider { width: 100%; height: 1px; }
        }
      `}</style>
    </main>
  );
}
