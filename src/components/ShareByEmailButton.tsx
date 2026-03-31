'use client';

import { useState } from 'react';

type Props = {
  subject: string;
  body: string;
  shareUrl?: string;
  className?: string;
  label?: string;
};

export default function ShareButton({
  subject,
  body,
  shareUrl,
  className = 'btn btn-secondary',
  label = 'Compartir',
}: Props) {
  const [statusLabel, setStatusLabel] = useState(label);

  const handleClick = async () => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const safeRuntimeUrl = currentUrl.includes('localhost') ? '' : currentUrl;
    const finalUrl = shareUrl || safeRuntimeUrl;
    const fullBody = finalUrl ? `${body}\n\nEnlace: ${finalUrl}` : body;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: subject,
          text: body,
          url: finalUrl || undefined,
        });
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullBody);
        setStatusLabel('Enlace copiado');
        window.setTimeout(() => setStatusLabel(label), 2000);
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
    }

    window.prompt('Copia y comparte este contenido:', fullBody);
  };

  return (
    <button type="button" className={className} onClick={handleClick}>
      {statusLabel}
    </button>
  );
}
