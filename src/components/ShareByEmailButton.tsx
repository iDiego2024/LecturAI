'use client';

type Props = {
  subject: string;
  body: string;
  shareUrl?: string;
  className?: string;
  label?: string;
};

export default function ShareByEmailButton({
  subject,
  body,
  shareUrl,
  className = 'btn btn-secondary',
  label = 'Enviar por correo',
}: Props) {
  const handleClick = () => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const safeRuntimeUrl = currentUrl.includes('localhost') ? '' : currentUrl;
    const finalUrl = shareUrl || safeRuntimeUrl;
    const fullBody = finalUrl ? `${body}\n\nEnlace: ${finalUrl}` : body;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
  };

  return (
    <button type="button" className={className} onClick={handleClick}>
      {label}
    </button>
  );
}
