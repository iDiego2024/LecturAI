import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getAnalysisModel } from './client';
import { BOOK_ANALYSIS_PROMPT } from './prompts';

function parseJsonResponse(responseText: string) {
  return JSON.parse(responseText.replace(/```json\n?|\n?```/g, '').trim());
}

function buildDetailedSummary(
  summary: string | undefined,
  chapters: Array<{
    chapter_number?: number;
    title?: string;
    summary?: string;
  }>
) {
  const cleanedSummary = summary?.trim() || '';

  if (!chapters.length) {
    return cleanedSummary;
  }

  const chaptersSection = chapters
    .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0))
    .map((chapter) => {
      const title = chapter.title?.trim() || `Capitulo ${chapter.chapter_number || '?'}`;
      const number = chapter.chapter_number || '?';
      const chapterSummary = chapter.summary?.trim() || 'Sin resumen disponible.';
      return `Capitulo ${number}: ${title}\n${chapterSummary}`;
    })
    .join('\n\n');

  return cleanedSummary
    ? `${cleanedSummary}\n\nResumen por capitulos\n\n${chaptersSection}`
    : `Resumen por capitulos\n\n${chaptersSection}`;
}

/**
 * Analyzes the full text of a book and extracts narrative elements
 * with richer structure for summaries, chapters, chronology and relationships.
 */
export async function analyzeBookNarrative(bookId: string, fullText: string) {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const model = getAnalysisModel();

  try {
    await supabase
      .from('books')
      .update({ processing_status: 'analyzing', processing_progress: 75 })
      .eq('id', bookId);

    await supabase.from('book_entities').delete().eq('book_id', bookId);
    await supabase.from('book_themes').delete().eq('book_id', bookId);
    await supabase.from('book_chapters').delete().eq('book_id', bookId);
    await supabase.from('book_character_relationships').delete().eq('book_id', bookId);

    let result;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        result = await model.generateContent([
          BOOK_ANALYSIS_PROMPT,
          `\n\nTEXTO COMPLETO DEL LIBRO:\n"""\n${fullText}\n"""`
        ]);
        break;
      } catch (err: any) {
        if (err.message?.includes('429') && retries < maxRetries - 1) {
          retries++;
          const delay = Math.pow(2, retries) * 2000;
          console.warn(
            `[Book ${bookId}] Gemini 429 hit. Retrying in ${delay}ms... (Attempt ${retries + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw err;
        }
      }
    }

    if (!result) throw new Error('Failed to generate content after retries');

    const responseText = result.response.text();
    const analysis = parseJsonResponse(responseText);
    const chapters = Array.isArray(analysis.chapters) ? analysis.chapters : [];

    if (analysis.characters?.length > 0) {
      const charRecords = analysis.characters
        .filter((character: any) => character.name && character.description)
        .map((character: any) => ({
          book_id: bookId,
          entity_type: 'character',
          name: character.name,
          description: character.description,
          metadata: {
            role: character.role || 'secundario',
            aliases: Array.isArray(character.aliases) ? character.aliases : [],
            traits: Array.isArray(character.traits) ? character.traits : [],
            first_appearance: character.first_appearance || null,
            chapter_presence: Array.isArray(character.chapter_presence)
              ? character.chapter_presence
              : [],
          },
          importance_score: character.importance_score || 5,
        }));

      if (charRecords.length > 0) {
        await supabase.from('book_entities').insert(charRecords);
      }
    }

    if (analysis.character_relationships?.length > 0) {
      const relationshipRecords = analysis.character_relationships
        .filter((rel: any) => rel.source_character && rel.target_character && rel.description)
        .map((rel: any) => ({
          book_id: bookId,
          source_character: rel.source_character,
          target_character: rel.target_character,
          relationship_type: rel.relationship_type || null,
          description: rel.description,
          evolution: rel.evolution || null,
          importance_score: rel.importance_score || 5,
        }));

      if (relationshipRecords.length > 0) {
        await supabase.from('book_character_relationships').insert(relationshipRecords);
      }
    }

    if (analysis.spaces?.length > 0) {
      const spaceRecords = analysis.spaces
        .filter((space: any) => space.name && space.description)
        .map((space: any) => ({
          book_id: bookId,
          entity_type: 'space',
          name: space.name,
          description: space.description,
          metadata: {
            type: space.type,
            related_chapters: Array.isArray(space.related_chapters) ? space.related_chapters : [],
          },
          importance_score: space.importance_score || 5,
        }));

      if (spaceRecords.length > 0) {
        await supabase.from('book_entities').insert(spaceRecords);
      }
    }

    if (analysis.events?.length > 0) {
      const eventRecords = analysis.events
        .filter((event: any) => event.name && event.description)
        .map((event: any) => ({
          book_id: bookId,
          entity_type: 'event',
          name: event.name,
          description: event.description,
          metadata: {
            chronological_order: event.chronological_order,
            chapter_number: event.chapter_number || null,
            involved_characters: Array.isArray(event.involved_characters)
              ? event.involved_characters
              : [],
            evidence: event.evidence || null,
          },
          importance_score: event.importance_score || 5,
        }));

      if (eventRecords.length > 0) {
        await supabase.from('book_entities').insert(eventRecords);
      }
    }

    if (analysis.conflicts?.length > 0) {
      const conflictRecords = analysis.conflicts
        .filter((conflict: any) => conflict.name && conflict.description)
        .map((conflict: any) => ({
          book_id: bookId,
          entity_type: 'conflict',
          name: conflict.name,
          description: conflict.description,
          metadata: {
            type: conflict.type,
            resolution: conflict.resolution,
            involved_characters: Array.isArray(conflict.involved_characters)
              ? conflict.involved_characters
              : [],
            related_events: Array.isArray(conflict.related_events) ? conflict.related_events : [],
          },
          importance_score: conflict.type === 'main' ? 10 : 7,
        }));

      if (conflictRecords.length > 0) {
        await supabase.from('book_entities').insert(conflictRecords);
      }
    }

    if (analysis.themes?.length > 0) {
      const themeRecords = analysis.themes
        .filter((theme: any) => theme.theme_name && theme.description)
        .map((theme: any) => ({
          book_id: bookId,
          theme_name: theme.theme_name,
          description: theme.description,
          evidence: {
            related_chapters: Array.isArray(theme.related_chapters) ? theme.related_chapters : [],
            evidence: Array.isArray(theme.evidence) ? theme.evidence : [],
          },
        }));

      if (themeRecords.length > 0) {
        await supabase.from('book_themes').insert(themeRecords);
      }
    }

    if (chapters.length > 0) {
      const chapterRecords = chapters
        .filter((chapter: any) => chapter.summary)
        .map((chapter: any, index: number) => ({
          book_id: bookId,
          chapter_number: chapter.chapter_number || index + 1,
          title: chapter.title || `Capitulo ${chapter.chapter_number || index + 1}`,
          start_page: chapter.start_page || null,
          end_page: chapter.end_page || null,
          summary: chapter.summary,
          key_events: Array.isArray(chapter.key_events) ? chapter.key_events : [],
          key_characters: Array.isArray(chapter.key_characters) ? chapter.key_characters : [],
        }));

      if (chapterRecords.length > 0) {
        await supabase.from('book_chapters').insert(chapterRecords);
      }
    }

    const detailedSummary = buildDetailedSummary(analysis.summary, chapters);
    if (detailedSummary) {
      await supabase
        .from('books')
        .update({ summary: detailedSummary })
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
