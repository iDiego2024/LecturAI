import { createClient } from '../supabase/server';
import { GENERATION_MODEL_CANDIDATES, getGenerationModel } from './client';
import { generateQuestionPrompt } from './prompts';

export type SupportedQuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'development'
  | 'matching'
  | 'creative_writing';

type QuestionConfig = {
  bookId: string;
  cognitiveLevel: 'locate' | 'interpret' | 'reflect';
  questionType: SupportedQuestionType;
  targetGrade: string;
  existingQuestionsContext?: string;
  topicHint?: string;
  teacherRequest?: string;
  usedTopics?: string[];
};

const MAX_GENERATION_RETRIES = 4;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    message.includes('429') ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('Service Unavailable') ||
    message.includes('high demand') ||
    message.includes('temporarily unavailable')
  );
}

async function generateQuestionPayload(
  prompt: string,
  context: { bookId: string; questionType: SupportedQuestionType; targetGrade: string }
) {
  let lastError: unknown;

  for (const modelName of GENERATION_MODEL_CANDIDATES) {
    const model = getGenerationModel(modelName);

    for (let attempt = 1; attempt <= MAX_GENERATION_RETRIES; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return parseJsonResponse(result.response.text());
      } catch (error) {
        lastError = error;

        if (!isRetryableGenerationError(error)) {
          break;
        }

        if (attempt === MAX_GENERATION_RETRIES) {
          break;
        }

        const delayMs = Math.pow(2, attempt) * 1500 + Math.floor(Math.random() * 400);
        console.warn(
          `[Book ${context.bookId}] Gemini generation retry ${attempt}/${MAX_GENERATION_RETRIES} with ${modelName} for ${context.questionType} (${context.targetGrade}) after ${delayMs}ms`,
          error
        );
        await sleep(delayMs);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('No fue posible generar la pregunta en este momento.');
}

function parseJsonResponse(responseText: string) {
  return JSON.parse(responseText.replace(/```json\n?|\n?```/g, '').trim());
}

function normalizeTopic(value: string) {
  return value.trim().toLowerCase();
}

function buildTopicCandidates(bookData: any) {
  const candidates: string[] = [];

  const pushUnique = (value: string | null | undefined) => {
    if (!value?.trim()) return;
    if (!candidates.includes(value.trim())) {
      candidates.push(value.trim());
    }
  };

  for (const character of bookData.characters || []) {
    pushUnique(character.name);
  }

  for (const theme of bookData.themes || []) {
    pushUnique(theme.theme_name);
  }

  for (const chapter of bookData.chapters || []) {
    pushUnique(chapter.title);
  }

  for (const event of bookData.events || []) {
    pushUnique(event.name);
  }

  return candidates;
}

async function getContextChunks(
  supabase: ReturnType<typeof createClient>,
  bookId: string,
  topicHint?: string
) {
  if (topicHint?.trim()) {
    const { data: topicChunks } = await supabase
      .from('book_chunks')
      .select('id, content, page_number')
      .eq('book_id', bookId)
      .ilike('content', `%${topicHint.trim()}%`)
      .limit(5);

    if (topicChunks?.length) return topicChunks;
  }

  const { data: contextChunks } = (await supabase.rpc('get_random_chunks', {
    book_id_param: bookId,
    limit_val: 5,
  })) as { data: any[] | null };

  if (contextChunks?.length) return contextChunks;

  const { data } = await supabase
    .from('book_chunks')
    .select('id, content, page_number')
    .eq('book_id', bookId)
    .limit(5);

  return data || [];
}

function resolveTopicHint(topicCandidates: string[], usedTopics: string[], requestedTopic?: string) {
  if (requestedTopic?.trim()) return requestedTopic.trim();

  const used = new Set(usedTopics.map(normalizeTopic));
  const nextTopic = topicCandidates.find((candidate) => !used.has(normalizeTopic(candidate)));

  return nextTopic || topicCandidates[0] || '';
}

export async function generateQuestion(config: QuestionConfig) {
  const supabase = createClient();

  try {
    const { data: book } = await supabase
      .from('books')
      .select('title, summary')
      .eq('id', config.bookId)
      .single();

    if (!book) throw new Error('Book not found');

    const [
      { data: characters },
      { data: themes },
      { data: chapters },
      { data: events },
    ] = await Promise.all([
      supabase.from('book_entities').select('name').eq('book_id', config.bookId).eq('entity_type', 'character'),
      supabase.from('book_themes').select('theme_name').eq('book_id', config.bookId),
      supabase.from('book_chapters').select('title').eq('book_id', config.bookId).order('chapter_number', { ascending: true }),
      supabase.from('book_entities').select('name').eq('book_id', config.bookId).eq('entity_type', 'event'),
    ]);

    const topicCandidates = buildTopicCandidates({ characters, themes, chapters, events });
    const topicHint = resolveTopicHint(topicCandidates, config.usedTopics || [], config.topicHint);
    const chunks = await getContextChunks(supabase, config.bookId, topicHint);
    const contextText = chunks.map((chunk) => `[Pagina ${chunk.page_number}]: ${chunk.content}`).join('\n\n');
    const chunkIds = chunks.map((chunk) => chunk.id);

    const prompt = generateQuestionPrompt(
      book.title,
      book.summary || '',
      config.cognitiveLevel,
      config.questionType,
      config.targetGrade,
      contextText,
      config.existingQuestionsContext,
      topicHint,
      config.teacherRequest || ''
    );

    const qData = await generateQuestionPayload(prompt, {
      bookId: config.bookId,
      questionType: config.questionType,
      targetGrade: config.targetGrade,
    });

    const { data: question, error } = await supabase
      .from('question_bank')
      .insert({
        book_id: config.bookId,
        q_type: config.questionType,
        cognitive_level: config.cognitiveLevel,
        question_text: qData.question_text,
        correct_answer: qData.correct_answer,
        distractors: qData.distractors || null,
        rubric: qData.rubric || null,
        justification: qData.justification,
        traceability_chunks: chunkIds,
        metadata: {
          ...(qData.metadata || {}),
          topic_label: qData.metadata?.topic_label || topicHint || null,
        },
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;

    return question;
  } catch (error) {
    console.error('Error generating question:', error);
    throw error;
  }
}
