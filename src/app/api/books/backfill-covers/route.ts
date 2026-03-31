import { NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { extractCoverFromEpub } from '@/lib/pdf/extractEpub';
import { renderPdfCover } from '@/lib/pdf/cover';

export async function POST() {
  try {
    const authClient = createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: books, error } = await supabase
      .from('books')
      .select('id, file_path, title')
      .eq('user_id', user.id)
      .is('cover_url', null);

    if (error) throw error;

    const bucket = 'covers';
    const { data: bucketData } = await supabase.storage.getBucket(bucket);
    if (!bucketData) {
      await supabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      });
    }

    let processed = 0;
    let failed = 0;

    for (const book of books || []) {
      try {
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from('books')
          .download(book.file_path);

        if (downloadError || !fileBlob) {
          failed += 1;
          continue;
        }

        const arrayBuffer = await fileBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const isEpub = book.file_path.toLowerCase().endsWith('.epub');

        const cover = isEpub ? await extractCoverFromEpub(buffer) : await renderPdfCover(buffer);
        if (!cover) {
          failed += 1;
          continue;
        }

        const ext = cover.mime.includes('png') ? 'png' : 'jpg';
        const coverPath = `${user.id}/${book.id}.${ext}`;
        const { error: coverUploadError } = await supabase.storage
          .from(bucket)
          .upload(
            coverPath,
            new Blob([new Uint8Array(cover.data)], {
              type: cover.mime || 'application/octet-stream',
            }),
            {
              contentType: cover.mime,
              upsert: true,
            }
          );

        if (coverUploadError) {
          failed += 1;
          continue;
        }

        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(coverPath);
        await supabase.from('books').update({ cover_url: publicUrlData.publicUrl }).eq('id', book.id);
        processed += 1;
      } catch {
        failed += 1;
      }
    }

    return NextResponse.json({ success: true, processed, failed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
