import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get profile context
  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, school_name')
    .eq('id', user.id)
    .single();

  const profile = profileData as any;

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar glass-panel">
        <div className="sidebar-header">
          <Link href="/books" className="logo">
            <span className="logo-icon">✧</span>
            <span className="logo-text">Lectur<span className="text-accent">AI</span></span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <Link href="/books" className="nav-item">
            <span className="nav-icon">📚</span>
            Biblioteca
          </Link>
          <Link href="/tests" className="nav-item">
            <span className="nav-icon">📝</span>
            Mis Pruebas
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">
              {profile?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
            </div>
            <div className="user-info">
              <div className="user-name">{profile?.full_name || 'Profesor(a)'}</div>
              <div className="user-school">{profile?.school_name || 'Mi Colegio'}</div>
            </div>
          </div>
          
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn-logout">
              Cerrar Sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-content">
        {children}
      </main>

      <style>{`
        .dashboard-layout {
          display: flex;
          min-height: 100vh;
          background: var(--bg-primary);
        }

        .sidebar {
          width: 280px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          border-radius: 0;
          border-top: none;
          border-bottom: none;
          border-left: none;
          background: var(--bg-secondary);
        }

        .sidebar-header {
          padding: 2rem;
          border-bottom: 1px solid var(--border-light);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .logo-icon { color: var(--accent-primary); }
        .text-accent { color: var(--accent-primary); }

        .sidebar-nav {
          flex: 1;
          padding: 2rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-weight: 500;
          transition: all 0.2s;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
        }

        .nav-icon {
          font-size: 1.25rem;
          opacity: 0.8;
        }

        .sidebar-footer {
          padding: 1.5rem;
          border-top: 1px solid var(--border-light);
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--accent-gradient);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        .user-info {
          flex: 1;
          overflow: hidden;
        }

        .user-name {
          color: var(--text-primary);
          font-weight: 600;
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-school {
          color: var(--text-muted);
          font-size: 0.8rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .btn-logout {
          width: 100%;
          padding: 0.75rem;
          background: transparent;
          border: 1px solid var(--border-light);
          color: var(--text-muted);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-logout:hover {
          background: var(--danger-bg);
          color: #FCA5A5;
          border-color: rgba(239, 68, 68, 0.3);
        }

        .dashboard-content {
          flex: 1;
          padding: 3rem;
          overflow-y: auto;
          max-height: 100vh;
        }

        /* Page Headers inside dashboard */
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3rem;
        }

        .page-title {
          font-size: 2rem;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }

        .page-subtitle {
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
