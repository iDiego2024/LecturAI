import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function Navbar() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <nav className="navbar glass-panel">
      <div className="container nav-content">
        <Link href="/" className="logo">
          <span className="logo-icon">✧</span>
          <span className="logo-text">Lectur<span className="text-accent">AI</span></span>
        </Link>
        
        <div className="nav-links">
          <a href="#features" className="nav-link">Características</a>
          <a href="#how-it-works" className="nav-link">Cómo funciona</a>
          
          <div className="nav-actions">
            {session ? (
              <Link href="/books" className="btn btn-primary">
                Ir al Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-secondary">
                  Iniciar Sesión
                </Link>
                <Link href="/signup" className="btn btn-primary">
                  Crear Cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      
      <style>{`
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          border-radius: 0;
          border-top: none;
          border-left: none;
          border-right: none;
          background: rgba(10, 10, 11, 0.8);
        }
        
        .nav-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 4.5rem;
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        
        .logo-icon {
          color: var(--accent-primary);
        }
        
        .text-accent {
          color: var(--accent-primary);
        }
        
        .nav-links {
          display: flex;
          align-items: center;
          gap: 2rem;
        }
        
        .nav-link {
          color: var(--text-secondary);
          font-size: 0.95rem;
          font-weight: 500;
        }
        
        .nav-link:hover {
          color: var(--text-primary);
        }
        
        .nav-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-left: 1rem;
        }
      `}</style>
    </nav>
  );
}
