import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getAnalysisModel, generateEmbedding } from './client';
import { BOOK_ANALYSIS_PROMPT } from './prompts';

/**
 * Analyzes the full text of a book using Gemini-2.0-flash
 * and extracts all narrative elements (characters, spaces, events, conflicts, themes)
 */
export async function analyzeBookNarrative(bookId: string, fullText: string) {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const model = getAnalysisModel();

  try {
    // 1. Update status to analyzing
    await supabase
      .from('books')
      .update({ processing_status: 'analyzing', processing_progress: 75 })
      .eq('id', bookId);

    // Make consolidation idempotent so retries don't duplicate derived data.
    await supabase.from('book_entities').delete().eq('book_id', bookId);
    await supabase.from('book_themes').delete().eq('book_id', bookId);

    // 2. Call Gemini with retry logic
    let result;
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        result = await model.generateContent([
          BOOK_ANALYSIS_PROMPT,
          `\n\nTEXTO COMPLETO DEL LIBRO:\n"""\n${fullText}\n"""`
        ]);
        break; // Success
      } catch (err: any) {
        if (err.message?.includes('429') && retries < maxRetries - 1) {
          retries++;
          const delay = Math.pow(2, retries) * 2000;
          console.warn(`[Book ${bookId}] Gemini 429 hit. Retrying in ${delay}ms... (Attempt ${retries + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw err;
        }
      }
    }

    if (!result) throw new Error('Failed to generate content after retries');
    
    const responseText = result.response.text();
    const analysis = JSON.parse(responseText.replace(/```json\n?|\n?```/g, ''));

    // 3. Save to database

    // Characters
    if (analysis.characters?.length > 0) {
      const charRecords = analysis.characters.map((c: any) => ({
        book_id: bookId,
        entity_type: 'character',
        name: c.name,
        description: c.description,
        metadata: { role: c.role, traits: c.traits },
        importance_score: c.importance_score || 5
      }));
      await supabase.from('book_entities').insert(charRecords);
    }

    // Spaces
    if (analysis.spaces?.length > 0) {
      const spaceRecords = analysis.spaces.map((s: any) => ({
        book_id: bookId,
        entity_type: 'space',
        name: s.name,
        description: s.description,
        metadata: { type: s.type },
        importance_score: s.importance_score || 5
      }));
      await supabase.from('book_entities').insert(spaceRecords);
    }

    // Events
    if (analysis.events?.length > 0) {
      const eventRecords = analysis.events.map((e: any) => ({
        book_id: bookId,
        entity_type: 'event',
        name: e.name,
        description: e.description,
        metadata: { chronological_order: e.chronological_order },
        importance_score: e.importance_score || 5
      }));
      await supabase.from('book_entities').insert(eventRecords);
    }

    // Conflicts (stored as entities type=conflict)
    if (analysis.conflicts?.length > 0) {
      const conflictRecords = analysis.conflicts.map((c: any) => ({
        book_id: bookId,
        entity_type: 'conflict',
        name: c.name,
        description: c.description,
        metadata: { type: c.type, resolution: c.resolution },
        importance_score: c.type === 'main' ? 10 : 7
      }));
      await supabase.from('book_entities').insert(conflictRecords);
    }

    // Themes (stored in book_themes table)
    if (analysis.themes?.length > 0) {
      const themeRecords = analysis.themes.map((t: any) => ({
        book_id: bookId,
        theme_name: t.theme_name,
        description: t.description
      }));
      await supabase.from('book_themes').insert(themeRecords);
    }

    // 4. Update book summary
    if (analysis.summary) {
      await supabase
        .from('books')
        .update({ summary: analysis.summary })
        .eq('id', bookId);
    }

    return true;
  } catch (error) {
    console.error('Error analyzing book narrative:', error);
    await supabase
      .from('books')
      .update({ 
        processing_status: 'failed', 
        processing_error: error instanceof Error ? error.message : 'Unknown error during analysis' 
      })
      .eq('id', bookId);
    
    return false;
  }
}
