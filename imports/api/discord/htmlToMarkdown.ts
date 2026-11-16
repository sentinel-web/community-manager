/**
 * Converts the app's sanitized rich text (allow-list in imports/api/htmlSanitizer/sanitizePolicy.ts)
 * to Discord markdown. The output is only ever sent to Discord as message text, never rendered as
 * HTML, so leftover tags are simply dropped.
 */
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

export function htmlToMarkdown(html: string = '', maxLength = 1000): string {
  const text = html
    .replace(/<(strong|b)>(.*?)<\/\1>/gis, '**$2**')
    .replace(/<(em|i)>(.*?)<\/\1>/gis, '*$2*')
    .replace(/<u>(.*?)<\/u>/gis, '__$1__')
    .replace(/<(s|strike)>(.*?)<\/\1>/gis, '~~$2~~')
    .replace(/<code>(.*?)<\/code>/gis, '`$1`')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gis, (_, href: string, label: string) => (label === href ? href : `[${label}](${href})`))
    .replace(/<h[1-6]>(.*?)<\/h[1-6]>/gis, '**$1**\n')
    .replace(/<li>/gi, '- ')
    .replace(/<blockquote>/gi, '> ')
    .replace(/<br\s*\/?>|<\/(p|li|blockquote|pre|ul|ol)>|<hr\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name])
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
