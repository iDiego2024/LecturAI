import EPub from 'epub2';
import { convert } from 'html-to-text';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Extracts raw text from an EPUB file buffer by saving it to a temporary file
 * and parsing the chapters sequentially.
 */
export async function extractTextFromEpub(buffer: Buffer): Promise<{ text: string; pages: number }> {
  // Create a unique temporary file path for this extraction
  const tempFilePath = join(tmpdir(), `temp-epub-${Date.now()}-${Math.random().toString(36).substring(7)}.epub`);
  
  // Write the buffer to the temporary file
  await writeFile(tempFilePath, buffer);

  try {
    // Parse the EPUB (createAsync returns a Promise resolving to the EPUB instance)
    const epub = await EPub.createAsync(tempFilePath);
    let extractedText = '';

    let chapterIndex = 1;

    // EPub.flow contains the ordered spine (chapters) of the book
    for (const chapter of epub.flow) {
      if (chapter.id) {
        try {
          const chapHTML = await epub.getChapterAsync(chapter.id);
          if (chapHTML) {
            // Convert HTML chapter content to plain text
            const plainText = convert(chapHTML, {
              wordwrap: false,
              selectors: [
                { selector: 'a', options: { ignoreHref: true } },
                { selector: 'img', format: 'skip' }
              ]
            });
            extractedText += `\n\n---PAGE_${chapterIndex}---\n\n` + plainText + '\n\n';
            chapterIndex++;
          }
        } catch (chapErr) {
          console.warn(`[EPUB Parse] Failed to extract chapter ${chapter.id}:`, chapErr);
          // Continue to next chapter even if one fails
        }
      }
    }

    if (!extractedText.trim()) {
      throw new Error('No text content could be extracted from the EPUB file.');
    }

    // Rough estimation of pages for EPUB (e.g., ~250 words = 1 page)
    const wordCount = extractedText.split(/\s+/).length;
    const estimatedPages = Math.max(1, Math.ceil(wordCount / 250));

    return {
      text: extractedText,
      pages: estimatedPages
    };

  } finally {
    // Always clean up the temporary file
    await unlink(tempFilePath).catch(err => {
      console.warn(`Failed to delete temporary EPUB file at ${tempFilePath}`, err);
    });
  }
}

export async function extractCoverFromEpub(buffer: Buffer): Promise<{ data: Buffer; mime: string } | null> {
  const tempFilePath = join(tmpdir(), `temp-epub-${Date.now()}-${Math.random().toString(36).substring(7)}.epub`);
  await writeFile(tempFilePath, buffer);

  try {
    const epub = await EPub.createAsync(tempFilePath);
    const coverId = (epub as any).metadata?.cover;

    if (!coverId) return null;

    const coverData = await new Promise<Buffer | null>((resolve) => {
      const getImage = (epub as any).getImageAsync || (epub as any).getImage;
      if (!getImage) return resolve(null);
      if ((epub as any).getImageAsync) {
        (epub as any).getImageAsync(coverId)
          .then((data: Buffer) => resolve(data))
          .catch(() => resolve(null));
      } else {
        (epub as any).getImage(coverId, (err: Error, data: Buffer, mime: string) => {
          if (err) return resolve(null);
          (epub as any).__coverMime = mime;
          resolve(data);
        });
      }
    });

    if (!coverData) return null;

    const mime =
      (epub as any).__coverMime ||
      (coverId.endsWith('.png') ? 'image/png' : 'image/jpeg');

    return { data: coverData, mime };
  } finally {
    await unlink(tempFilePath).catch(() => null);
  }
}
