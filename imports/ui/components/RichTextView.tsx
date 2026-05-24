import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, { useEffect } from 'react';
import sanitizeHtml from '/imports/helpers/htmlSanitizer';

/**
 * Read-only renderer for stored rich-text HTML. Two layers of safety (ADR 0001):
 * the input is first run through the client sanitizer, then handed to a
 * non-editable Tiptap instance, which only renders nodes its schema knows about.
 * This avoids injecting raw HTML into the DOM entirely.
 */
interface RichTextViewProps {
  html?: string;
}

export default function RichTextView({ html = '' }: RichTextViewProps) {
  const clean = sanitizeHtml(html);

  const editor = useEditor({
    extensions: [StarterKit],
    content: clean,
    editable: false,
    immediatelyRender: false,
  });

  useEffect(() => {
    editor?.commands.setContent(sanitizeHtml(html), { emitUpdate: false });
  }, [editor, html]);

  if (!clean || !editor) return null;

  return <EditorContent editor={editor} className="rich-text-view" />;
}
