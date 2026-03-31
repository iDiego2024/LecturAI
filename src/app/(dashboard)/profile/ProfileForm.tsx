'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  initialFullName: string;
  initialSchoolName: string;
  initialAvatarUrl: string;
  email: string;
};

export default function ProfileForm({
  initialFullName,
  initialSchoolName,
  initialAvatarUrl,
  email,
}: Props) {
  const supabase = createClient();
  const [fullName, setFullName] = useState(initialFullName);
  const [schoolName, setSchoolName] = useState(initialSchoolName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, schoolName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No fue posible guardar el perfil');
      setMessage('Perfil actualizado correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setMessage('');
    setError('');

    try {
      if (password.trim().length < 6) {
        throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (updateError) throw updateError;

      setPassword('');
      setMessage('Contraseña actualizada correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setMessage('');
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No fue posible subir la foto');

      setAvatarUrl(data.avatarUrl);
      setMessage('Foto actualizada correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="profile-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi perfil</h1>
          <p className="page-subtitle">Actualiza tu nombre, colegio, foto y seguridad de la cuenta.</p>
        </div>
      </div>

      {(message || error) && (
        <div className={`notice ${error ? 'notice-error' : 'notice-success'}`}>
          {error || message}
        </div>
      )}

      <div className="profile-grid">
        <section className="glass-panel section-card">
          <h2 className="section-title">Datos del docente</h2>
          <form onSubmit={handleProfileSave}>
            <div className="avatar-block">
              <div className="avatar-preview">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Foto de perfil" />
                ) : (
                  <span>{fullName?.charAt(0) || email.charAt(0)}</span>
                )}
              </div>
              <div>
                <label className="upload-label">
                  {uploadingAvatar ? 'Subiendo foto...' : 'Subir foto'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarUpload} hidden />
                </label>
                <p className="help-text">PNG, JPG o WEBP. Recomendado: foto cuadrada.</p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Nombre completo</label>
              <input id="fullName" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div className="form-group">
              <label htmlFor="schoolName">Colegio o establecimiento</label>
              <input id="schoolName" className="input" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
            </div>

            <div className="form-group">
              <label htmlFor="email">Correo</label>
              <input id="email" className="input" value={email} disabled />
            </div>

            <button type="submit" className="btn btn-primary" disabled={savingProfile}>
              {savingProfile ? 'Guardando...' : 'Guardar perfil'}
            </button>
          </form>
        </section>

        <section className="glass-panel section-card">
          <h2 className="section-title">Seguridad</h2>
          <form onSubmit={handlePasswordSave}>
            <div className="form-group">
              <label htmlFor="password">Nueva contraseña</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Al menos 6 caracteres"
              />
            </div>
            <button type="submit" className="btn btn-secondary" disabled={savingPassword}>
              {savingPassword ? 'Actualizando...' : 'Cambiar contraseña'}
            </button>
          </form>
        </section>
      </div>

      <style jsx>{`
        .profile-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.9fr);
          gap: 1.5rem;
        }
        .section-card {
          padding: 1.75rem;
        }
        .section-title {
          margin-bottom: 1.25rem;
          color: var(--text-primary);
          font-size: 1.2rem;
        }
        .form-group {
          margin-bottom: 1rem;
        }
        .form-group label {
          display: block;
          margin-bottom: 0.45rem;
          color: var(--text-secondary);
          font-size: 0.92rem;
          font-weight: 700;
        }
        .avatar-block {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .avatar-preview {
          width: 84px;
          height: 84px;
          border-radius: 50%;
          overflow: hidden;
          background: var(--accent-soft-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-primary);
          font-size: 1.8rem;
          font-weight: 800;
          flex-shrink: 0;
        }
        .avatar-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .upload-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: rgba(255, 250, 242, 0.85);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          cursor: pointer;
          font-weight: 700;
        }
        .help-text {
          margin-top: 0.5rem;
          color: var(--text-muted);
          font-size: 0.85rem;
        }
        .notice {
          margin-bottom: 1rem;
          padding: 0.9rem 1rem;
          border-radius: var(--radius-md);
          font-weight: 700;
        }
        .notice-success {
          background: var(--success-bg);
          color: var(--success);
        }
        .notice-error {
          background: var(--danger-bg);
          color: var(--danger);
        }
        @media (max-width: 960px) {
          .profile-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
