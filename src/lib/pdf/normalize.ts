/**
 * Normalizes extracted text from an OCR'd or messy PDF.
 * Removes unnecessary line breaks, headers/footers, and extra whitespace.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  // 1. Remove multiple blank lines
  let normalized = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // 2. Fix broken words across lines (e.g. "espa-\nñol" -> "español")
  normalized = normalized.replace(/([a-záéíóúñ])-\s*\n\s*([a-záéíóúñ])/gi, '$1$2');
  
  // 3. Keep paragraph breaks (\n\n) but consolidate single line breaks within paragraphs
  //    (This assumes proper sentences end in punctuation)
  normalized = normalized.replace(/([^.\n?!])\s*\n\s*([^A-Z\n])/g, '$1 $2');
  
  // 4. Clean up multiple spaces
  normalized = normalized.replace(/ +/g, ' ');
  
  return normalized.trim();
}
