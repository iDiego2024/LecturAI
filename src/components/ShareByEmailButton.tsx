'use client';

type Props = {
  subject: string;
  body: string;
  className?: string;
  label?: string;
};

export default function ShareByEmailButton({
  subject,
  body,
  className = 'btn btn-secondary',
  label = 'Enviar por correo',
}: Props) {
  const handleClick = () => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const fullBody = `${body}\n\n${currentUrl}`.trim();
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
  };

  return (
    <button type="button" className={className} onClick={handleClick}>
      {label}
    </button>
  );
}
