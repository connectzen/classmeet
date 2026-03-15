'use client'

import { useState, useRef } from 'react'
import type { DrawingTool, TextOptions } from './Blackboard'
import {
  Pencil, Minus, Square, Highlighter, Eraser, Type,
  Undo2, Redo2, Trash2, Palette, ChevronUp,
  Bold, Italic,
} from 'lucide-react'

interface BlackboardToolbarProps {
  activeTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  strokeColor: string
  onColorChange: (color: string) => void
  textOptions: TextOptions
  onTextOptionsChange: (opts: TextOptions) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  canUndo: boolean
  canRedo: boolean
}

const COLORS = [
  '#ffffff', '#ef4444', '#f97316', '#facc15',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
]

const FONT_SIZES = [16, 20, 24, 32, 40, 56]

export default function BlackboardToolbar({
  activeTool,
  onToolChange,
  strokeColor,
  onColorChange,
  textOptions,
  onTextOptionsChange,
  onUndo,
  onRedo,
  onClear,
}: BlackboardToolbarProps) {
  const [expanded, setExpanded] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current)
      collapseTimer.current = null
    }
    setExpanded(true)
  }

  const handleMouseLeave = () => {
    collapseTimer.current = setTimeout(() => {
      setExpanded(false)
      setShowColorPicker(false)
    }, 600)
  }

  const tools: { tool: DrawingTool; icon: React.ReactNode; label: string }[] = [
    { tool: 'select', icon: <ChevronUp size={16} />, label: 'Select' },
    { tool: 'pen', icon: <Pencil size={16} />, label: 'Pen' },
    { tool: 'line', icon: <Minus size={16} />, label: 'Line' },
    { tool: 'rect', icon: <Square size={16} />, label: 'Rectangle' },
    { tool: 'highlighter', icon: <Highlighter size={16} />, label: 'Highlighter' },
    { tool: 'eraser', icon: <Eraser size={16} />, label: 'Eraser' },
    { tool: 'text', icon: <Type size={16} />, label: 'Text' },
  ]

  return (
    <div
      className={`room-bb-toolbar ${expanded ? 'room-bb-toolbar-expanded' : 'room-bb-toolbar-collapsed'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {!expanded ? (
        /* ── Collapsed: single floating button ─────────────────────── */
        <button
          className="room-bb-toggle"
          onClick={() => setExpanded(true)}
          title="Drawing tools"
        >
          <Pencil size={18} />
        </button>
      ) : (
        /* ── Expanded toolbar ──────────────────────────────────────── */
        <div className="room-bb-toolbar-inner">
          {/* Drawing tools */}
          <div className="room-bb-tool-group">
            {tools.map(({ tool, icon, label }) => (
              <button
                key={tool}
                className={`room-bb-tool-btn ${activeTool === tool ? 'room-bb-tool-active' : ''}`}
                onClick={() => onToolChange(tool)}
                title={label}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="room-bb-divider" />

          {/* Color picker toggle */}
          <div className="room-bb-tool-group" style={{ position: 'relative' }}>
            <button
              className="room-bb-tool-btn"
              onClick={() => setShowColorPicker(v => !v)}
              title="Color"
            >
              <Palette size={16} />
              <span
                className="room-bb-color-dot"
                style={{ backgroundColor: strokeColor }}
              />
            </button>

            {showColorPicker && (
              <div className="room-bb-color-picker">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={`room-bb-color-swatch ${strokeColor === c ? 'room-bb-color-swatch-active' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => { onColorChange(c); setShowColorPicker(false) }}
                    title={c}
                  />
                ))}
                <input
                  type="color"
                  value={strokeColor}
                  onChange={e => { onColorChange(e.target.value); setShowColorPicker(false) }}
                  className="room-bb-color-input"
                  title="Custom color"
                />
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="room-bb-divider" />

          {/* Undo / Redo / Clear */}
          <div className="room-bb-tool-group">
            <button className="room-bb-tool-btn" onClick={onUndo} title="Undo">
              <Undo2 size={16} />
            </button>
            <button className="room-bb-tool-btn" onClick={onRedo} title="Redo">
              <Redo2 size={16} />
            </button>
            <button className="room-bb-tool-btn room-bb-tool-danger" onClick={onClear} title="Clear board">
              <Trash2 size={16} />
            </button>
          </div>

          {/* ── Text options sub-toolbar ─────────────────────────── */}
          {activeTool === 'text' && (
            <>
              <div className="room-bb-divider" />
              <div className="room-bb-tool-group room-bb-text-options">
                {/* Font size */}
                <select
                  className="room-bb-select"
                  value={textOptions.fontSize}
                  onChange={e => onTextOptionsChange({ ...textOptions, fontSize: Number(e.target.value) })}
                  title="Font size"
                >
                  {FONT_SIZES.map(s => (
                    <option key={s} value={s}>{s}px</option>
                  ))}
                </select>

                {/* Bold */}
                <button
                  className={`room-bb-tool-btn ${textOptions.bold ? 'room-bb-tool-active' : ''}`}
                  onClick={() => onTextOptionsChange({ ...textOptions, bold: !textOptions.bold })}
                  title="Bold"
                >
                  <Bold size={16} />
                </button>

                {/* Italic */}
                <button
                  className={`room-bb-tool-btn ${textOptions.italic ? 'room-bb-tool-active' : ''}`}
                  onClick={() => onTextOptionsChange({ ...textOptions, italic: !textOptions.italic })}
                  title="Italic"
                >
                  <Italic size={16} />
                </button>

                {/* Text color */}
                <input
                  type="color"
                  value={textOptions.color}
                  onChange={e => onTextOptionsChange({ ...textOptions, color: e.target.value })}
                  className="room-bb-color-input"
                  title="Text color"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
