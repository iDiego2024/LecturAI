import { load } from 'cheerio';

export function loadDocument(html: string) {
  return load(html);
}

export function cleanText(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function absoluteUrl(baseUrl: string, href?: string | null) {
  if (!href) return '';
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return '';
  }
}

export function readMetaTags(html: string) {
  const $ = load(html);
  const result: Record<string, string[]> = {};

  $('meta').each((_, element) => {
    const name =
      cleanText($(element).attr('name')) ||
      cleanText($(element).attr('property')) ||
      cleanText($(element).attr('http-equiv'));
    const content = cleanText($(element).attr('content'));
    if (!name || !content) return;
    if (!result[name]) result[name] = [];
    result[name].push(content);
  });

  return result;
}
