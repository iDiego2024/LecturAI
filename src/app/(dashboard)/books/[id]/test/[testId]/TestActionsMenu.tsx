'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ShareButton from '@/components/ShareByEmailButton';

type Props = {
  testId: string;
  bookId: string;
  testTitle: string;
  bookTitle: string;
  appUrl: string;
  isDemo: boolean;
  editModeActive?: boolean;
};

export default function TestActionsMenu({
  testId,
  bookId,
  testTitle,
  bookTitle,
  appUrl,
  isDemo,
  editModeActive = false,
}: Props) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [creatingVariant, setCreatingVariant] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleCreateVariant = async () => {
    setCreatingVariant(true);
    try {
      const res = await fetch(`/api/tests/${testId}/variant`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la variante.');
      router.push(`/books/${bookId}/test/${data.testId}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo crear la variante.');
    } finally {
      setCreatingVariant(false);
      setOpen(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(`¿Estas seguro de que deseas eliminar permanentemente la prueba "${testTitle}"?`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/tests/${testId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Error al eliminar');
      router.push(`/books/${bookId}`);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert('Hubo un error al eliminar la prueba. Intenta nuevamente.');
      setDeleting(false);
    } finally {
      setOpen(false);
    }
  };

  return (
    <div className="actions-shell" ref={menuRef}>
      <button
        type="button"
        className={`actions-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="trigger-text">Opciones</span>
        {editModeActive && <span className="edit-badge">Edicion activa</span>}
        <span className="trigger-icon">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="actions-card">
          <div className="actions-group">
            <p className="group-title">Gestion docente</p>
            <a
              href={editModeActive ? `/books/${bookId}/test/${testId}` : `/books/${bookId}/test/${testId}?mode=edit`}
              className="menu-link primary-link"
              onClick={() => setOpen(false)}
            >
              {editModeActive ? 'Cerrar modo edicion' : 'Editar evaluacion'}
            </a>
            <button type="button" className="menu-link" onClick={handleCreateVariant} disabled={creatingVariant}>
              {creatingVariant ? 'Creando variante...' : 'Crear variante A/B'}
            </button>
          </div>

          <div className="actions-group">
            <p className="group-title">Compartir y exportar</p>
            <ShareButton
              subject={`Evaluacion: ${testTitle}`}
              body={`Te comparto la evaluacion "${testTitle}" del libro ${bookTitle}.`}
              shareUrl={`${appUrl}/books/${bookId}/test/${testId}`}
              className="menu-link"
              label="Compartir evaluacion"
            />
            {!isDemo && (
              <>
                <a
                  href={`/api/tests/${testId}/export?version=student`}
                  className="menu-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                >
                  Exportar Word alumno
                </a>
                <a
                  href={`/api/tests/${testId}/export?version=teacher`}
                  className="menu-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                >
                  Exportar Word docente
                </a>
              </>
            )}
          </div>

          <div className="actions-group danger-group">
            <p className="group-title">Acciones delicadas</p>
            <button type="button" className="menu-link danger-link" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar prueba'}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .actions-shell {
          position: relative;
          width: min(100%, 20rem);
        }
        .actions-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.95rem 1rem;
          border-radius: 1rem;
          border: 1px solid rgba(82, 52, 26, 0.16);
          background: linear-gradient(135deg, rgba(255, 252, 247, 0.98) 0%, rgba(255, 241, 224, 0.96) 100%);
          color: var(--text-primary);
          cursor: pointer;
          box-shadow: 0 14px 34px rgba(82, 52, 26, 0.1);
        }
        .actions-trigger.is-open {
          border-color: rgba(217, 102, 52, 0.35);
          box-shadow: 0 18px 38px rgba(217, 102, 52, 0.16);
        }
        .trigger-text {
          font-weight: 800;
          font-size: 0.98rem;
        }
        .edit-badge {
          margin-left: auto;
          padding: 0.28rem 0.55rem;
          border-radius: 999px;
          background: rgba(217, 102, 52, 0.16);
          color: #a44f27;
          font-size: 0.75rem;
          font-weight: 800;
        }
        .trigger-icon {
          font-size: 1.2rem;
          line-height: 1;
          color: var(--text-secondary);
        }
        .actions-card {
          position: absolute;
          top: calc(100% + 0.65rem);
          right: 0;
          width: min(26rem, calc(100vw - 2rem));
          padding: 0.8rem;
          border-radius: 1.2rem;
          border: 1px solid rgba(82, 52, 26, 0.14);
          background: rgba(255, 252, 248, 0.98);
          box-shadow: 0 22px 56px rgba(66, 36, 12, 0.14);
          backdrop-filter: blur(18px);
          z-index: 30;
        }
        .actions-group + .actions-group {
          margin-top: 0.8rem;
          padding-top: 0.8rem;
          border-top: 1px solid rgba(82, 52, 26, 0.1);
        }
        .group-title {
          margin: 0 0 0.55rem;
          font-size: 0.74rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 800;
        }
        :global(.menu-link) {
          appearance: none;
          -webkit-appearance: none;
          font: inherit;
          line-height: 1.2;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-sizing: border-box;
          min-height: 60px;
          padding: 0.95rem 1rem;
          border-radius: 1rem;
          border: 1px solid rgba(82, 52, 26, 0.08);
          background: rgba(255, 255, 255, 0.78);
          color: var(--text-primary);
          text-decoration: none;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
          margin-bottom: 0.55rem;
          text-align: left;
        }
        :global(.menu-link:last-child) {
          margin-bottom: 0;
        }
        :global(.menu-link:hover) {
          transform: translateY(-1px);
          border-color: rgba(217, 102, 52, 0.18);
          background: rgba(255, 247, 240, 0.96);
        }
        .primary-link {
          background: linear-gradient(135deg, rgba(217, 102, 52, 0.12) 0%, rgba(255, 237, 220, 0.95) 100%);
          border-color: rgba(217, 102, 52, 0.18);
        }
        .danger-link {
          color: #a13e33;
          border-color: rgba(193, 63, 63, 0.16);
          background: rgba(255, 242, 242, 0.88);
        }
        @media (max-width: 768px) {
          .actions-shell {
            width: 100%;
          }
          .actions-card {
            left: 0;
            right: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
