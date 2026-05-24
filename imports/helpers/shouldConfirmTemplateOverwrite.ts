/**
 * Decide whether loading a briefing template into an event description must ask
 * for confirmation first. Loading over real content would destroy the user's
 * work, so we confirm; loading into an empty editor is frictionless.
 *
 * "Empty" accounts for the markup an untouched rich-text editor produces — an
 * empty paragraph, `<br>`, or whitespace/`&nbsp;` carry no real content.
 */
export default function shouldConfirmTemplateOverwrite(currentHtml: string | null | undefined): boolean {
  if (!currentHtml) return false;
  const textOnly = currentHtml
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return textOnly.length > 0;
}
