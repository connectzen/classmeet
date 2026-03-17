'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  strokeWidth: number
  onStrokeWidthChange: (width: number) => void
  textOptions: TextOptions
  onTextOptionsChange: (opts: TextOptions) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  canUndo: boolean
  canRedo: boolean
  toolbarVisible: boolean
  onToggleToolbar: () => void
  hasSelection: boolean
}

const COLORS = [
  '#ffffff', '#ef4444', '#f97316', '#facc15',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
]

const STROKE_SIZES = [
  { label: 'S', value: 2 },
  { label: 'M', value: 4 },
  { label: 'L', value: 7 },
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
  strokeWidth,
  onStrokeWidthChange,
  textOptions,
  onTextOptionsChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  toolbarVisible,
  onToggleToolbar,
  hasSelection,
}: BlackboardToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [isMobileView, setIsMobileView] = useState(false)
  const [showTextPanel, setShowTextPanel] = useState(false)
  const textPanelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Schedule text panel auto-hide after 3s inactivity
  const scheduleTextPanelHide = useCallback(() => {
    if (textPanelTimerRef.current) clearTimeout(textPanelTimerRef.current)
    textPanelTimerRef.current = setTimeout(() => setShowTextPanel(false), 3000)
  }, [])

  // Open/close text panel when text tool is activated on mobile
  useEffect(() => {
    if (activeTool === 'text' && isMobileView) {
      setShowTextPanel(true)
      scheduleTextPanelHide()
    } else {
      setShowTextPanel(false)
      if (textPanelTimerRef.current) clearTimeout(textPanelTimerRef.current)
    }
  }, [activeTool, isMobileView, scheduleTextPanelHide])

  const tools: { tool: DrawingTool; icon: React.ReactNode; label: string }[] = [
    { tool: 'select', icon: <MousePointer2 size={15} />, label: 'Select & Move' },
    { tool: 'pen', icon: <Pencil size={15} />, label: 'Pen' },
    { tool: 'line', icon: <Minus size={15} />, label: 'Line' },
    { tool: 'rect', icon: <Square size={15} />, label: 'Rectangle' },
    { tool: 'circle', icon: <Circle size={15} />, label: 'Circle' },
    { tool: 'highlighter', icon: <Highlighter size={15} />, label: 'Highlighter' },
    { tool: 'eraser', icon: <Eraser size={15} />, label: 'Eraser' },
    { tool: 'text', icon: <Type size={15} />, label: 'Text' },
  ]

  return (
    <>
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
                <Palette size={15} />
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

            {/* Stroke size — visible for drawing tools */}
            {['pen', 'line', 'rect', 'circle', 'highlighter', 'eraser'].includes(activeTool) && (
              <div className="room-bb-tool-group room-bb-size-group">
                {STROKE_SIZES.map(s => (
                  <button
                    key={s.value}
                    className={`room-bb-size-btn ${strokeWidth === s.value ? 'room-bb-size-active' : ''}`}
                    onClick={() => onStrokeWidthChange(s.value)}
                    title={`${s.label === 'S' ? 'Small' : s.label === 'M' ? 'Medium' : 'Large'} stroke`}
                  >
                    <span
                      className="room-bb-size-dot"
                      style={{ width: s.value * 2, height: s.value * 2 }}
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="room-bb-divider" />

            {/* Undo / Redo / Clear */}
            <div className="room-bb-tool-group">
              <button className="room-bb-tool-btn" onClick={onUndo} disabled={!canUndo} title="Undo">
                <Undo2 size={15} />
              </button>
              <button className="room-bb-tool-btn" onClick={onRedo} disabled={!canRedo} title="Redo">
                <Redo2 size={15} />
              </button>
              <button
                className="room-bb-tool-btn room-bb-tool-danger"
                onClick={onClear}
                title={hasSelection ? 'Delete selected' : 'Clear board'}
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* ── Text formatting sub-toolbar — desktop only ── */}
            {activeTool === 'text' && !isMobileView && (
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
                    <Bold size={15} />
                  </button>

                  {/* Italic */}
                  <button
                    className={`room-bb-tool-btn ${textOptions.italic ? 'room-bb-tool-active' : ''}`}
                    onClick={() => onTextOptionsChange({ ...textOptions, italic: !textOptions.italic })}
                    title="Italic"
                  >
                    <Italic size={15} />
                  </button>

                  {/* Underline */}
                  <button
                    className={`room-bb-tool-btn ${textOptions.underline ? 'room-bb-tool-active' : ''}`}
                    onClick={() => onTextOptionsChange({ ...textOptions, underline: !textOptions.underline })}
                    title="Underline"
                  >
                    <UnderlineIcon size={15} />
                  </button>

                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Mobile: floating vertical text options panel ── */}
      {isMobileView && showTextPanel && (
        <div
          className="room-bb-text-panel-mobile"
          onPointerDown={scheduleTextPanelHide}
        >
          <div className="room-bb-text-panel-title">Text Options</div>
          <select
            className="room-bb-select"
            style={{ width: '100%' }}
            value={textOptions.fontFamily}
            onChange={e => { onTextOptionsChange({ ...textOptions, fontFamily: e.target.value }); scheduleTextPanelHide() }}
            title="Font Family"
          >
            {FONT_FAMILIES.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            className="room-bb-select"
            style={{ width: '100%' }}
            value={textOptions.fontSize}
            onChange={e => { onTextOptionsChange({ ...textOptions, fontSize: Number(e.target.value) }); scheduleTextPanelHide() }}
            title="Font Size"
          >
            {FONT_SIZES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <div className="room-bb-text-panel-row">
            <button
              className={`room-bb-tool-btn ${textOptions.bold ? 'room-bb-tool-active' : ''}`}
              onClick={() => { onTextOptionsChange({ ...textOptions, bold: !textOptions.bold }); scheduleTextPanelHide() }}
              title="Bold"
            ><Bold size={16} /></button>
            <button
              className={`room-bb-tool-btn ${textOptions.italic ? 'room-bb-tool-active' : ''}`}
              onClick={() => { onTextOptionsChange({ ...textOptions, italic: !textOptions.italic }); scheduleTextPanelHide() }}
              title="Italic"
            ><Italic size={16} /></button>
            <button
              className={`room-bb-tool-btn ${textOptions.underline ? 'room-bb-tool-active' : ''}`}
              onClick={() => { onTextOptionsChange({ ...textOptions, underline: !textOptions.underline }); scheduleTextPanelHide() }}
              title="Underline"
            ><UnderlineIcon size={16} /></button>
          </div>
        </div>
      )}
    </>
  )
}
