import { createClient } from '../supabase/server';
import { getGenerationModel } from './client';
import { generateQuestionPrompt } from './prompts';

type QuestionConfig = {
  bookId: string;
  cognitiveLevel: 'locate' | 'interpret' | 'reflect';
  questionType: 'multiple_choice' | 'true_false' | 'development';
  targetGrade: string;
  existingQuestionsContext?: string;
  topicHint?: string; // Optional: e.g. "Focus on character X" or "Focus on the ending"
};

/**
 * Generates a single question using RAG (Retrieval-Augmented Generation)
 * to ensure traceability back to the book's text.
 */
export async function generateQuestion(config: QuestionConfig) {
  const supabase = createClient();
  const model = getGenerationModel();

  try {
    // 1. Get book metadata
    const { data: book } = await supabase
      .from('books')
      .select('title, summary')
      .eq('id', config.bookId)
      .single();

    if (!book) throw new Error('Book not found');

    // 2. Retrieve relevant context (RAG)
    // We get random chunks since we want varied coverage, but if topicHint is provided,
    // we should ideally do semantic search on it. For now, we take 5 random chunks.
    const { data: contextChunks } = await supabase
      .rpc('get_random_chunks', { 
        book_id_param: config.bookId, 
        limit_val: 5 
      }) as { data: any[] | null };
      
    // Fallback if random function doesn't exist yet
    let chunks = contextChunks;
    if (!chunks) {
      const { data } = await supabase
        .from('book_chunks')
        .select('id, content, page_number')
        .eq('book_id', config.bookId)
        .limit(5);
      chunks = data || [];
    }

    const contextText = chunks.map(c => `[Página ${c.page_number}]: ${c.content}`).join('\n\n');
    const chunkIds = chunks.map(c => c.id);

    // 3. Generate the prompt
    const prompt = generateQuestionPrompt(
      book.title,
      book.summary || '',
      config.cognitiveLevel,
      config.questionType,
      config.targetGrade,
      contextText,
      config.existingQuestionsContext
    );

    // 4. Call Gemini
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const qData = JSON.parse(responseText);

    // 5. Save to the question bank
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
        status: 'draft'
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
