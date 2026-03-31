'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1') {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      router.push('/books');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });

      if (error) throw error;

      router.push('/books');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible entrar al demo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <Link href="/" className="back-link">
        ← Volver al inicio
      </Link>
      
      <div className="auth-container glass-panel animate-fade-in">
        <div className="auth-header">
          <div className="logo-icon text-center mb-4">✧</div>
          <h1 className="auth-title">Bienvenido de vuelta</h1>
          <p className="auth-subtitle">Qué bueno verte de nuevo. Continuemos preparando tus evaluaciones.</p>
        </div>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@colegio.edu"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
          <button type="button" className="btn btn-secondary w-full mt-4" disabled={loading} onClick={handleDemoLogin}>
            {loading ? 'Preparando demo...' : 'Ver demo'}
          </button>
        </form>

        <div className="auth-footer">
          ¿Aun no tienes cuenta? <Link href="/signup">Crear ahora</Link>
        </div>
      </div>
      
      <style>{`
        .auth-layout {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: radial-gradient(circle at center, #ffe8cf 0%, var(--bg-primary) 70%);
        }
        
        .back-link {
          position: fixed;
          top: 2rem;
          left: 2rem;
          color: var(--text-muted);
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .back-link:hover {
          color: var(--text-primary);
        }
        
        .auth-container {
          width: 100%;
          max-width: 440px;
          padding: 3rem 2.5rem;
        }
        
        .logo-icon {
          color: var(--accent-primary);
          font-size: 2rem;
        }
        
        .mb-4 { margin-bottom: 1rem; }
        .mt-4 { margin-top: 1rem; }
        .w-full { width: 100%; }
        .text-center { text-align: center; }
        
        .auth-title {
          font-size: 1.75rem;
          color: var(--text-primary);
          text-align: center;
          margin-bottom: 0.5rem;
        }
        
        .auth-subtitle {
          color: var(--text-muted);
          text-align: center;
          margin-bottom: 2rem;
        }
        
        .auth-error {
          background: var(--danger-bg);
          color: #9f3434;
          padding: 1rem;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(239, 68, 68, 0.2);
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
        }
        
        .form-group {
          margin-bottom: 1.5rem;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-secondary);
        }
        
        .auth-footer {
          margin-top: 2rem;
          text-align: center;
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        
        .auth-footer a {
          color: var(--accent-primary);
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
