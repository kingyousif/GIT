'use client';

import { useEditor, EditorContent, Editor, Extension, Mark, mergeAttributes } from '@tiptap/react';
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Highlighter,
  PaintBucket,
  Minus,
  RemoveFormatting,
  AArrowUp,
  AArrowDown,
  Sparkles,
  Heading1,
  Heading2,
  Heading3,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { getEditorConfig, EditorToolConfig } from '@/lib/editor-config';

// ===== Custom Tiptap Extensions =====

/**
 * Word-Style Font Size Extension for Tiptap
 */
export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands(): any {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: any) => {
          return chain().setMark('textStyle', { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }: any) => {
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
        },
    };
  },
});

/**
 * Word-Style Font Family Extension for Tiptap
 */
export const FontFamily = Extension.create({
  name: 'fontFamily',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element) => element.style.fontFamily?.replace(/['"]+/g, ''),
            renderHTML: (attributes) => {
              if (!attributes.fontFamily) return {};
              return {
                style: `font-family: ${attributes.fontFamily}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands(): any {
    return {
      setFontFamily:
        (fontFamily: string) =>
        ({ chain }: any) => {
          return chain().setMark('textStyle', { fontFamily }).run();
        },
      unsetFontFamily:
        () =>
        ({ chain }: any) => {
          return chain().setMark('textStyle', { fontFamily: null }).removeEmptyTextStyle().run();
        },
    };
  },
});

/**
 * Subscript Mark
 */
export const Subscript = Mark.create({
  name: 'subscript',
  parseHTML() {
    return [{ tag: 'sub' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sub', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands(): any {
    return {
      toggleSubscript:
        () =>
        ({ commands }: any) =>
          commands.toggleMark(this.name),
    };
  },
});

/**
 * Superscript Mark
 */
export const Superscript = Mark.create({
  name: 'superscript',
  parseHTML() {
    return [{ tag: 'sup' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands(): any {
    return {
      toggleSuperscript:
        () =>
        ({ commands }: any) =>
          commands.toggleMark(this.name),
    };
  },
});

// ===== Presets & Palettes =====

export const FONT_SIZES = [
  { label: '8 pt', value: '8pt' },
  { label: '9 pt', value: '9pt' },
  { label: '10 pt', value: '10pt' },
  { label: '11 pt', value: '11pt' },
  { label: '12 pt (Normal)', value: '12pt' },
  { label: '14 pt', value: '14pt' },
  { label: '16 pt (Medium)', value: '16pt' },
  { label: '18 pt (Large)', value: '18pt' },
  { label: '20 pt', value: '20pt' },
  { label: '24 pt', value: '24pt' },
  { label: '28 pt', value: '28pt' },
  { label: '32 pt', value: '32pt' },
  { label: '36 pt', value: '36pt' },
  { label: '48 pt', value: '48pt' },
  { label: '72 pt', value: '72pt' },
];

export const FONT_FAMILIES = [
  { label: 'Default (System)', value: 'inherit' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Segoe UI', value: '"Segoe UI", sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];

export const TEXT_COLORS = [
  { name: 'Automatic (Default)', value: 'inherit', hex: '#0f172a' },
  { name: 'Red', value: '#dc2626', hex: '#dc2626' },
  { name: 'Orange', value: '#ea580c', hex: '#ea580c' },
  { name: 'Amber', value: '#d97706', hex: '#d97706' },
  { name: 'Green', value: '#16a34a', hex: '#16a34a' },
  { name: 'Teal', value: '#0f766e', hex: '#0f766e' },
  { name: 'Blue', value: '#2563eb', hex: '#2563eb' },
  { name: 'Indigo', value: '#4f46e5', hex: '#4f46e5' },
  { name: 'Purple', value: '#7c3aed', hex: '#7c3aed' },
  { name: 'Pink', value: '#db2777', hex: '#db2777' },
  { name: 'Rose', value: '#e11d48', hex: '#e11d48' },
  { name: 'Dark Slate', value: '#1e293b', hex: '#1e293b' },
  { name: 'Muted Gray', value: '#64748b', hex: '#64748b' },
];

export const BG_COLORS = [
  { name: 'No Color', value: 'none', hex: 'transparent' },
  { name: 'Yellow', value: '#fef08a', hex: '#fef08a' },
  { name: 'Green', value: '#bbf7d0', hex: '#bbf7d0' },
  { name: 'Cyan', value: '#a5f3fc', hex: '#a5f3fc' },
  { name: 'Pink', value: '#fbcfe8', hex: '#fbcfe8' },
  { name: 'Orange', value: '#fed7aa', hex: '#fed7aa' },
  { name: 'Purple', value: '#ddd6fe', hex: '#ddd6fe' },
  { name: 'Red', value: '#fecaca', hex: '#fecaca' },
  { name: 'Light Gray', value: '#e2e8f0', hex: '#e2e8f0' },
];

export const MEDICAL_SNIPPETS = [
  { label: 'Normal mucosa without ulceration or mass', text: 'Normal mucosa visualized without evidence of ulceration, bleeding, or mass lesion.' },
  { label: 'Mild erythematous gastropathy', text: 'Mild erythematous gastropathy noted in the gastric antrum; no active bleeding.' },
  { label: 'No active bleeding or stigmata', text: 'No active bleeding, stigmata of recent hemorrhage, or vascular lesions identified.' },
  { label: 'Biopsy specimens taken', text: 'Cold biopsy specimens taken from the suspicious area and submitted for histopathological evaluation.' },
  { label: 'Polyp completely resected', text: 'Polyp identified, successfully resected via snare polypectomy, and retrieved for histological analysis.' },
  { label: 'Adequate visualization / good prep', text: 'Lumen adequately visualized throughout; mucosal preparation was good.' },
  { label: 'Sliding hiatal hernia', text: 'Sliding hiatal hernia visualized with minor mucosal changes consistent with reflux.' },
  { label: 'Stricture dilated', text: 'Benign-appearing stricture noted and dilated successfully without immediate complication.' },
];

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: string;
  compact?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function ToolbarButton({ onClick, active, disabled, title, children, className }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex h-7.5 w-7.5 items-center justify-center rounded-md text-xs font-medium transition-all duration-150',
        'text-foreground/80 hover:bg-background hover:text-foreground hover:shadow-xs active:scale-95',
        'disabled:cursor-not-allowed disabled:opacity-35',
        active && 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/95 hover:text-primary-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-card-border/80" />;
}

function WordToolbar({ editor, config, compact }: { editor: Editor; config: EditorToolConfig; compact?: boolean }) {
  // Current active font size & family
  const currentFontSize = editor.getAttributes('textStyle').fontSize || '12pt';
  const currentFontFamily = editor.getAttributes('textStyle').fontFamily || 'inherit';
  const currentTextColor = editor.getAttributes('textStyle').color || 'inherit';

  const handleStepFontSize = (direction: 'up' | 'down') => {
    const values = FONT_SIZES.map((s) => s.value);
    const currentIndex = values.indexOf(currentFontSize);
    let nextIndex = 4; // default 12pt
    if (currentIndex !== -1) {
      nextIndex = direction === 'up' ? Math.min(currentIndex + 1, values.length - 1) : Math.max(currentIndex - 1, 0);
    }
    const nextSize = values[nextIndex];
    (editor.chain().focus() as any).setFontSize(nextSize).run();
  };

  const handleInsertSnippet = (text: string) => {
    editor.chain().focus().insertContent(` ${text} `).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-card-border/80 bg-muted/70 px-2 py-1.5 backdrop-blur-xs select-none">
      {/* 1. History (Undo / Redo) */}
      {config.history && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="h-3.5 w-3.5" />
          </ToolbarButton>
          <Divider />
        </>
      )}

      {/* 2. Font Family Dropdown */}
      {config.fontFamily && (
        <div className="relative inline-flex items-center">
          <select
            value={currentFontFamily}
            onChange={(e) => {
              const font = e.target.value;
              if (font === 'inherit') {
                (editor.chain().focus() as any).unsetFontFamily().run();
              } else {
                (editor.chain().focus() as any).setFontFamily(font).run();
              }
            }}
            className="h-7.5 rounded-md border border-card-border/80 bg-background px-2 text-xs font-medium text-foreground transition hover:border-primary/60 focus:outline-hidden focus:ring-1 focus:ring-primary"
            title="Font Family"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 3. Font Size Dropdown + Steppers */}
      {config.fontSize && (
        <div className="flex items-center gap-0.5">
          <select
            value={currentFontSize}
            onChange={(e) => {
              (editor.chain().focus() as any).setFontSize(e.target.value).run();
            }}
            className="h-7.5 w-24 rounded-md border border-card-border/80 bg-background px-1.5 text-xs font-medium text-foreground transition hover:border-primary/60 focus:outline-hidden focus:ring-1 focus:ring-primary"
            title="Font Size"
          >
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <ToolbarButton onClick={() => handleStepFontSize('up')} title="Increase Font Size (Grow Font)">
            <AArrowUp className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton onClick={() => handleStepFontSize('down')} title="Decrease Font Size (Shrink Font)">
            <AArrowDown className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>
      )}

      {/* Headings (Optional - if turned ON in .env) */}
      {config.headings && (
        <>
          <Divider />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="h-3.5 w-3.5" />
          </ToolbarButton>
        </>
      )}

      <Divider />

      {/* 4. Text Formatting Group (Bold, Italic, Underline, Strike, Sub, Sup) */}
      <div className="flex items-center gap-0.5">
        {config.bold && (
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
        )}
        {config.italic && (
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
        )}
        {config.underline && (
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
        )}
        {config.strike && (
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Strikethrough"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarButton>
        )}
        {config.subscript && (
          <ToolbarButton
            onClick={() => (editor.chain().focus() as any).toggleSubscript().run()}
            active={editor.isActive('subscript')}
            title="Subscript (e.g. H₂O)"
          >
            <span className="font-bold text-[11px] leading-none">X<sub className="text-[9px] -bottom-0.5">2</sub></span>
          </ToolbarButton>
        )}
        {config.superscript && (
          <ToolbarButton
            onClick={() => (editor.chain().focus() as any).toggleSuperscript().run()}
            active={editor.isActive('superscript')}
            title="Superscript (e.g. cm²)"
          >
            <span className="font-bold text-[11px] leading-none">X<sup className="text-[9px] -top-1">2</sup></span>
          </ToolbarButton>
        )}
      </div>

      <Divider />

      {/* 5. Colors (Font Color & Background Highlight) */}
      <div className="flex items-center gap-1.5">
        {config.textColor && (
          <div className="relative inline-flex items-center gap-1 rounded-md border border-card-border/80 bg-background px-1.5 py-0.5 shadow-2xs">
            <span
              className="h-3.5 w-3.5 rounded-full border border-black/20"
              style={{ backgroundColor: currentTextColor === 'inherit' ? 'var(--foreground)' : currentTextColor }}
              title="Current Text Color"
            />
            <select
              value={currentTextColor}
              onChange={(e) => {
                const color = e.target.value;
                if (color === 'inherit') {
                  editor.chain().focus().unsetColor().run();
                } else {
                  editor.chain().focus().setColor(color).run();
                }
              }}
              className="h-6 max-w-[95px] bg-transparent text-xs font-semibold text-foreground focus:outline-hidden"
              title="Change Text Color"
            >
              {TEXT_COLORS.map((c) => (
                <option
                  key={c.value}
                  value={c.value}
                  style={{ color: c.hex, backgroundColor: 'var(--card)' }}
                >
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {config.highlight && (
          <div className="relative inline-flex items-center gap-1 rounded-md border border-card-border/80 bg-background px-1.5 py-0.5 shadow-2xs">
            <Highlighter className="h-3.5 w-3.5 text-amber-500" />
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
              className="h-6 max-w-[85px] bg-transparent text-xs text-foreground focus:outline-hidden"
              title="Highlight Marker"
              defaultValue="none"
            >
              {BG_COLORS.map((c) => (
                <option
                  key={c.value}
                  value={c.value}
                  style={{ backgroundColor: c.hex, color: c.value === 'none' ? 'inherit' : '#0f172a' }}
                >
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 6. Alignment & Lists */}
      {(config.align || config.lists) && <Divider />}

      {config.align && (
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            active={editor.isActive({ textAlign: 'left' })}
            title="Align Left"
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={editor.isActive({ textAlign: 'center' })}
            title="Align Center"
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            active={editor.isActive({ textAlign: 'right' })}
            title="Align Right"
          >
            <AlignRight className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            active={editor.isActive({ textAlign: 'justify' })}
            title="Justify Text"
          >
            <AlignJustify className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>
      )}

      {config.lists && (
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Numbered List"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>
      )}

      {/* 7. Quick Phrases / Snippets */}
      {config.snippets && !compact && (
        <>
          <Divider />
          <div className="relative inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs text-primary transition hover:bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleInsertSnippet(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="h-6 max-w-[150px] bg-transparent text-xs font-semibold text-primary focus:outline-hidden"
              title="Insert Common Endoscopy Phrase"
            >
              <option value="" disabled className="text-foreground bg-card">
                ⚡ Quick Medical Phrases...
              </option>
              {MEDICAL_SNIPPETS.map((snip) => (
                <option key={snip.label} value={snip.text} className="text-foreground bg-card">
                  {snip.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* 8. Dividers & Clear Format */}
      <Divider />
      {config.horizontalRule && (
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule (Divider Line)"
        >
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>
      )}

      {config.clearFormat && (
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          title="Clear All Formatting"
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </ToolbarButton>
      )}
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
  compact = false,
}: RichTextEditorProps) {
  const editorConfig = useMemo(() => getEditorConfig(), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: editorConfig.headings ? { levels: [1, 2, 3] } : false,
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontSize,
      FontFamily,
      Subscript,
      Superscript,
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
          'tiptap max-w-none focus:outline-hidden px-3.5 py-2.5 text-foreground leading-relaxed',
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
        className={cn('rounded-xl border border-card-border bg-card shadow-2xs', className)}
        style={{ minHeight }}
      />
    );
  }

  // Word & character stats
  const textContent = editor.getText();
  const charCount = textContent.length;
  const wordCount = textContent.trim() ? textContent.trim().split(/\s+/).length : 0;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-card-border bg-card text-foreground shadow-2xs transition focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20',
        className,
      )}
    >
      {!disabled && <WordToolbar editor={editor} config={editorConfig} compact={compact} />}
      <div className="relative">
        <EditorContent editor={editor} />
        {placeholder && editor.isEmpty && !disabled && (
          <div className="pointer-events-none absolute top-2.5 left-3.5 text-sm text-muted-foreground/70 select-none">
            {placeholder}
          </div>
        )}
      </div>

      {/* Editor Stats Bar (Footer) */}
      {editorConfig.stats && !disabled && !compact && (
        <div className="flex items-center justify-between border-t border-card-border/50 bg-muted/30 px-3 py-1 text-[10px] text-muted-foreground">
          <span>Standard Medical Documentation Editor</span>
          <div className="flex items-center gap-2.5">
            <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
            <span>·</span>
            <span>{charCount} characters</span>
          </div>
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
