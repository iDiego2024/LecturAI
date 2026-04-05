import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function Navbar() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <nav className="navbar landing-navbar glass-panel">
      <div className="container nav-content">
        <Link href="/" className="logo">
          <span className="logo-icon">✧</span>
          <span className="logo-text">Comprendia</span>
        </Link>
        
        <div className="nav-links">
          <a href="#features" className="nav-link">Características</a>
          <a href="#how-it-works" className="nav-link">Cómo funciona</a>
          
          <div className="nav-actions">
            {session ? (
                <Link href="/books" className="btn btn-primary">
                Ir a mi espacio
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-secondary">
                  Ingresar
                </Link>
                <Link href="/signup" className="btn btn-primary">
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
