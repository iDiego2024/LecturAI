import { NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { isDemoEmail } from '@/lib/demo';
import { ingestBookFromBuffer } from '@/lib/books/ingest';

export const maxDuration = 60; // Max allowed for Vercel Hobby/Pro on normal routes

export async function POST(request: Request) {
  try {
    const authClient = createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    if (isDemoEmail(user.email)) {
      return NextResponse.json(
        { error: 'La cuenta demo usa un libro de ejemplo ya preparado. No permite subir archivos propios.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const author = formData.get('author') as string;

    if (!file || !title) {
      return NextResponse.json({ error: 'File and title are required' }, { status: 400 });
    }

    if (file.type !== 'application/pdf' && file.type !== 'application/epub+zip' && !file.name.endsWith('.epub')) {
       return NextResponse.json({ error: 'El archivo debe ser un PDF o EPUB válido' }, { status: 400 });
    }

    // Limit to 20MB
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo es demasiado grande. El límite es de 20MB para proteger los límites de la API.' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { book, job } = await ingestBookFromBuffer({
      userId,
      userEmail: user.email,
      userMetadata: (user.user_metadata as any) || null,
      title,
      author: author || null,
      originalFileName: file.name,
      mimeType: file.type || (file.name.toLowerCase().endsWith('.epub') ? 'application/epub+zip' : 'application/pdf'),
      buffer,
      fileSizeBytes: file.size,
      sourceType: 'upload',
      sourceReference: null,
    });

    return NextResponse.json({ success: true, book, job });

  } catch (error) {
    console.error('Upload Error:', error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Unknown error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
