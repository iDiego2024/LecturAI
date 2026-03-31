export const DEMO_EMAIL = 'admin@lecturai.cl';
export const DEMO_PASSWORD = 'password123';
export const DEMO_MAX_BOOKS = 1;
export const DEMO_MAX_TESTS = 1;
export const DEMO_BOOK_FILE = 'El_fantasma_de_Canterville-Wilde_Oscar.epub';
export const DEMO_BOOK_TITLE = 'El fantasma de Canterville';
export const DEMO_BOOK_AUTHOR = 'Oscar Wilde';

export function isDemoEmail(email?: string | null) {
  return (email || '').toLowerCase() === DEMO_EMAIL;
}
