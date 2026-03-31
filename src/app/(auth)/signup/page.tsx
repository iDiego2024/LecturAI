'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (signUpError) throw signUpError;
      
      // If user is successfully created, try inserting their profile immediately
      if (data.user) {
        try {
          await supabase.from('profiles').insert({
            id: data.user.id,
            email: email,
            full_name: fullName,
            school_name: schoolName || null
          });
        } catch (profileErr) {
          console.error('Failed to create profile record', profileErr);
          // Non-blocking, they can still log in
        }
      }

      router.push('/books');
      router.refresh();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse');
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
        <div className="auth-header text-center">
          <h1 className="auth-title">Crear Cuenta</h1>
          <p className="auth-subtitle">Empecemos juntos: crea tu cuenta y prepara evaluaciones con calma.</p>
        </div>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="auth-form">
          <div className="form-group">
            <label htmlFor="fullName">Nombre completo</label>
            <input
              id="fullName"
              type="text"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Ej: Ana Gabriela"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="schoolName">Establecimiento Educativo (Opcional)</label>
            <input
              id="schoolName"
              type="text"
              className="input"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Liceo Bicentenario..."
            />
          </div>

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
              minLength={6}
              placeholder="Al menos 6 caracteres"
            />
          </div>

          <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
            {loading ? 'Creando tu cuenta...' : 'Crear mi cuenta'}
          </button>
        </form>

        <div className="auth-footer">
          ¿Ya tienes cuenta? <Link href="/login">Entrar</Link>
        </div>
      </div>
      
      {/* Required CSS is shared with LoginPage via global.css classes theoretically, 
          but added here for component encapsulation without Tailwind */}
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
        
        .auth-container {
          width: 100%;
          max-width: 480px;
          padding: 3rem 2.5rem;
        }
        
        .mb-4 { margin-bottom: 1rem; }
        .mt-4 { margin-top: 1rem; }
        .w-full { width: 100%; }
        .text-center { text-align: center; }
        
        .auth-title { font-size: 1.75rem; color: var(--text-primary); margin-bottom: 0.5rem; }
        .auth-subtitle { color: var(--text-muted); margin-bottom: 2rem; }
        
        .auth-error {
          background: var(--danger-bg);
          color: #9f3434;
          padding: 1rem;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(239, 68, 68, 0.2);
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
        }
        
        .form-group { margin-bottom: 1.25rem; }
        .form-group label {
          display: block; margin-bottom: 0.5rem; font-size: 0.9rem;
          font-weight: 500; color: var(--text-secondary);
        }
        
        .auth-footer {
          margin-top: 2rem; text-align: center; font-size: 0.9rem; color: var(--text-muted);
        }
        .auth-footer a { color: var(--accent-primary); font-weight: 500; }
      `}</style>
    </div>
  );
}
