'use client';

type Props = {
  className?: string;
  label?: string;
};

export default function PrintPdfButton({
  className = 'btn btn-secondary',
  label = 'Guardar como PDF',
}: Props) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {label}
    </button>
  );
}
