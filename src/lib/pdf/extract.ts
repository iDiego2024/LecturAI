import pdfParse from 'pdf-parse';

/**
 * Extracts all text from a PDF buffer using pdf-parse.
 * This runs in Node.js environments (Next.js Edge/Server).
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; pages: number }> {
  try {
    // Basic extraction
    const data = await pdfParse(buffer, {
      pagerender: renderPage
    });
    
    return {
      text: data.text,
      pages: data.numpages
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to extract text from PDF file.');
  }
}

/**
 * Custom page render function to inject page markers.
 * This helps us keep track of page numbers during chunking.
 */
function renderPage(pageData: any) {
  // Check text content 
  const render_options = {
    //replaces all occurrences of whitespace with single space
    normalizeWhitespace: false,
    //do not attempt to combine same line TextItem's
    disableCombineTextItems: false
  }

  return pageData.getTextContent(render_options)
    .then(function(textContent: any) {
      let lastY, text = '';
      for (let item of textContent.items) {
        if (lastY == item.transform[5] || !lastY){
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = item.transform[5];
      }
      
      // Inject page marker
      const pageNum = pageData.pageIndex + 1;
      return `\n---PAGE_${pageNum}---\n` + text;
    });
}
