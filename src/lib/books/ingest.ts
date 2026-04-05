import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { extractTextFromPdf } from '@/lib/pdf/extract';
import { extractCoverFromEpub, extractTextFromEpub } from '@/lib/pdf/extractEpub';
import { normalizeText } from '@/lib/pdf/normalize';
import { chunkText } from '@/lib/pdf/chunk';
import { renderPdfCover } from '@/lib/pdf/cover';

type IngestInput = {
  userId: string;
  userEmail?: string | null;
  userMetadata?: Record<string, unknown> | null;
  title: string;
  author?: string | null;
  originalFileName: string;
  mimeType: string;
  buffer: Buffer;
  fileSizeBytes: number;
  sourceType?: 'upload' | 'external_import';
  sourceReference?: Record<string, unknown> | null;
};

export async function ingestBookFromBuffer(input: IngestInput) {
  let uploadedFilePath: string | null = null;
  let createdBookId: string | null = null;

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Ensure profile exists (accounts created only in auth.users).
    await supabase
      .from('profiles')
      .upsert(
        {
          id: input.userId,
          email: input.userEmail ?? 'unknown@lecturai.local',
          full_name: (input.userMetadata as { full_name?: string } | null)?.full_name ?? null,
          school_name: (input.userMetadata as { school_name?: string } | null)?.school_name ?? null,
          avatar_url: (input.userMetadata as { avatar_url?: string } | null)?.avatar_url ?? null,
        },
        { onConflict: 'id' }
      );

    // Upload to Supabase Storage.
    const fileExt = input.originalFileName.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf';
    const safeStamp = Date.now();
    const fileName = `${input.userId}/${safeStamp}.${fileExt}`;
    uploadedFilePath = fileName;

    const fileBlob = new Blob([new Uint8Array(input.buffer)], {
      type: input.mimeType || 'application/octet-stream',
    });

    const { error: uploadError } = await supabase.storage.from('books').upload(fileName, fileBlob, {
      contentType: input.mimeType,
    });
    if (uploadError) throw uploadError;

    // Create DB record.
    const { data: book, error: dbError } = await supabase
      .from('books')
      .insert({
        user_id: input.userId,
        title: input.title,
        author: input.author || null,
        file_path: fileName,
        file_size_bytes: input.fileSizeBytes,
        processing_status: 'extracting',
        processing_progress: 10,
        source_type: input.sourceType || 'upload',
        source_reference: input.sourceReference || null,
      })
      .select()
      .single();
    if (dbError) throw dbError;
    createdBookId = (book as any).id;

    // Extract.
    let text = '';
    let pages = 0;
    let cover: { data: Buffer; mime: string } | null = null;
    const shouldGenerateCover = !process.env.VERCEL;

    if (fileExt === 'epub') {
      const result = await extractTextFromEpub(input.buffer);
      text = result.text;
      pages = result.pages;
      if (shouldGenerateCover) {
        try {
          cover = await extractCoverFromEpub(input.buffer);
        } catch (coverError) {
          console.warn('Skipping EPUB cover generation during ingest:', coverError);
        }
      }
    } else {
      const result = await extractTextFromPdf(input.buffer);
      text = result.text;
      pages = result.pages;
      if (shouldGenerateCover) {
        try {
          cover = await renderPdfCover(input.buffer);
        } catch (coverError) {
          console.warn('Skipping PDF cover generation during ingest:', coverError);
        }
      }
    }

    if (cover) {
      const bucket = 'covers';
      const { data: bucketData } = await supabase.storage.getBucket(bucket);
      if (!bucketData) {
        await supabase.storage.createBucket(bucket, {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
        });
      }

      const ext = cover.mime.includes('png') ? 'png' : 'jpg';
      const coverPath = `${input.userId}/${createdBookId}.${ext}`;
      const { error: coverUploadError } = await supabase.storage.from(bucket).upload(
        coverPath,
        new Blob([new Uint8Array(cover.data)], {
          type: cover.mime || 'application/octet-stream',
        }),
        {
          contentType: cover.mime,
          upsert: true,
        }
      );

      if (!coverUploadError) {
        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(coverPath);
        await supabase.from('books').update({ cover_url: (publicUrlData as any).publicUrl }).eq('id', createdBookId);
      }
    }

    await supabase
      .from('books')
      .update({
        page_count: pages,
        raw_text: text.substring(0, 100000),
        processing_status: 'chunking',
        processing_progress: 20,
      })
      .eq('id', createdBookId);

    const normalizedText = normalizeText(text);
    const chunks = chunkText(normalizedText, 500, 50);

    await supabase.from('book_source_texts').upsert({
      book_id: createdBookId,
      extracted_text: text,
      normalized_text: normalizedText,
      extraction_metadata: {
        source_type: fileExt,
        pages,
        chunk_count: chunks.length,
      },
    });

    const { data: job, error: jobError } = await supabase
      .from('book_jobs')
      .insert({
        book_id: createdBookId,
        status: 'pending',
        total_chunks: chunks.length,
        processed_chunks: 0,
        failed_chunks: 0,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    const chunkJobRecords = chunks.map((chunk, index) => ({
      job_id: (job as any).id,
      chunk_index: index,
      status: 'pending',
      chunk_data: {
        content: chunk.content,
        pageNumber: chunk.pageNumber,
      },
    }));

    const batchSize = 100;
    for (let i = 0; i < chunkJobRecords.length; i += batchSize) {
      const batch = chunkJobRecords.slice(i, i + batchSize);
      const { error: chunksError } = await supabase.from('book_chunk_jobs').insert(batch);
      if (chunksError) throw chunksError;
    }

    await supabase
      .from('books')
      .update({
        processing_status: 'pending',
        processing_progress: 30,
      })
      .eq('id', createdBookId);

    return { book, job, storagePath: uploadedFilePath };
  } catch (error) {
    console.error('Ingest Error:', error);

    if (createdBookId) {
      await supabase
        .from('books')
        .update({
          processing_status: 'failed',
          processing_progress: 0,
          processing_error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', createdBookId);
    } else if (uploadedFilePath) {
      await supabase.storage.from('books').remove([uploadedFilePath]);
    }

    throw error;
  }
}

