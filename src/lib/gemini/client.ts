import { GoogleGenerativeAI } from '@google/generative-ai';

// Determine if we're on the server or client
const apiKey = typeof window !== 'undefined' 
  ? process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  : process.env.GEMINI_API_KEY || '';

// Initialize the Gemini API client
export const genAI = new GoogleGenerativeAI(apiKey);

// Model definitions
export const MODELS = {
  // Use 3.1-flash-lite-preview for massive 1M context free-tier availability
  ANALYSIS: 'gemini-3.1-flash-lite-preview',
  
  // For standard question generation and smaller tasks
  GENERATION: 'gemini-3.1-flash-lite-preview',
  
  // For semantic search / vector database
  EMBEDDING: 'gemini-embedding-001'
} as const;

/**
 * Gets the standard Gemini model for analysis
 */
export function getAnalysisModel() {
  return genAI.getGenerativeModel({
    model: MODELS.ANALYSIS,
    generationConfig: {
      temperature: 0.1, // Low temperature for factual extraction
      responseMimeType: 'application/json', // Force JSON output for structured data
    }
  });
}

/**
 * Gets the Gemini model for question generation
 */
export function getGenerationModel() {
  return genAI.getGenerativeModel({
    model: MODELS.GENERATION,
    generationConfig: {
      temperature: 0.4, // Slightly higher for creating varied distractors
      responseMimeType: 'application/json',
    }
  });
}

/**
 * Generates an embedding for a text chunk
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: MODELS.EMBEDDING });
  
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    outputDimensionality: 768
  } as any);
  
  return result.embedding.values;
}

/**
 * Generates embeddings for multiple chunks in a single API call.
 * This heavily reduces RPM and prevents hitting the 15 RPM free tier limit.
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: MODELS.EMBEDDING });
  
  const result = await model.batchEmbedContents({
    requests: texts.map(text => ({
      model: 'models/' + MODELS.EMBEDDING,
      content: { role: 'user', parts: [{ text }] },
      outputDimensionality: 768
    }))
  } as any);
  
  return result.embeddings.map(e => e.values);
}
