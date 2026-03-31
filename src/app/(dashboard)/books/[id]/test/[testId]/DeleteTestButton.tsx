'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteTestButton({ testId, testTitle, bookId }: { testId: string, testTitle: string, bookId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la prueba "${testTitle}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tests/${testId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Error al eliminar');
      }

      router.push(`/books/${bookId}`);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert('Hubo un error al eliminar la prueba. Intenta nuevamente.');
      setIsDeleting(false);
    }
  };

  return (
    <button 
      onClick={handleDelete} 
      disabled={isDeleting}
      className={`btn ${isDeleting ? 'deleting' : ''}`}
      style={{
        backgroundColor: 'rgba(193, 63, 63, 0.12)',
        color: 'var(--danger)',
        border: '1px solid rgba(193, 63, 63, 0.28)'
      }}
      title="Eliminar prueba"
    >
      <span className="mr-2">🗑️</span> {isDeleting ? 'Eliminando...' : 'Eliminar Prueba'}
    </button>
  );
}
