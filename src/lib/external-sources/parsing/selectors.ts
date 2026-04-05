import type { CheerioAPI } from 'cheerio';
import { absoluteUrl, cleanText } from './html';

export function selectFirstText($: CheerioAPI, selectors: string[]) {
  for (const selector of selectors) {
    const value = cleanText($(selector).first().text());
    if (value) return value;
  }
  return '';
}

export function selectFirstHref($: CheerioAPI, baseUrl: string, selectors: string[]) {
  for (const selector of selectors) {
    const href = absoluteUrl(baseUrl, $(selector).first().attr('href'));
    if (href) return href;
  }
  return '';
}
