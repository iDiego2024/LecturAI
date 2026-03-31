export const DEMO_EMAIL = 'admin@lecturai.cl';
export const DEMO_PASSWORD = 'password123';
export const DEMO_MAX_BOOKS = 1;
export const DEMO_MAX_TESTS = 1;

export function isDemoEmail(email?: string | null) {
  return (email || '').toLowerCase() === DEMO_EMAIL;
}
