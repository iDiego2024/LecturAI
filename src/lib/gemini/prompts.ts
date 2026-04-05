/**
 * Centralized prompts for Gemini API usage in Comprendia.
 * All prompts are designed to return structured JSON.
 */

// 1. Full Book Analysis Prompt
// This is used to analyze the entire book text at once (gemini-2.0-flash with 1M context)
export const BOOK_ANALYSIS_PROMPT = `
Eres un experto analista literario y pedagogo. Tu tarea es leer el texto completo de un libro proporcionado y realizar un análisis estructural y narrativo profundo, pensando en que esta información se usará para generar pruebas de comprensión lectora escolar.

Tu salida debe ser un JSON válido con la siguiente estructura exacta:
{
  "summary": "Resumen global del libro en 4-6 párrafos, incluyendo arco narrativo, desenlace y sentido general de la obra",
  "characters": [
    {
      "name": "Nombre completo",
      "role": "protagonista|antagonista|secundario|incidental",
      "aliases": ["Alias, apodos o nombres alternativos"],
      "description": "Descripción física, psicológica y función narrativa",
      "traits": ["rasgo 1", "rasgo 2"],
      "first_appearance": "Capítulo, escena o tramo en que aparece por primera vez",
      "chapter_presence": [1, 2, 3],
      "importance_score": 1 al 10
    }
  ],
  "character_relationships": [
    {
      "source_character": "Personaje A",
      "target_character": "Personaje B",
      "relationship_type": "familiar|amistad|enemistad|romantica|autoridad|alianza|rivalidad|mentor|otro",
      "description": "Cómo interactúan y por qué esa relación importa",
      "evolution": "Cómo cambia la relación a lo largo del libro",
      "importance_score": 1 al 10
    }
  ],
  "spaces": [
    {
      "name": "Nombre del espacio",
      "type": "physcial|psychological|social",
      "description": "Cómo es este espacio y qué importancia tiene en la trama",
      "related_chapters": [1, 2],
      "importance_score": 1 al 10
    }
  ],
  "events": [
    {
      "name": "Nombre o titular del acontecimiento",
      "description": "Qué sucede exactamente",
      "chronological_order": 1,
      "chapter_number": 1,
      "involved_characters": ["Personaje A", "Personaje B"],
      "evidence": "Fragmento breve para ubicar el momento dentro del libro sin copiar demasiado texto literal",
      "importance_score": 1 al 10
    }
  ],
  "conflicts": [
    {
      "name": "Nombre del conflicto",
      "type": "main|secondary",
      "description": "Partes involucradas y naturaleza del conflicto",
      "involved_characters": ["Personaje A", "Personaje B"],
      "related_events": [1, 4, 7],
      "resolution": "Cómo se resuelve (si se resuelve)"
    }
  ],
  "themes": [
    {
      "theme_name": "Tema central (ej: La amistad, La traición)",
      "description": "Cómo se aborda este tema en el libro",
      "related_chapters": [1, 3],
      "evidence": ["Situación, escena o hito que demuestra el tema"]
    }
  ],
  "chapters": [
    {
      "chapter_number": 1,
      "title": "Título real del capítulo o uno descriptivo si no aparece explícito",
      "start_page": 1,
      "end_page": 8,
      "summary": "Resumen detallado de lo que ocurre en este capítulo",
      "key_events": ["Evento 1", "Evento 2"],
      "key_characters": ["Personaje A", "Personaje B"]
    }
  ]
}

REGLAS IMPORTANTES:
1. No inventes absolutamente nada. Todo debe estar basado estrictamente en el texto.
2. Sé exhaustivo: incluye personajes principales, secundarios e incidentales si cumplen una función narrativa identificable.
3. La lista de acontecimientos debe venir en verdadero orden cronológico interno de la historia, no solo en orden de aparición.
4. Si el libro tiene capítulos explícitos, respétalos. Si no los tiene, agrupa en secciones narrativas numeradas de la forma más fiel posible.
5. En relaciones entre personajes, incluye solo interacciones claramente sustentadas por el texto.
6. Asegúrate de devolver ÚNICAMENTE el JSON, sin texto Markdown alrededor (\`\`\`json etc...).
`;

// 2. Question Generation Prompt
// Used for generating specific questions based on parameters
export const generateQuestionPrompt = (
  bookTitle: string,
  bookSummary: string,
  cognitiveLevel: 'locate' | 'interpret' | 'reflect',
  questionType: 'multiple_choice' | 'true_false' | 'development' | 'matching' | 'creative_writing',
  targetGrade: string,
  contextText: string,
  existingQuestionsContext: string = "",
  topicHint: string = "",
  teacherRequest: string = ""
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
- matching: Términos pareados o relaciones entre columnas.
- creative_writing: Escritura creativa guiada, anclada en la lectura del libro.

PÚBLICO OBJETIVO: Estudiantes de ${targetGrade}. El vocabulario y complejidad deben ser adecuados para esta edad.

${topicHint ? `TEMA O FOCO PRIORIZADO: ${topicHint}` : ''}
${teacherRequest ? `ENCARGO DEL DOCENTE: ${teacherRequest}` : ''}

CONTEXTO DEL LIBRO (Fragmentos relevantes recuperados):
"""
${contextText}
"""

${existingQuestionsContext ? `PREGUNTAS YA GENERADAS (NO REPETIR TEMÁTICAS):\n${existingQuestionsContext}` : ''}

Tu salida debe ser un JSON válido con la siguiente estructura exacta:
{
  "question_text": "Cuerpo de la pregunta, claro y sin ambigüedades",
  "correct_answer": "La respuesta correcta, pauta esperada o solucion guía",
  "distractors": ["Opción incorrecta 1", "Opción incorrecta 2", "Opción incorrecta 3"],
  "rubric": "Criterios de evaluación",
  "justification": "Por qué la respuesta es correcta según el texto",
  "metadata": {
    "topic_label": "Tema específico de la pregunta",
    "matching_pairs": [
      { "left": "Concepto", "right": "Relacion correcta" }
    ],
    "creative_task": "Instrucción breve de escritura creativa",
    "writing_focus": ["aspecto 1", "aspecto 2"]
  }
}

REGLAS IMPORTANTES:
1. La pregunta DEBE poder responderse leyendo los fragmentos proporcionados.
2. Evita preguntas "tramposas" o ambiguas.
3. Evita repetir el mismo tema central de las preguntas ya generadas.
4. Si el docente pide un tema específico, priorízalo sin salirte del libro.
5. Para matching, devuelve entre 3 y 5 pares en metadata.matching_pairs.
6. Para creative_writing, entrega una consigna creativa evaluable, una pauta en rubric y focos en metadata.writing_focus.
7. Devuelve ÚNICAMENTE el objeto JSON válido.
`;
