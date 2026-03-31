# LecturAI ✧

**Evaluaciones de lectura que realmente miden comprensión profunda.**

LecturAI es una plataforma diseñada para docentes que permite subir un libro en formato PDF/EPUB, procesarlo mediante Inteligencia Artificial (Google Gemini), y generar pruebas de comprensión lectora niveladas y con sustento pedagógico.

A diferencia de los resúmenes genéricos, LecturAI **lee el libro completo**, extrae personajes, eventos y temas, y luego utiliza generación aumentada por recuperación (RAG) para trazar cada pregunta a fragmentos exactos del libro, evitando ambigüedades o alucinaciones.

## Características

- 📚 **Análisis Narrativo Completo:** Extrae personajes, conflictos, espacios y temáticas.
- 🧠 **Niveles Cognitivos:** Permite distribuir preguntas entre Localizar, Interpretar y Reflexionar.
- 🎯 **Tipos de Múltiples:** Selección múltiple, verdadero/falso y desarrollo.
- 📝 **Exportación Dual:** Genera documento Word listo para imprimir para el alumno, y otro con pautas de corrección para el docente.
- 🎨 **Diseño Cálido Educativo:** Interfaz pensada para contexto escolar, accesible y cercana.

## Arquitectura

- **Frontend/Backend:** Next.js 14 App Router
- **Estilos:** Vanilla CSS
- **Base de Datos & Auth:** Supabase (PostgreSQL + pgvector)
- **IA:** Google Gemini (1M token context window)
- **Procesamiento PDF:** pdf-parse (Node.js)

---

## 🚀 Guía de Despliegue y Desarrollo Local

### 1. Requisitos Previos

- Node.js 18+
- Una cuenta en [Supabase](https://supabase.com)
- Una API Key de [Google AI Studio (Gemini)](https://aistudio.google.com/)

### 2. Configuración de Supabase

1. Crea un nuevo proyecto en Supabase.
2. Ve al SQL Editor en el panel de control.
3. Copia el contenido completo de `supabase/migrations/001_initial_schema.sql` y ejecútalo. Esto creará todas las tablas, vistas, y roles de seguridad necesarios.
4. Ve a **Storage** y crea un _Bucket_ público llamado `books`.

### 3. Configuración Local (segura)

Restaura el archivo de ambiente:
\`\`\`bash
cp .env.local.example .env.local
\`\`\`

Completa `.env.local` con tus credenciales **solo en local/Vercel**.

Importante:
- Nunca subas claves reales al repositorio.
- Mantén `.env.local` fuera de control de versiones.
- Usa únicamente valores de ejemplo en `.env.local.example`.

### 4. Instalación e Inicio

Instala las dependencias y corre el servidor de desarrollo:

\`\`\`bash
npm install
npm run dev
\`\`\`

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la página de inicio. Crea una cuenta para acceder al Dashboard docente.

### 5. Despliegue en Vercel

1. Sube este repositorio a GitHub.
2. Crea un nuevo proyecto en Vercel e importa el repositorio.
3. Configura las variables de entorno en Vercel usando tus credenciales privadas.
4. (Opcional pero recomendado para pruebas grandes) Cambia la "Serverless Function Maximum Execution Duration" a 60 segundos si estás en plan Pro. Si los libros a subir superan las 300 páginas y se experimentan timeouts de Vercel Hobby (10s), se recomienda implementar Background Jobs o Supabase Edge Functions para el pipeline de ingesta.

---

## 👩‍🏫 Para Profesores: ¿Cómo funciona?

1. Sube el **PDF** de una lectura complementaria.
2. Espera a que la **IA extraiga y analice** el texto (puede tomar 1-3 min dependiendo del largo).
3. Revisa la extracción de **personajes y conflictos** para asegurarte que la IA "entendió" el libro.
4. Configura la **Prueba**: define para qué curso es, cuántas preguntas y de qué tipo.
5. Haz clic en **Generar**. Las preguntas estarán listas en ~30 segundos.
6. **Exporta** a Word e imprime.
