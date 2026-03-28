/**
 * Centralized prompts for Gemini API usage in LecturAI.
 * All prompts are designed to return structured JSON.
 */

// 1. Full Book Analysis Prompt
// This is used to analyze the entire book text at once (gemini-2.0-flash with 1M context)
export const BOOK_ANALYSIS_PROMPT = `
Eres un experto analista literario y pedagogo. Tu tarea es leer el texto completo de un libro proporcionado y realizar un análisis estructural y narrativo profundo, pensando en que esta información se usará para generar pruebas de comprensión lectora escolar.

Tu salida debe ser un JSON válido con la siguiente estructura exacta:
{
  "summary": "Resumen completo del libro en 3-4 párrafos",
  "characters": [
    {
      "name": "Nombre completo",
      "role": "protagonista|antagonista|secundario|incidental",
      "description": "Descripción física y psicológica",
      "traits": ["rasgo 1", "rasgo 2"],
      "importance_score": 1 al 10
    }
  ],
  "spaces": [
    {
      "name": "Nombre del espacio",
      "type": "physcial|psychological|social",
      "description": "Cómo es este espacio y qué importancia tiene en la trama",
      "importance_score": 1 al 10
    }
  ],
  "events": [
    {
      "name": "Nombre o titular del acontecimiento",
      "description": "Qué sucede exactamente",
      "chronological_order": 1,
      "importance_score": 1 al 10
    }
  ],
  "conflicts": [
    {
      "name": "Nombre del conflicto",
      "type": "main|secondary",
      "description": "Partes involucradas y naturaleza del conflicto",
      "resolution": "Cómo se resuelve (si se resuelve)"
    }
  ],
  "themes": [
    {
      "theme_name": "Tema central (ej: La amistad, La traición)",
      "description": "Cómo se aborda este tema en el libro"
    }
  ]
}

REGLAS IMPORTANTES:
1. No inventes absolutamente nada. Todo debe estar basado estrictamente en el texto.
2. Sé muy exhaustivo con los personajes y acontecimientos principales.
3. Asegúrate de devolver ÚNICAMENTE el JSON, sin texto Markdown alrededor (\`\`\`json etc...).
`;

// 2. Question Generation Prompt
// Used for generating specific questions based on parameters
export const generateQuestionPrompt = (
  bookTitle: string,
  bookSummary: string,
  cognitiveLevel: 'locate' | 'interpret' | 'reflect',
  questionType: 'multiple_choice' | 'true_false' | 'development',
  targetGrade: string,
  contextText: string,
  existingQuestionsContext: string = ""
) => `
Eres un creador de pruebas de comprensión lectora experto. 
Estás creando una pregunta para el libro "${bookTitle}".

NIVEL COGNITIVO REQUERIDO: ${cognitiveLevel}
- locate (localizar): Identificar información explícita en el texto.
- interpret (interpretar): Inferir significado, relacionar partes, entender motivaciones.
- reflect (reflexionar): Evaluar críticamente, conectar con el mundo real o juzgar acciones.

TIPO DE PREGUNTA REQUERIDO: ${questionType}
- multiple_choice: Selección múltiple con 4 opciones.
- true_false: Verdadero o Falso.
- development: Pregunta abierta de desarrollo.

PÚBLICO OBJETIVO: Estudiantes de ${targetGrade}. El vocabulario y complejidad deben ser adecuados para esta edad.

CONTEXTO DEL LIBRO (Fragmentos relevantes recuperados):
"""
${contextText}
"""

${existingQuestionsContext ? `PREGUNTAS YA GENERADAS (NO REPETIR TEMÁTICAS):\n${existingQuestionsContext}` : ''}

Tu salida debe ser un JSON válido con la siguiente estructura exacta:
{
  "question_text": "Cuerpo de la pregunta, claro y sin ambigüedades",
  "correct_answer": "La respuesta correcta (o 'Verdadero'/'Falso', o la pauta esperada para desarrollo)",
  "distractors": ["Opción incorrecta 1", "Opción incorrecta 2", "Opción incorrecta 3"], // SOLO para multiple_choice. Deben ser plausibles pero claramente incorrectas.
  "rubric": "Criterios de evaluación (SOLO para development)",
  "justification": "Por qué la respuesta es correcta según el texto"
}

REGLAS IMPORTANTES:
1. La pregunta DEBE poder responderse leyendo los fragmentos proporcionados.
2. Evita preguntas "tramposas" o ambiguas.
3. Devuelve ÚNICAMENTE el objeto JSON válido.
`;
