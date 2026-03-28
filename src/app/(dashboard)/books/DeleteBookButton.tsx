'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteBookButton({ bookId, bookTitle }: { bookId: string, bookTitle: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent triggering the Link wrapper

    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el libro "${bookTitle}"? Se perderán todas las evaluaciones generadas.`)) {
      return;
    }

    setIsDeleting(true);
    
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        throw new Error('Error al eliminar');
      }
      
      router.refresh(); // Refresh the server component to list updated books
    } catch (error) {
      console.error(error);
      alert('Hubo un error al eliminar el libro. Intenta nuevamente.');
      setIsDeleting(false);
    }
  };

  return (
    <button 
      onClick={handleDelete} 
      disabled={isDeleting}
      className={`delete-btn ${isDeleting ? 'deleting' : ''}`}
      title="Eliminar libro"
      aria-label="Eliminar libro"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    </button>
  );
}
