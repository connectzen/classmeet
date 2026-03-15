'use client'

import { useState } from 'react'
import type { DrawingTool, TextOptions } from './Blackboard'
import {
  Pencil, Minus, Square, Circle, Highlighter, Eraser, Type, MousePointer2,
  Undo2, Redo2, Trash2, Palette, ChevronDown,
  Bold, Italic, Underline as UnderlineIcon,
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
  toolbarVisible: boolean
  onToggleToolbar: () => void
}

const COLORS = [
  '#ffffff', '#ef4444', '#f97316', '#facc15',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
]

const FONT_SIZES = [
  { label: 'Small', value: 16 },
  { label: 'Normal', value: 24 },
  { label: 'Large', value: 32 },
  { label: 'XL', value: 40 },
  { label: '2XL', value: 56 },
]

const FONT_FAMILIES = [
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
  toolbarVisible,
  onToggleToolbar,
}: BlackboardToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)

  const tools: { tool: DrawingTool; icon: React.ReactNode; label: string }[] = [
    { tool: 'select', icon: <MousePointer2 size={16} />, label: 'Select & Move' },
    { tool: 'pen', icon: <Pencil size={16} />, label: 'Pen' },
    { tool: 'line', icon: <Minus size={16} />, label: 'Line' },
    { tool: 'rect', icon: <Square size={16} />, label: 'Rectangle' },
    { tool: 'circle', icon: <Circle size={16} />, label: 'Circle' },
    { tool: 'highlighter', icon: <Highlighter size={16} />, label: 'Highlighter' },
    { tool: 'eraser', icon: <Eraser size={16} />, label: 'Eraser' },
    { tool: 'text', icon: <Type size={16} />, label: 'Text' },
  ]

  return (
    <div className="room-bb-toolbar">
      {/* Toggle button — always visible */}
      <button
        className="room-bb-toggle"
        onClick={onToggleToolbar}
        title={toolbarVisible ? 'Hide toolbar' : 'Show toolbar'}
      >
        {toolbarVisible ? <ChevronDown size={18} /> : <Pencil size={18} />}
      </button>

      {/* Main toolbar */}
      {toolbarVisible && (
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

          <div className="room-bb-divider" />

          {/* Color picker */}
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

          {/* ── Text formatting sub-toolbar (Lessons editor style) ──── */}
          {activeTool === 'text' && (
            <>
              <div className="room-bb-divider" />
              <div className="room-bb-tool-group room-bb-text-options">
                {/* Font family */}
                <select
                  className="room-bb-select"
                  value={textOptions.fontFamily}
                  onChange={e => onTextOptionsChange({ ...textOptions, fontFamily: e.target.value })}
                  title="Font Family"
                >
                  {FONT_FAMILIES.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>

                {/* Font size */}
                <select
                  className="room-bb-select"
                  value={textOptions.fontSize}
                  onChange={e => onTextOptionsChange({ ...textOptions, fontSize: Number(e.target.value) })}
                  title="Font Size"
                >
                  {FONT_SIZES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                <div className="room-bb-divider" />

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

                {/* Underline */}
                <button
                  className={`room-bb-tool-btn ${textOptions.underline ? 'room-bb-tool-active' : ''}`}
                  onClick={() => onTextOptionsChange({ ...textOptions, underline: !textOptions.underline })}
                  title="Underline"
                >
                  <UnderlineIcon size={16} />
                </button>

              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
