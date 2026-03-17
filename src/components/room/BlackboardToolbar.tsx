'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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
  { label: 'Small',  value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Large',  value: 7 },
]

const FONT_SIZES = [
  { label: 'Small',  value: 16 },
  { label: 'Normal', value: 24 },
  { label: 'Large',  value: 32 },
  { label: 'XL',     value: 40 },
  { label: '2XL',    value: 56 },
]

const FONT_FAMILIES = [
  { label: 'Courier New',   value: 'Courier New, monospace' },
  { label: 'Arial',         value: 'Arial, sans-serif' },
  { label: 'Calibri',       value: 'Calibri, sans-serif' },
  { label: 'Segoe UI',      value: 'Segoe UI, sans-serif' },
  { label: 'Verdana',       value: 'Verdana, sans-serif' },
  { label: 'Trebuchet',     value: 'Trebuchet MS, sans-serif' },
  { label: 'Georgia',       value: 'Georgia, serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Palatino',      value: 'Palatino Linotype, Palatino, serif' },
  { label: 'Cambria',       value: 'Cambria, serif' },
  { label: 'Impact',        value: 'Impact, Haettenschweiler, sans-serif' },
  { label: 'Comic Sans',    value: 'Comic Sans MS, cursive' },
  { label: 'Segoe Print',   value: 'Segoe Print, cursive' },
  { label: 'Consolas',      value: 'Consolas, Lucida Console, monospace' },
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
  const [showSizePicker, setShowSizePicker] = useState(false)
  const [isMobileView, setIsMobileView] = useState(false)
  // Text panel: open when T is active on mobile; closed by hover-leave or T toggle
  const [showTextPanel, setShowTextPanel] = useState(false)
  // Track whether cursor has entered the text panel (for hover-to-close)
  const textPanelEnteredRef = useRef(false)

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Auto-open text panel on mobile when text tool becomes active; close when deactivated
  useEffect(() => {
    if (activeTool === 'text' && isMobileView) {
      textPanelEnteredRef.current = false
      setShowTextPanel(true)
    } else {
      setShowTextPanel(false)
    }
  }, [activeTool, isMobileView])

  // T button: toggle text tool on/off (clicking active T switches back to pen)
  const handleTextToolClick = () => {
    if (activeTool === 'text') {
      onToolChange('pen')
    } else {
      onToolChange('text')
    }
  }

  // Text panel: cursor entered — start tracking so leave will close it
  const handleTextPanelEnter = () => {
    textPanelEnteredRef.current = true
  }

  // Text panel: cursor left after entering — close the panel
  const handleTextPanelLeave = () => {
    if (textPanelEnteredRef.current) {
      textPanelEnteredRef.current = false
      setShowTextPanel(false)
    }
  }

  const drawingTools: { tool: DrawingTool; icon: React.ReactNode; label: string }[] = [
    { tool: 'select',      icon: <MousePointer2 size={15} />, label: 'Select & Move' },
    { tool: 'pen',         icon: <Pencil size={15} />,        label: 'Pen' },
    { tool: 'line',        icon: <Minus size={15} />,         label: 'Line' },
    { tool: 'rect',        icon: <Square size={15} />,        label: 'Rectangle' },
    { tool: 'circle',      icon: <Circle size={15} />,        label: 'Circle' },
    { tool: 'highlighter', icon: <Highlighter size={15} />,   label: 'Highlighter' },
    { tool: 'eraser',      icon: <Eraser size={15} />,        label: 'Eraser' },
  ]

  const isDrawingTool = ['pen', 'line', 'rect', 'circle', 'highlighter', 'eraser'].includes(activeTool)
  const currentSize = STROKE_SIZES.find(s => s.value === strokeWidth) ?? STROKE_SIZES[1]

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

            {/* Drawing tools (all except text) */}
            <div className="room-bb-tool-group">
              {drawingTools.map(({ tool, icon, label }) => (
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

            {/* Text tool — separate, toggleable */}
            <button
              className={`room-bb-tool-btn ${activeTool === 'text' ? 'room-bb-tool-active' : ''}`}
              onClick={handleTextToolClick}
              title={activeTool === 'text' ? 'Deactivate text tool' : 'Text'}
            >
              <Type size={15} />
            </button>

            <div className="room-bb-divider" />

            {/* Color picker */}
            <div className="room-bb-tool-group" style={{ position: 'relative' }}>
              <button
                className="room-bb-tool-btn"
                onClick={() => setShowColorPicker(v => !v)}
                title="Color"
              >
                <Palette size={15} />
                <span className="room-bb-color-dot" style={{ backgroundColor: strokeColor }} />
              </button>

              {/* Desktop: render popup inside toolbar */}
              {showColorPicker && !isMobileView && (
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

            {/* Stroke size dropdown — only for drawing tools */}
            {isDrawingTool && (
              <div style={{ position: 'relative' }}>
                <button
                  className={`room-bb-tool-btn ${showSizePicker ? 'room-bb-tool-active' : ''}`}
                  onClick={() => setShowSizePicker(v => !v)}
                  title={`Stroke: ${currentSize.label}`}
                >
                  <span
                    className="room-bb-size-dot"
                    style={{ width: strokeWidth * 2, height: strokeWidth * 2 }}
                  />
                </button>

                {/* Desktop: render popup inside toolbar */}
                {showSizePicker && !isMobileView && (
                  <div className="room-bb-size-picker">
                    {STROKE_SIZES.map(s => (
                      <button
                        key={s.value}
                        className={`room-bb-size-picker-item ${strokeWidth === s.value ? 'room-bb-size-picker-active' : ''}`}
                        onClick={() => { onStrokeWidthChange(s.value); setShowSizePicker(false) }}
                      >
                        <span
                          className="room-bb-size-dot"
                          style={{ width: s.value * 2, height: s.value * 2, flexShrink: 0 }}
                        />
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
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

            {/* Text formatting options — inline on desktop */}
            {activeTool === 'text' && !isMobileView && (
              <>
                <div className="room-bb-divider" />
                <div className="room-bb-tool-group room-bb-text-options">
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
                  <button
                    className={`room-bb-tool-btn ${textOptions.bold ? 'room-bb-tool-active' : ''}`}
                    onClick={() => onTextOptionsChange({ ...textOptions, bold: !textOptions.bold })}
                    title="Bold"
                  ><Bold size={15} /></button>
                  <button
                    className={`room-bb-tool-btn ${textOptions.italic ? 'room-bb-tool-active' : ''}`}
                    onClick={() => onTextOptionsChange({ ...textOptions, italic: !textOptions.italic })}
                    title="Italic"
                  ><Italic size={15} /></button>
                  <button
                    className={`room-bb-tool-btn ${textOptions.underline ? 'room-bb-tool-active' : ''}`}
                    onClick={() => onTextOptionsChange({ ...textOptions, underline: !textOptions.underline })}
                    title="Underline"
                  ><UnderlineIcon size={15} /></button>
                </div>
              </>
            )}

          </div>
        )}
      </div>

      {/* ── Mobile: portaled popups to escape overflow:hidden and backdrop-filter ── */}
      {isMobileView && showColorPicker && createPortal(
        <div className="room-bb-color-picker room-bb-popup-mobile">
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
        </div>,
        document.body,
      )}

      {isMobileView && showSizePicker && isDrawingTool && createPortal(
        <div className="room-bb-size-picker room-bb-popup-mobile">
          {STROKE_SIZES.map(s => (
            <button
              key={s.value}
              className={`room-bb-size-picker-item ${strokeWidth === s.value ? 'room-bb-size-picker-active' : ''}`}
              onClick={() => { onStrokeWidthChange(s.value); setShowSizePicker(false) }}
            >
              <span
                className="room-bb-size-dot"
                style={{ width: s.value * 2, height: s.value * 2, flexShrink: 0 }}
              />
              <span>{s.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}

      {/* ── Mobile: floating vertical text options panel ─────────────────────── */}
      {isMobileView && showTextPanel && (
        <div
          className="room-bb-text-panel-mobile"
          onMouseEnter={handleTextPanelEnter}
          onMouseLeave={handleTextPanelLeave}
        >
          <div className="room-bb-text-panel-title">Text Options</div>
          <select
            className="room-bb-select"
            style={{ width: '100%' }}
            value={textOptions.fontFamily}
            onChange={e => onTextOptionsChange({ ...textOptions, fontFamily: e.target.value })}
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
            onChange={e => onTextOptionsChange({ ...textOptions, fontSize: Number(e.target.value) })}
            title="Font Size"
          >
            {FONT_SIZES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <div className="room-bb-text-panel-row">
            <button
              className={`room-bb-tool-btn ${textOptions.bold ? 'room-bb-tool-active' : ''}`}
              onClick={() => onTextOptionsChange({ ...textOptions, bold: !textOptions.bold })}
              title="Bold"
            ><Bold size={16} /></button>
            <button
              className={`room-bb-tool-btn ${textOptions.italic ? 'room-bb-tool-active' : ''}`}
              onClick={() => onTextOptionsChange({ ...textOptions, italic: !textOptions.italic })}
              title="Italic"
            ><Italic size={16} /></button>
            <button
              className={`room-bb-tool-btn ${textOptions.underline ? 'room-bb-tool-active' : ''}`}
              onClick={() => onTextOptionsChange({ ...textOptions, underline: !textOptions.underline })}
              title="Underline"
            ><UnderlineIcon size={16} /></button>
          </div>
        </div>
      )}
    </>
  )
}
