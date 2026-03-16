'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useEditor, EditorContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import FontFamily from '@tiptap/extension-font-family'
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { pendingImages } from '@/lib/image-sync'
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Upload,
  Heading1, Heading2, Palette, Undo, Redo, Trash2,
} from 'lucide-react'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
}

const COLORS = ['#000000', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1']

const FONT_SIZES = [
  { label: 'Small', value: '0.8rem' },
  { label: 'Normal', value: '1rem' },
  { label: 'Large', value: '1.2rem' },
  { label: 'XL', value: '1.5rem' },
  { label: '2XL', value: '2rem' },
]

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Segoe UI', value: 'Segoe UI, sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Trebuchet', value: 'Trebuchet MS, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Palatino', value: 'Palatino Linotype, Palatino, serif' },
  { label: 'Cambria', value: 'Cambria, serif' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, sans-serif' },
  { label: 'Comic Sans', value: 'Comic Sans MS, cursive' },
  { label: 'Segoe Print', value: 'Segoe Print, cursive' },
  { label: 'Consolas', value: 'Consolas, Lucida Console, monospace' },
]

const ALIGN_MAP: Record<string, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
}

// ── ResizableImage Node View ──────────────────────────────────────────────
function ResizableImageView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected } = props
  const [resizing, setResizing] = useState(false)
  const startX = useRef(0)
  const startW = useRef(0)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing(true)
    startX.current = e.clientX
    startW.current = imgRef.current?.offsetWidth || node.attrs.width || 300
  }, [node.attrs.width])

  useEffect(() => {
    if (!resizing) return
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX.current
      const newWidth = Math.max(100, startW.current + diff)
      updateAttributes({ width: newWidth })
    }
    const handleMouseUp = () => setResizing(false)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing, updateAttributes])

  const align = node.attrs.textAlign || 'left'

  return (
    <NodeViewWrapper
      as="div"
      style={{ display: 'flex', justifyContent: ALIGN_MAP[align] || 'flex-start', lineHeight: 0 }}
    >
      <div style={{ position: 'relative', display: 'inline-block', outline: selected ? '2px solid var(--primary-500)' : 'none', borderRadius: 'var(--radius-sm)' }}>
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          width={node.attrs.width || undefined}
          style={{ maxWidth: '100%', height: 'auto', display: 'block', borderRadius: 'var(--radius-sm)' }}
          draggable={false}
        />
        {selected && (
          <>
            {/* Delete button */}
            <button
              type="button"
              onClick={deleteNode}
              style={{
                position: 'absolute', top: 6, right: 6,
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(239,68,68,0.9)', border: 'none',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Delete image"
            >
              <Trash2 size={14} />
            </button>
            {/* Resize handle */}
            <div
              onMouseDown={handleMouseDown}
              style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 16, height: 16, cursor: 'nwse-resize',
                background: 'var(--primary-500)', borderRadius: '2px 0 var(--radius-sm) 0',
              }}
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ── Custom Resizable Image Extension ──────────────────────────────────────
const ResizableImage = Node.create({
  name: 'resizableImage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      width: { default: null },
      textAlign: {
        default: 'left',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-text-align') || element.style.textAlign || 'left',
        renderHTML: (attributes: Record<string, unknown>) => {
          return { 'data-text-align': attributes.textAlign || 'left' }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'img[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const align = (HTMLAttributes['data-text-align'] as string) || 'left'
    return ['div', { style: `text-align: ${align}` }, ['img', mergeAttributes(HTMLAttributes, { style: `max-width: 100%` })]]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },
})

// ── Font Size Extension (uses inline style via TextStyle) ─────────────────
const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.fontSize) return {}
          return { style: `font-size: ${attributes.fontSize}` }
        },
      },
    }
  },
})

