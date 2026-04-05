# Arquitectura de Comprendia

Comprendia es una aplicación web full-stack diseñada para docentes, que permite generar pruebas de comprensión lectora de alta calidad narrativa y pedagógica, asegurando la lectura completa del texto mediante Inteligencia Artificial (Google Gemini).

## 1. Stack Tecnológico

*   **Frontend y Backend:** Next.js 14 (App Router) con TypeScript.
*   **Estilos:** CSS Modules y Vanilla CSS global, enfocado en una UI Premium (Dark Mode glassmorphism).
*   **Base de Datos y Autenticación:** Supabase (PostgreSQL + pgvector).
*   **Procesamiento de IA:** Google Gemini API (`gemini-2.0-flash` para textos largos y `text-embedding-004`).
*   **Extracción de PDF:** `pdf-parse` (Node.js).
*   **Exportación de Documentos:** `docx` (creación programática de Word).
*   **Despliegue Recomendado:** Vercel (Frontend/API) + Supabase Cloud.

---

## 2. Decisiones Arquitectónicas Principales

### 2.1 Enfoque de Lectura Completa (No Resumen)
Para garantizar la calidad pedagógica y evitar alucinaciones "genéricas", Comprendia no confía en que la IA "ya conozca" el libro de memoria. El sistema extrae el texto completo, lo analiza, y luego genera embeddings para trazar cada pregunta a fragmentos específicos del libro.

### 2.2 Patrón de Procesamiento Asíncrono (Pipeline)
El procesamiento de un PDF grande excede los límites de tiempo de respuesta HTTP estándar (especialmente en funciones Serverless).
Por ello, la ruta `/api/books/upload` guarda el archivo y arranca el procesamiento en background llamando directamente a `processNewBook`.
El frontend hace *long-polling* (cada 3 segundos) a `/api/books/[id]/status` para actualizar la barra de progreso de la UI.

### 2.3 Modelo de Datos y Trazabilidad (pgvector)
El texto se divide en fragmentos (chunks) usando solapamiento (overlap) para no cortar ideas por la mitad. Cada chunk recibe un embedding vectorial de 768 dimensiones.
Durante la generación de preguntas (RAG - *Retrieval Augmented Generation*), se extraen chunks relevantes para obligar al modelo LLM a basarse *estrictamente* en el texto y no inventar acontecimientos.

---

## 3. Flujos de Datos

### Flujo de Ingesta de Libro (Pipeline)
1.  **Extract:** El PDF subido se extrae a texto plano identificando número de páginas.
2.  **Normalize:** Limpieza de saltos de línea y correcciones de OCR básico.
3.  **Chunk:** El texto se corta en fragmentos semánticos (~500 tokens).
4.  **Embed:** Se llama a Gemini Embedding API por cada chunk en lotes.
5.  **Analyze:** Se envía el texto completo a `gemini-2.0-flash` con una ventana de contexto gigante para extraer: Personajes (rol, rasgos), Espacios, Acontecimientos, Conflictos y Temas.

### Flujo de Generación de Pruebas
1.  **Configuración:** El docente define cantidad, nivel (8º Básico), y distribución porcentual.
2.  **Reparto Matemático:** El frontend traduce porcentajes a arrays directos (ej: `['locate', 'interpret', 'reflect', ...]`).
3.  **Generación RAG secuencial:** El backend genera cada pregunta iterando sobre la configuración. Se le inyectan "contextos" para que no repita conceptos ya evaluados.
4.  **Ensamblaje:** Las preguntas se atan a la prueba mediante la tabla `test_items`.

### Flujo de Exportación
Se usa `docx` para generar archivos Word nativos.
*   **Versión Alumno:** Oculta distractores falsos, deja espacio real (líneas) para desarrollo.
*   **Versión Docente:** Resalta en color verde la respuesta correcta, incluye las pautas/rúbricas de corrección y la "justificación" interna que da la IA.

---

## 4. Estructura del Proyecto

*   `/src/app`: Rutas del frontend (App Router) y Endpoints API en `/src/app/api`.
*   `/src/components`: Componentes reutilizables segregados por dominio (landing, etc).
*   `/src/lib`: Lógica de negocio core desacoplada de React (supabase, pdf, gemini, export).
*   `/supabase/migrations`: Esquema completo en SQL listo para un proyecto nuevo en Supabase.
