# Integración de Libros desde Fuentes Externas

La app ahora resuelve libros y recursos externos mediante un subsistema backend desacoplado en `src/lib/external-sources/`, y luego reutiliza el mismo pipeline de ingestión y análisis que usamos para un PDF o EPUB subido manualmente.

## Fuentes activas

1. `wikisource_es`
   - Sitio: `https://es.wikisource.org`
   - Estrategia: búsqueda oficial vía MediaWiki `w/api.php` y exportación PDF mediante `api/rest_v1/page/pdf/...`
   - Formatos habilitados: PDF

2. `cervantes_virtual`
   - Sitio: `https://www.cervantesvirtual.com`
   - Estrategia: búsqueda real sobre el catálogo de ebooks en `/obras/serie/epubs_todos/` y resolución de descargas `descargaepub/...`
   - Formatos habilitados: EPUB y PDF cuando la ficha lo expone

3. `mineduc_biblioteca_digital`
   - Sitio: `https://bibliotecadigital.mineduc.cl`
   - Estrategia: búsqueda real DSpace en `/discover`, detalle en `/handle/...` y descarga desde `/bitstream/...`
   - Formato habilitado: PDF

4. `memoria_chilena`
   - Sitio: `https://www.memoriachilena.gob.cl`
   - Estrategia: búsqueda real en `w3-search.php?keywords=...`, parsing del detalle `w3-article-....html` y resolución de descargas `archivos2/pdfs/...`
   - Formatos habilitados: PDF y EPUB si el recurso lo expone

5. `bne_digital`
   - Sitio: `https://bnedigital.bne.es`
   - Estrategia: búsqueda real en `/bd/es/results`, detalle por `id=...` y lectura conservadora de fichas `/bd/es/card`
   - Formatos habilitados: solo cuando la ficha o el registro exponen un PDF/EPUB verificable

6. `elejandria`
   - Sitio: `https://www.elejandria.com`
   - Estrategia: catálogo backend sobre `sitemap.xml`, detalle en `/libro/...` y resolución segura del enlace final `link_descarga_libro/...`
   - Formatos habilitados: PDF y EPUB

7. `project_gutenberg`
   - Sitio: `https://www.gutenberg.org`
   - Estrategia: búsqueda oficial en `/ebooks/search/` y resolución de descargas desde la tabla de formatos del detalle `/ebooks/:id`
   - Formatos habilitados: EPUB preferente, PDF cuando exista

8. `curriculum_cra_catalog`
   - Sitio: `https://www.curriculumnacional.cl`
   - Estrategia: catálogo pedagógico vía `/buscador?search_text=...`
   - Uso principal: sugerencias curriculares y metadatos pedagógicos
   - Importación directa: solo si el detalle expone un archivo PDF o EPUB oficial

## Arquitectura

Estructura principal:

```txt
src/lib/external-sources/
  adapters/
  cache/
  parsing/
  services/
  validation/
  config.ts
  registry.ts
  types.ts
```

Piezas clave:

- `adapters/*`: una implementación por fuente
- `validation/domains.ts`: allowlist estricta por fuente
- `validation/files.ts`: validación de MIME, tamaño, extensión y firma de archivo
- `services/search-external-resources.ts`: búsqueda agregada y warnings por fuente
- `services/get-external-resource.ts`: detalle con caché
- `services/import-external-resource.ts`: descarga, validación, storage, `book_imports` y disparo del pipeline actual

## Base de datos

Migraciones:

- `supabase/migrations/008_external_book_sources.sql`
- `supabase/migrations/009_external_source_catalog_upgrade.sql`
- `supabase/migrations/010_external_source_spanish_expansion.sql`

Tablas:

- `external_sources`
- `external_resources`
- `book_imports`

Además:

- `books.source_type`
- `books.source_reference`

## Seguridad

Controles implementados:

- solo backend consulta fuentes externas
- allowlist por fuente y dominio final
- bloqueo de descargas fuera de HTTPS
- seguimiento manual de redirecciones
- validación de `Content-Type`
- validación de tamaño máximo
- rechazo de HTML, ZIP genérico y formatos no soportados
- firma `%PDF-` para PDF
- firma `PK` para EPUB

## Variables de entorno

- `BOOK_SOURCES_ENABLED`
  - CSV opcional para habilitar fuentes específicas
  - ejemplo: `mineduc_biblioteca_digital,memoria_chilena,project_gutenberg`

- `BOOK_SOURCES_TIMEOUT_MS`
  - default: `15000`

- `BOOK_SOURCES_MAX_BYTES`
  - default: `26214400` (25 MB)

- `BOOK_SOURCES_MAX_REDIRECTS`
  - default: `5`

- `BOOK_SOURCES_SEARCH_CACHE_MS`
  - default: `900000`

- `BOOK_SOURCES_RESOURCE_CACHE_MS`
  - default: `3600000`

## Cómo probar el flujo

1. Ejecuta `008_external_book_sources.sql`.
2. Ejecuta `009_external_source_catalog_upgrade.sql`.
3. Ejecuta `010_external_source_spanish_expansion.sql`.
4. Inicia la app.
5. Ve a `Biblioteca` -> `Agregar libro`.
6. Elige `Buscar desde fuentes oficiales y bibliotecas abiertas`.
7. Prueba búsquedas como `Don Quijote`, `Sub terra`, `Pride and Prejudice` o `Baldomero Lillo`.
8. Abre un resultado y revisa el detalle.
9. Si el recurso es importable, presiona `Usar este recurso`.
10. La app crea `book_imports`, guarda el archivo en Storage, crea `books` y redirige a `/books/:id`.

## Limitaciones conocidas

- Wikisource ES usa una exportación PDF oficial y estable, pero no toda página tiene valor pedagógico equivalente a una edición anotada.
- Cervantes Virtual se apoya solo en su catálogo de ebooks; las fichas bibliográficas sin descarga no se fuerzan como libros importables.
- Biblioteca Digital MINEDUC depende del HTML DSpace; si cambian clases como `.o-resource__title` o la sección de bitstreams, habrá que ajustar el adapter.
- Memoria Chilena mezcla páginas de referencia y objetos digitales; no todo resultado es importable directamente.
- BNE Digital se integró de forma conservadora: no se importa nada si el registro no expone un archivo final claro y compatible.
- Elejandría no ofrece un buscador server-rendered reutilizable; por eso la búsqueda se apoya en su sitemap oficial con caché temporal.
- Project Gutenberg advierte contra scraping agresivo; por eso usamos búsquedas acotadas y caché ligera.
- Currículum / CRA debe entenderse como catálogo pedagógico complementario, no como biblioteca principal de libros completos.
