'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Highlighter,
  PaintBucket,
  Code,
  Minus,
  RemoveFormatting,
  Type,
} from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: string;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition',
        'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40',
        active && 'bg-primary text-primary-foreground hover:bg-primary/90',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-card-border" />;
}

const TEXT_COLORS = [
  { name: 'Default', value: 'inherit' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Yellow', value: '#ca8a04' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#ffffff' },
];

const BG_COLORS = [
  { name: 'None', value: 'none' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Purple', value: '#ddd6fe' },
  { name: 'Red', value: '#fecaca' },
  { name: 'Orange', value: '#fed7aa' },
  { name: 'Gray', value: '#e5e7eb' },
];

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-card-border bg-muted p-1.5">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Inline code"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet list"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered list"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        title="Align left"
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        title="Align center"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        title="Align right"
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        active={editor.isActive({ textAlign: 'justify' })}
        title="Justify"
      >
        <AlignJustify className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive('highlight')}
        title="Highlight"
      >
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>

      <div className="relative inline-flex items-center gap-1">
        <Type className="h-4 w-4 text-muted-foreground" />
        <select
          onChange={(e) => {
            const color = e.target.value;
            if (color === 'inherit') {
              editor.chain().focus().unsetColor().run();
            } else {
              editor.chain().focus().setColor(color).run();
            }
            e.target.value = 'inherit';
          }}
          className="h-8 rounded-md border border-card-border bg-background text-foreground px-1.5 text-xs"
          style={{ colorScheme: 'inherit' }}
          title="Text color"
          value="inherit"
        >
          {TEXT_COLORS.map((c) => (
            <option
              key={c.value}
              value={c.value}
              style={{
                color: c.value === 'inherit' ? undefined : c.value,
                backgroundColor: 'var(--card)',
              }}
            >
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="relative inline-flex items-center gap-1">
        <PaintBucket className="h-4 w-4 text-muted-foreground" />
        <select
          onChange={(e) => {
            const color = e.target.value;
            if (color === 'none') {
              editor.chain().focus().unsetHighlight().run();
            } else {
              editor.chain().focus().setHighlight({ color }).run();
            }
            e.target.value = 'none';
          }}
          className="h-8 rounded-md border border-card-border bg-background text-foreground px-1.5 text-xs"
          style={{ colorScheme: 'inherit' }}
          title="Background color"
          value="none"
        >
          {BG_COLORS.map((c) => (
            <option
              key={c.value}
              value={c.value}
              style={{
                backgroundColor: c.value === 'none' ? 'var(--card)' : c.value,
                color: c.value === 'none' ? 'var(--fg)' : '#0f172a',
              }}
            >
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        title="Clear formatting"
      >
        <RemoveFormatting className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  minHeight = '120px',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: value || '',
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'tiptap max-w-none focus:outline-none px-3 py-2 text-foreground',
        ),
        style: `min-height: ${minHeight}`,
      },
    },
  });

  // Sync external value changes (e.g. when form resets)
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div
        className={cn('rounded-xl border border-card-border bg-card', className)}
        style={{ minHeight }}
      />
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-card-border bg-card text-foreground', className)}>
      {!disabled && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
      {placeholder && editor.isEmpty && !disabled && (
        <div className="pointer-events-none absolute mt-[-2.5rem] px-3 py-2 text-sm text-muted-foreground">
          {placeholder}
        </div>
      )}
    </div>
  );
}

/**
 * Read-only display of rich text content. Use for printing/preview.
 */
export function RichTextDisplay({ html, className }: { html: string; className?: string }) {
  if (!html || html === '<p></p>') return null;
  return (
    <div
      className={cn('tiptap-display max-w-none text-foreground', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