export default function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const [showColors, setShowColors] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cursorPosRef = useRef<number | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      FontSize,
      Color,
      FontFamily,
      ResizableImage,
      TextAlign.configure({ types: ['heading', 'paragraph', 'resizableImage'] }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'rte-content',
        style: 'min-height: 200px; padding: 16px; outline: none; font-size: 0.9rem; line-height: 1.6; color: var(--text-primary);',
      },
    },
  })

  if (!editor) return null

  function handleUploadClick() {
    // Save cursor position before file dialog steals focus
    cursorPosRef.current = editor?.state.selection.anchor ?? null
    fileRef.current?.click()
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    e.target.value = ''

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.type)) return

    // Create a temporary blob URL (not uploaded yet — uploaded on Save)
    const blobUrl = URL.createObjectURL(file)
    pendingImages.set(blobUrl, file)

    // Restore cursor position, then insert at that point
    const pos = cursorPosRef.current
    if (pos !== null && pos >= 0 && pos <= editor.state.doc.content.size) {
      editor.chain().focus().setTextSelection(pos).insertContent({
        type: 'resizableImage',
        attrs: { src: blobUrl, alt: file.name, width: null, textAlign: 'left' },
      }).run()
    } else {
      editor.chain().focus().insertContent({
        type: 'resizableImage',
        attrs: { src: blobUrl, alt: file.name, width: null, textAlign: 'left' },
      }).run()
    }
  }

  // Determine the explicitly-set alignment of the current selection (null = default/unset)
  function getActiveAlign(): string | null {
    if (!editor) return null
    const { selection } = editor.state
    // Node selection (e.g. selected image)
    const nodeSel = selection as unknown as { node?: { type?: { name?: string }; attrs?: Record<string, unknown> } }
    if (nodeSel.node?.type?.name === 'resizableImage') {
      return (nodeSel.node.attrs?.textAlign as string) || null
    }
    // Text selection: check the resolved node at the anchor
    const resolvedPos = selection.$anchor
    const node = resolvedPos.parent
    const align = node.attrs?.textAlign as string | undefined
    // Only return if the node actually has an explicit textAlign attribute set
    if (align && node.type.spec.attrs && 'textAlign' in node.type.spec.attrs) {
      return align
    }
    return null
  }

  const activeAlign = getActiveAlign()

  // Alignment for images: when a resizableImage is selected, apply alignment to it
  function handleAlign(align: 'left' | 'center' | 'right') {
    if (!editor) return
    const { node } = editor.state.selection as unknown as { node?: { type?: { name?: string } } }
    if (node?.type?.name === 'resizableImage') {
      editor.chain().focus().updateAttributes('resizableImage', { textAlign: align }).run()
    } else {
      editor.chain().focus().setTextAlign(align).run()
    }
  }

  function setFontSize(size: string) {
    if (!editor) return
    if (size) {
      editor.chain().focus().setMark('textStyle', { fontSize: size }).run()
    } else {
      editor.chain().focus().unsetMark('textStyle').run()
    }
  }

  function setFont(family: string) {
    if (!editor) return
    if (family) {
      editor.chain().focus().setFontFamily(family).run()
    } else {
      editor.chain().focus().unsetFontFamily().run()
    }
  }

  const ToolBtn = ({ active, onClick, children, title, disabled }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string; disabled?: boolean }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', borderRadius: 'var(--radius-sm)', cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? 'var(--primary-500)' : 'transparent',
        color: active ? '#fff' : disabled ? 'var(--text-disabled)' : 'var(--text-secondary)',
        transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => { if (!active && !disabled) (e.target as HTMLElement).style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { if (!active && !disabled) (e.target as HTMLElement).style.background = 'transparent' }}
    >
      {children}
    </button>
  )

  const selectStyle: React.CSSProperties = {
    height: 28, padding: '0 4px', fontSize: '0.7rem', fontWeight: 500,
    background: 'var(--bg-primary)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer',
    maxWidth: '120px',
  }

  const Sep = () => <div style={{ width: 1, background: 'var(--border-default)', margin: '4px 3px', flexShrink: 0 }} />

  return (
    <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Toolbar – single row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '5px 6px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-secondary)', alignItems: 'center' }}>
        {/* Font family */}
        <select style={selectStyle} onChange={e => setFont(e.target.value)} defaultValue="" title="Font Family">
          {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        {/* Font size */}
        <select style={selectStyle} onChange={e => setFontSize(e.target.value)} defaultValue="" title="Font Size">
          <option value="">Default</option>
          {FONT_SIZES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <Sep />
        <ToolBtn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolBtn>
        <ToolBtn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolBtn>
        <ToolBtn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolBtn>
        <Sep />
        <ToolBtn title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={15} /></ToolBtn>
        <ToolBtn title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></ToolBtn>
        <Sep />
        <ToolBtn title="Bullet List" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolBtn>
        <ToolBtn title="Ordered List" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolBtn>
        <Sep />
        <ToolBtn title="Align Left" active={activeAlign === 'left'} onClick={() => handleAlign('left')}><AlignLeft size={15} /></ToolBtn>
        <ToolBtn title="Align Center" active={activeAlign === 'center'} onClick={() => handleAlign('center')}><AlignCenter size={15} /></ToolBtn>
        <ToolBtn title="Align Right" active={activeAlign === 'right'} onClick={() => handleAlign('right')}><AlignRight size={15} /></ToolBtn>
        <Sep />
        {/* Image upload */}
        <ToolBtn title="Upload Image" onClick={handleUploadClick}>
          <Upload size={15} />
        </ToolBtn>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" hidden onChange={handleImageUpload} />
        {/* Color picker */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <ToolBtn title="Text Color" onClick={() => setShowColors(!showColors)}><Palette size={15} /></ToolBtn>
          {showColors && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, display: 'flex', padding: 6, background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', gap: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => { editor.chain().focus().setColor(c).run(); setShowColors(false) }}
                  style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: '2px solid var(--border-default)', cursor: 'pointer' }} />
              ))}
            </div>
          )}
        </div>
        <Sep />
        <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo size={15} /></ToolBtn>
        <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo size={15} /></ToolBtn>
      </div>
      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}

