export async function renderPdfCover(buffer: Buffer): Promise<{ data: Buffer; mime: string } | null> {
  const { createCanvas } = await import('@napi-rs/canvas');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({ data: buffer, disableWorker: true } as any);
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.2 });

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx as any, viewport }).promise;

  const png = canvas.toBuffer('image/png');
  return { data: png, mime: 'image/png' };
}
