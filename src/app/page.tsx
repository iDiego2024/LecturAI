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
          <div className="badge">✧ Para Docentes Extraordinarios</div>
          
          <h1 className="hero-title">
            Evaluaciones de lectura que realmente miden <span className="text-gradient font-serif">comprensión profunda</span>
          </h1>
          
          <p className="hero-description">
            LecturAI lee el libro completo, extrae el hilo narrativo y genera pruebas pedagógicamente perfectas en segundos. Desde preguntas literales hasta inferenciales y de desarrollo.
          </p>
          
          <div className="hero-actions">
            <Link href="/signup" className="btn btn-primary btn-lg">
              Comenzar Gratis
            </Link>
          </div>
          
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-val">100%</span>
              <span className="stat-label">Libro Leído</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat">
              <span className="stat-val">3</span>
              <span className="stat-label">Niveles Cognitivos</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat">
              <span className="stat-val">1</span>
              <span className="stat-label">Clic para Word</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <h2 className="section-title text-center">Diseñado con rigor pedagógico</h2>
          <p className="section-subtitle text-center">No es un simple resumen. Es una herramienta de evaluación profesional.</p>
          
          <div className="features-grid">
            <div className="feature-card glass-panel">
              <div className="feature-icon">📚</div>
              <h3 className="feature-title">Análisis Narrativo Completo</h3>
              <p className="feature-desc">Procesamos el PDF completo identificando personajes, espacios, acontecimientos y el conflicto central de la obra.</p>
            </div>
            
            <div className="feature-card glass-panel">
              <div className="feature-icon">🧠</div>
              <h3 className="feature-title">Niveles de Comprensión</h3>
              <p className="feature-desc">Preguntas balanceadas entre localizar información explícita, interpretar el texto y reflexionar sobre la obra.</p>
            </div>
            
            <div className="feature-card glass-panel">
              <div className="feature-icon">🎯</div>
              <h3 className="feature-title">Cero Alucinaciones</h3>
              <p className="feature-desc">Cada pregunta es generada estrictamente desde fragmentos recuperados del libro, garantizando fidelidad total al autor.</p>
            </div>
            
            <div className="feature-card glass-panel">
              <div className="feature-icon">📝</div>
              <h3 className="feature-title">Pautas de Corrección</h3>
              <p className="feature-desc">Genera automáticamente la versión del estudiante y la versión del docente con las respuestas correctas y rúbricas.</p>
            </div>
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
          padding-top: 4.5rem;
        }
        
        .hero-bg-glow {
          position: absolute;
          top: -10%;
          left: 50%;
          transform: translateX(-50%);
          width: 800px;
          height: 800px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(10, 10, 11, 0) 70%);
          z-index: -1;
          pointer-events: none;
        }
        
        .hero-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          max-width: 800px;
          margin: 0 auto;
        }
        
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 0.5rem 1rem;
          background: var(--accent-light);
          color: #818CF8;
          border-radius: 100px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 2rem;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }
        
        .hero-title {
          font-size: clamp(2.5rem, 5vw, 4rem);
          margin-bottom: 1.5rem;
          color: white;
        }
        
        .text-gradient {
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          display: inline-block;
        }
        
        .hero-description {
          font-size: 1.15rem;
          color: var(--text-secondary);
          max-width: 600px;
          margin-bottom: 2.5rem;
          line-height: 1.7;
        }
        
        .hero-actions {
          display: flex;
          gap: 1rem;
          margin-bottom: 4rem;
        }
        
        .btn-lg {
          padding: 1rem 2rem;
          font-size: 1.1rem;
        }
        
        .hero-stats {
          display: flex;
          align-items: center;
          gap: 2rem;
          padding: 1.5rem 3rem;
          background: rgba(28, 28, 31, 0.4);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-xl);
        }
        
        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .stat-val {
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
        }
        
        .stat-label {
          font-size: 0.85rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .stat-divider {
          width: 1px;
          height: 40px;
          background: var(--border-light);
        }

        /* Features */
        .features-section {
          padding: 8rem 0;
          background: var(--bg-secondary);
          position: relative;
        }
        
        .text-center {
          text-align: center;
        }
        
        .section-title {
          font-size: 2.5rem;
          color: white;
          margin-bottom: 1rem;
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
          gap: 2rem;
        }
        
        .feature-card {
          padding: 2rem;
          transition: transform 0.3s ease, border-color 0.3s ease;
        }
        
        .feature-card:hover {
          transform: translateY(-5px);
          border-color: var(--border-focus);
        }
        
        .feature-icon {
          font-size: 2.5rem;
          margin-bottom: 1.5rem;
          background: var(--bg-tertiary);
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-light);
        }
        
        .feature-title {
          font-size: 1.25rem;
          color: white;
          margin-bottom: 1rem;
        }
        
        .feature-desc {
          color: var(--text-secondary);
          line-height: 1.6;
          font-size: 0.95rem;
        }
        
        @media (max-width: 768px) {
          .nav-links { display: none; }
          .hero-actions { flex-direction: column; width: 100%; }
          .hero-stats { flex-direction: column; gap: 1rem; padding: 1.5rem; }
          .stat-divider { width: 100%; height: 1px; }
        }
      `}</style>
    </main>
  );
}
