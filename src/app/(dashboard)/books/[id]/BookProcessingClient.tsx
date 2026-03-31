'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  bookId: string;
  initialStatus: string;
  initialProgress: number;
}

export default function BookProcessingClient({ bookId, initialStatus, initialProgress }: Props) {
  const router = useRouter();
  
  const [status, setStatus] = useState<string>(initialStatus);
  const [progress, setProgress] = useState<number>(initialProgress);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [currentAction, setCurrentAction] = useState<string>('Iniciando procesamiento...');
  
  const processingRef = useRef(false);

  useEffect(() => {
    // Only start automatically if not already failed or paused
    if (!isPaused && status !== 'failed') {
      startProcessing();
    }
  }, []);

  const startProcessing = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsPaused(false);
    setErrorMsg(null);
    processNextBatch();
  };

  const processNextBatch = async () => {
    if (!processingRef.current) return; // allows pausing
    
    try {
      const res = await fetch(`/api/books/${bookId}/process-chunks`, {
        method: 'POST'
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Error desconocido');
      }

      if (data.nextAction === 'consolidate') {
        setStatus('consolidating');
        setCurrentAction('Consolidando personajes y conflicto...');
        setProgress(80);
        await runConsolidation();
      } else if (data.nextAction === 'process-chunks') {
        setStatus('chunking');
        setCurrentAction(`Analizando chunk ${data.totalProcessed} de ${data.totalChunks}...`);
        setProgress(data.progress);
        
        // Loop recursively to process next batch
        if (processingRef.current) {
          processNextBatch();
        }
      } else if (data.success && data.message === 'Job already past chunk processing') {
         // Might be already consolidating or complete
         setStatus('consolidating');
         setCurrentAction('Consolidando análisis...');
         await runConsolidation();
      }

    } catch (err: any) {
      console.error(err);
      setStatus('failed');
      setIsPaused(true);
      setErrorMsg(err.message || 'Error al procesar chunks');
      processingRef.current = false;
    }
  };

  const runConsolidation = async () => {
    try {
      const res = await fetch(`/api/books/${bookId}/consolidate`, {
        method: 'POST'
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Error al consolidar');
      }

      if (data.success && data.nextAction === 'done') {
        setStatus('ready');
        setProgress(100);
        setCurrentAction('Análisis final listo 🎉');
        
        // Refresh page to show the book details
        setTimeout(() => {
          router.refresh();
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      setStatus('failed');
      setIsPaused(true);
      setErrorMsg(err.message || 'Error en consolidación');
      processingRef.current = false;
    }
  };

  const handlePause = () => {
    processingRef.current = false;
    setIsPaused(true);
    setStatus('paused');
    setCurrentAction('Procesamiento pausado.');
  };

  const handleResume = () => {
    startProcessing();
  };

  let displayStatus = 'Procesando...';
  if (status === 'failed') displayStatus = 'Error detectado';
  if (status === 'paused') displayStatus = 'Pausado';
  if (status === 'consolidating') displayStatus = 'Consolidando';
  if (status === 'extracting') displayStatus = 'Extrayendo texto';

  return (
    <div className="processing-container glass-panel p-8 text-center mt-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Procesando Libro</h2>
      <p className="text-secondary mb-6">{displayStatus}</p>
      
      <div className="progress-wrapper mb-4">
        <div className="progress-bar-bg">
          <div 
            className="progress-bar-fill transition-all duration-300" 
            style={{ width: `${Math.max(5, progress)}%` }}
          ></div>
        </div>
        <div className="flex justify-between mt-2 text-sm text-muted">
          <span>{currentAction}</span>
          <span>{progress}%</span>
        </div>
      </div>

      {errorMsg && (
         <div className="error-box p-4 rounded-md mb-6 text-sm">
           <strong>Error:</strong> {errorMsg}
           <p className="mt-1 text-xs opacity-70">Es posible que hayamos alcanzado los límites de la API de Gemini. Pausa un momento y reanuda.</p>
         </div>
      )}

      <div className="flex justify-center gap-4 mt-6">
        {isPaused || status === 'failed' ? (
          <button onClick={handleResume} className="btn btn-primary">
            ▶ Reanudar Análisis
          </button>
        ) : (
          <button onClick={handlePause} className="btn btn-secondary">
            ⏸ Pausar
          </button>
        )}
      </div>

      <style jsx>{`
        .processing-container {
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
        }
        .progress-bar-bg {
          width: 100%;
          height: 12px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
          border-radius: 999px;
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
        }
        .text-muted { color: var(--text-muted); }
        .text-secondary { color: var(--text-secondary); }
        .error-box {
          background: var(--danger-bg);
          color: #8f3030;
          border: 1px solid rgba(193, 63, 63, 0.28);
        }
      `}</style>
    </div>
  );
}
