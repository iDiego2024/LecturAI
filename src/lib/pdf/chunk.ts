export interface TextChunk {
  content: string;
  pageNumber: number;
  chunkIndex: number;
}

/**
 * Splits text into semantic chunks of approx MAX_TOKENS size,
 * trying to break at paragraph or sentence boundaries.
 * Preserves page numbers using the injected markers.
 */
export function chunkText(
  text: string, 
  maxTokens: number = 500, 
  overlapTokens: number = 50
): TextChunk[] {
  // 1 token ~= 4 chars roughly
  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;
  
  const chunks: TextChunk[] = [];
  
  // Split by page markers first to track page numbers
  const pageSections = text.split(/---PAGE_(\d+)---/);
  
  let currentChunk = '';
  let currentChunkIndex = 0;
  
  // pageSections has format: ["text before", "1", "page 1 text", "2", "page 2 text"...]
  // Because the first element could be before page 1, handle it
  
  for (let i = 1; i < pageSections.length; i += 2) {
    const pageNumStr = pageSections[i];
    const pageText = pageSections[i + 1];
    
    if (!pageNumStr || !pageText) continue;
    
    const pageNum = parseInt(pageNumStr, 10);
    
    // Split page into paragraphs
    const paragraphs = pageText.split('\n\n');
    
    for (const p of paragraphs) {
      const paragraph = p.trim();
      if (!paragraph) continue;
      
      // If adding this paragraph exceeds limit (and we already have substance)
      if (currentChunk.length + paragraph.length > maxChars && currentChunk.length > maxChars / 2) {
        chunks.push({
          content: currentChunk.trim(),
          pageNumber: pageNum,
          chunkIndex: currentChunkIndex++
        });
        
        // Start new chunk with overlap (take end of current chunk)
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(overlapTokens));
        currentChunk = overlapWords.join(' ') + '\n\n' + paragraph + '\n\n';
      } else {
        currentChunk += paragraph + '\n\n';
      }
      
      // If a single paragraph is HUGE (longer than maxChars)
      if (currentChunk.length > maxChars * 1.5) {
        // Force split by sentences
        const sentences = currentChunk.match(/[^.!?]+[.!?]+/g) || [currentChunk];
        currentChunk = '';
        
        for (const s of sentences) {
          if (currentChunk.length + s.length > maxChars) {
            chunks.push({
              content: currentChunk.trim(),
              pageNumber: pageNum,
              chunkIndex: currentChunkIndex++
            });
            currentChunk = s;
          } else {
            currentChunk += s + ' ';
          }
        }
      }
    }
  }
  
  // Push the final chunk if not empty
  if (currentChunk.trim()) {
    // Assuming the last page number parsed
    const lastPageNumStr = pageSections.length > 2 ? pageSections[pageSections.length - 2] : "1";
    chunks.push({
      content: currentChunk.trim(),
      pageNumber: parseInt(lastPageNumStr, 10),
      chunkIndex: currentChunkIndex
    });
  }
  
  return chunks;
}
