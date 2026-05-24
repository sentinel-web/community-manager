import {
  BoldOutlined,
  ItalicOutlined,
  OrderedListOutlined,
  RedoOutlined,
  StrikethroughOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Button, Space, theme, Tooltip } from 'antd';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, { useCallback, useEffect, useReducer } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import type { TranslateFn } from '../section/types';

/**
 * Controlled rich-text editor (Tiptap StarterKit) shaped to drop into an antd
 * `<Form.Item>`: it reads `value` and emits HTML through `onChange`, exactly like
 * an `<Input>`. Output is HTML (ADR 0001); it is sanitized again on the server
 * write path and at render via RichTextView.
 */
interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Tiptap represents an empty document as <p></p>; normalise that to '' so an
// untouched editor does not persist phantom markup.
const EMPTY_HTML = '<p></p>';

const normalize = (html: string): string => (html === EMPTY_HTML ? '' : html);

export default function RichTextEditor({ value = '', onChange, disabled = false }: RichTextEditorProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => onChange?.(normalize(ed.getHTML())),
  });

  // Reflect external value changes (edit-mode init, load-template) without
  // emitting an update that would clobber the caller's own state.
  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming !== normalize(editor.getHTML())) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // Keep toolbar active-states in sync with selection/content.
  useEffect(() => {
    if (!editor) return;
    editor.on('transaction', forceUpdate);
    editor.on('selectionUpdate', forceUpdate);
    return () => {
      editor.off('transaction', forceUpdate);
      editor.off('selectionUpdate', forceUpdate);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadius,
        background: disabled ? token.colorBgContainerDisabled : token.colorBgContainer,
      }}
    >
      <Toolbar editor={editor} disabled={disabled} t={t} token={token} />
      <EditorContent editor={editor} className="rich-text-editor-content" style={{ padding: '8px 11px' }} />
    </div>
  );
}

interface ToolbarProps {
  editor: Editor;
  disabled: boolean;
  t: TranslateFn;
  token: ReturnType<typeof theme.useToken>['token'];
}

function Toolbar({ editor, disabled, t, token }: ToolbarProps) {
  const heading = useCallback((level: 2 | 3) => editor.chain().focus().toggleHeading({ level }).run(), [editor]);

  return (
    <Space size={2} wrap style={{ padding: 4, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      <Tooltip title={t('richText.bold')}>
        <Button
          size="small"
          type={editor.isActive('bold') ? 'primary' : 'text'}
          disabled={disabled}
          icon={<BoldOutlined />}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
      </Tooltip>
      <Tooltip title={t('richText.italic')}>
        <Button
          size="small"
          type={editor.isActive('italic') ? 'primary' : 'text'}
          disabled={disabled}
          icon={<ItalicOutlined />}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
      </Tooltip>
      <Tooltip title={t('richText.strike')}>
        <Button
          size="small"
          type={editor.isActive('strike') ? 'primary' : 'text'}
          disabled={disabled}
          icon={<StrikethroughOutlined />}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
      </Tooltip>
      <Tooltip title={t('richText.heading2')}>
        <Button size="small" type={editor.isActive('heading', { level: 2 }) ? 'primary' : 'text'} disabled={disabled} onClick={() => heading(2)}>
          H2
        </Button>
      </Tooltip>
      <Tooltip title={t('richText.heading3')}>
        <Button size="small" type={editor.isActive('heading', { level: 3 }) ? 'primary' : 'text'} disabled={disabled} onClick={() => heading(3)}>
          H3
        </Button>
      </Tooltip>
      <Tooltip title={t('richText.bulletList')}>
        <Button
          size="small"
          type={editor.isActive('bulletList') ? 'primary' : 'text'}
          disabled={disabled}
          icon={<UnorderedListOutlined />}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
      </Tooltip>
      <Tooltip title={t('richText.orderedList')}>
        <Button
          size="small"
          type={editor.isActive('orderedList') ? 'primary' : 'text'}
          disabled={disabled}
          icon={<OrderedListOutlined />}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
      </Tooltip>
      <Tooltip title={t('common.undo')}>
        <Button
          size="small"
          type="text"
          disabled={disabled || !editor.can().undo()}
          icon={<UndoOutlined />}
          onClick={() => editor.chain().focus().undo().run()}
        />
      </Tooltip>
      <Tooltip title={t('common.redo')}>
        <Button
          size="small"
          type="text"
          disabled={disabled || !editor.can().redo()}
          icon={<RedoOutlined />}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </Tooltip>
    </Space>
  );
}
