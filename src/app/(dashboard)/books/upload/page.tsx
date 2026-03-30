'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UploadBookPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  
  // Upload and processing state
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [bookId, setBookId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== 'application/pdf' && selected.type !== 'application/epub+zip' && !selected.name.endsWith('.epub')) {
        setErrorMsg('Por favor, selecciona un archivo PDF o EPUB.');
        return;
      }
      setFile(selected);
      // Auto-fill title from filename if empty
      if (!title) {
        setTitle(selected.name.replace('.pdf', '').replace('.epub', '').replace(/[-_]/g, ' '));
      }
      setErrorMsg('');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;

    setStatus('uploading');
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    if (author) formData.append('author', author);

    try {
      // 1. Upload to API
      const response = await fetch('/api/books/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Error al subir');

      setBookId(data.book.id);
      setStatus('processing');
      setProcessingStatus('Preparando análisis del libro...');
      setProgress(30);

      // El procesamiento real de chunks/consolidación se ejecuta desde
      // la vista del libro (BookProcessingClient). Redirigimos de inmediato
      // para evitar que esta pantalla quede estancada en "Iniciando...".
      router.push(`/books/${data.book.id}`);

    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  // Poll for status updates
  useEffect(() => {
    if (status !== 'processing' || !bookId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/books/${bookId}/status`);
        const data = await res.json();
        
        if (data.status === 'ready') {
          setStatus('done');
          setProgress(100);
          setProcessingStatus('¡Lectura completa! Libro almacenado.');
          clearInterval(pollInterval);
          // Auto redirect after 2s
          setTimeout(() => router.push(`/books/${bookId}`), 2000);
        } else if (data.status === 'failed') {
          setStatus('error');
          setErrorMsg(data.error || 'El procesamiento falló');
          clearInterval(pollInterval);
        } else {
          // Update progress bar
          setProgress(data.progress || 0);
          
          // Friendly status
          switch(data.status) {
            case 'extracting': setProcessingStatus('Leyendo páginas del PDF...'); break;
            case 'chunking': setProcessingStatus('Procesando fragmentos del libro...'); break;
            case 'embedding': setProcessingStatus('Creando índice semántico...'); break;
            case 'analyzing': setProcessingStatus('I.A. Analizando personajes, trama y temas...'); break;
          }
        }
      } catch (e) {
        console.error('Error polling status', e);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(pollInterval);
  }, [status, bookId, router]);

  return (
    <div className="upload-page animate-fade-in">
      <div className="page-header">
        <Link href="/books" className="back-link mb-4">← Volver a Biblioteca</Link>
        <h1 className="page-title">Nuevo Libro</h1>
        <p className="page-subtitle">Sube el PDF o EPUB de la lectura complementaria para ser analizado por la IA.</p>
      </div>

      <div className="upload-container glass-panel">
        
        {status === 'idle' || status === 'error' ? (
          <form onSubmit={handleUpload}>
            {errorMsg && <div className="error-alert">{errorMsg}</div>}
            
            <div className="form-group">
              <label>Archivo PDF o EPUB</label>
              <div 
                className={`dropzone ${file ? 'has-file' : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-icon">📄</div>
                <div className="dropzone-text">
                  {file ? file.name : 'Haz clic para seleccionar el PDF o EPUB del libro'}
                </div>
                {file && <div className="dropzone-size">{(file.size / 1024 / 1024).toFixed(2)} MB</div>}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept=".pdf,.epub,application/epub+zip" 
                style={{ display: 'none' }} 
              />
            </div>

            <div className="form-group mt-4">
              <label htmlFor="title">Título del Libro (Requerido)</label>
              <input
                id="title"
                type="text"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Ej: Crónica de una muerte anunciada"
              />
            </div>

            <div className="form-group mt-4">
              <label htmlFor="author">Autor (Opcional)</label>
              <input
                id="author"
                type="text"
                className="input"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Ej: Gabriel García Márquez"
              />
            </div>

            <div className="form-actions mt-8">
              <Link href="/books" className="btn btn-secondary">Cancelar</Link>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={!file || !title}
              >
                Subir y Analizar Libro
              </button>
            </div>
          </form>
        ) : (
          <div className="processing-state text-center">
            <div className="processing-icon mb-4">
              {status === 'done' ? '✅' : '⚙️'}
            </div>
            
            <h2 className="text-xl font-bold mb-2">
              {status === 'uploading' ? 'Subiendo archivo...' : 
               status === 'done' ? '¡Análisis Completado!' : 
               'LecturAI está procesando el libro'}
            </h2>
            
            <p className="text-muted mb-6">
              {status === 'uploading' ? 'No cierres esta ventana.' : processingStatus}
            </p>

            <div className="progress-container">
              <div 
                className="progress-bar" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            <div className="progress-value mt-2 text-sm text-secondary">
              {progress}%
            </div>

            {status === 'done' && (
              <p className="mt-8 text-secondary">Redirigiendo a los resultados...</p>
            )}
            
            {status === 'processing' && (
              <p className="mt-8 text-sm text-muted">
                Este proceso puede tomar 1-3 minutos dependiendo de la longitud del libro. 
                <br/>La IA está leyendo y comprendiendo toda la obra.
              </p>
            )}
          </div>
        )}
      </div>

      <style>{`
        .upload-container {
          max-width: 600px;
          padding: 2.5rem;
          margin-top: 2rem;
        }

        .back-link {
          color: var(--text-muted);
          text-decoration: none;
          display: inline-block;
        }

        .back-link:hover { color: white; }
        
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mt-2 { margin-top: 0.5rem; }
        .mt-4 { margin-top: 1rem; }
        .mt-8 { margin-top: 2rem; }
        .text-center { text-align: center; }
        .text-xl { font-size: 1.25rem; color: white; }
        .font-bold { font-weight: 700; }
        .text-secondary { color: var(--text-secondary); }
        .text-muted { color: var(--text-muted); }
        .text-sm { font-size: 0.85rem; }

        .error-alert {
          background: var(--danger-bg);
          color: #FCA5A5;
          padding: 1rem;
          border-radius: var(--radius-sm);
          margin-bottom: 1.5rem;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
          font-weight: 500;
          font-size: 0.95rem;
        }

        .dropzone {
          border: 2px dashed var(--border-light);
          border-radius: var(--radius-md);
          padding: 3rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: rgba(0, 0, 0, 0.2);
        }

        .dropzone:hover {
          border-color: var(--accent-primary);
          background: var(--accent-light);
        }

        .dropzone.has-file {
          border-style: solid;
          border-color: var(--success);
          background: var(--success-bg);
        }

        .dropzone-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .dropzone-text {
          color: white;
          font-weight: 500;
          font-size: 1.1rem;
        }

        .dropzone-size {
          color: var(--text-muted);
          font-size: 0.85rem;
          margin-top: 0.5rem;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
        }

        .processing-state {
          padding: 2rem 0;
        }

        .processing-icon {
          font-size: 4rem;
          display: inline-block;
          animation: ${status === 'processing' ? 'spin 4s linear infinite' : 'none'};
        }

        @keyframes spin { 100% { transform: rotate(360deg); } }

        .progress-container {
          width: 100%;
          height: 12px;
          background: var(--bg-tertiary);
          border-radius: 100px;
          overflow: hidden;
          margin: 0 auto;
          max-width: 400px;
          border: 1px solid var(--border-light);
        }

        .progress-bar {
          height: 100%;
          background: var(--accent-gradient);
          border-radius: 100px;
          transition: width 0.3s ease;
        }
      `}</style>
    </div>
  );
}
