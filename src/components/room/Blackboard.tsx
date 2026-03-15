'use client'

import { useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from 'react'
import * as fabric from 'fabric'
import BlackboardToolbar from './BlackboardToolbar'

// ── Types ────────────────────────────────────────────────────────────────────
export type BlackboardEvent =
  | { type: 'activate' }
  | { type: 'deactivate' }
  | { type: 'snapshot'; data: string }
  | { type: 'object-added'; data: string; id: string }
  | { type: 'object-modified'; data: string; id: string }
  | { type: 'object-removed'; id: string }
  | { type: 'clear' }

export type DrawingTool = 'pen' | 'line' | 'rect' | 'highlighter' | 'eraser' | 'text' | 'select'

export interface TextOptions {
  fontSize: number
  bold: boolean
  italic: boolean
  color: string
}

export interface BlackboardHandle {
  getSnapshot: () => string | null
}

interface BlackboardProps {
  isHost: boolean
  onCanvasEvent?: (event: BlackboardEvent) => void
  incomingEvent?: BlackboardEvent | null
}

// ── Unique ID generator for fabric objects ───────────────────────────────────
let _objIdCounter = 0
function nextObjId() {
  return `obj_${Date.now()}_${++_objIdCounter}`
}

// ── Component ────────────────────────────────────────────────────────────────
const Blackboard = forwardRef<BlackboardHandle, BlackboardProps>(function Blackboard(
  { isHost, onCanvasEvent, incomingEvent },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const suppressEventsRef = useRef(false)

  // Drawing state
  const [activeTool, setActiveTool] = useState<DrawingTool>('pen')
  const [strokeColor, setStrokeColor] = useState('#ffffff')
  const [textOptions, setTextOptions] = useState<TextOptions>({
    fontSize: 24,
    bold: false,
    italic: false,
    color: '#ffffff',
  })

  // Shape drawing refs (line / rect)
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null)
  const activeShapeRef = useRef<fabric.Object | null>(null)

  // Undo/redo stacks
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const isUndoRedoRef = useRef(false)

  // ── Expose snapshot method to parent ─────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getSnapshot: () => {
      const canvas = fabricRef.current
      if (!canvas) return null
      return JSON.stringify(canvas.toObject(['id']))
    },
  }))

  // ── Save state for undo ──────────────────────────────────────────────────
  const saveUndoState = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || isUndoRedoRef.current) return
    undoStack.current.push(JSON.stringify(canvas.toObject(['id'])))
    if (undoStack.current.length > 50) undoStack.current.shift()
    redoStack.current = []
  }, [])

  // ── Initialize fabric canvas ─────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#1a1a2e',
      isDrawingMode: isHost,
      selection: isHost,
      width: 800,
      height: 600,
    })

    if (isHost) {
      const brush = new fabric.PencilBrush(canvas)
      brush.color = '#ffffff'
      brush.width = 3
      canvas.freeDrawingBrush = brush
    }

    fabricRef.current = canvas

    // Fit to container
    const resize = () => {
      const container = containerRef.current
      if (!container || !fabricRef.current) return
      const w = container.clientWidth
      const h = container.clientHeight
      fabricRef.current.setDimensions({ width: w, height: h })
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      canvas.dispose()
      fabricRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Host: wire up canvas events to emit changes ──────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !isHost || !onCanvasEvent) return

    const onPathCreated = (e: any) => {
      if (suppressEventsRef.current) return
      const path = e.path as fabric.FabricObject
      const id = nextObjId()
      ;(path as any).id = id
      saveUndoState()
      onCanvasEvent({ type: 'object-added', data: JSON.stringify(path.toObject(['id'])), id })
    }

    const onObjectAdded = (e: any) => {
      if (suppressEventsRef.current) return
      const obj = e.target as fabric.FabricObject
      if (!obj || (obj as any)._fromPath) return
      if (!(obj as any).id) (obj as any).id = nextObjId()
      // Path objects are handled by path:created
      if (obj.type === 'path') return
      saveUndoState()
      onCanvasEvent({ type: 'object-added', data: JSON.stringify(obj.toObject(['id'])), id: (obj as any).id })
    }

    const onObjectModified = (e: any) => {
      if (suppressEventsRef.current) return
      const obj = e.target as fabric.FabricObject
      if (!obj || !(obj as any).id) return
      saveUndoState()
      onCanvasEvent({ type: 'object-modified', data: JSON.stringify(obj.toObject(['id'])), id: (obj as any).id })
    }

    const onObjectRemoved = (e: any) => {
      if (suppressEventsRef.current) return
      const obj = e.target as fabric.FabricObject
      if (!obj || !(obj as any).id) return
      onCanvasEvent({ type: 'object-removed', id: (obj as any).id })
    }

    canvas.on('path:created', onPathCreated)
    canvas.on('object:added', onObjectAdded)
    canvas.on('object:modified', onObjectModified)
    canvas.on('object:removed', onObjectRemoved)

    return () => {
      canvas.off('path:created', onPathCreated)
      canvas.off('object:added', onObjectAdded)
      canvas.off('object:modified', onObjectModified)
      canvas.off('object:removed', onObjectRemoved)
    }
  }, [isHost, onCanvasEvent, saveUndoState])

  // ── Participant: apply incoming events ────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !incomingEvent) return

    suppressEventsRef.current = true

    switch (incomingEvent.type) {
      case 'snapshot': {
        canvas.loadFromJSON(JSON.parse(incomingEvent.data)).then(() => {
          canvas.renderAll()
          suppressEventsRef.current = false
        })
        return
      }
      case 'object-added': {
        const json = JSON.parse(incomingEvent.data)
        fabric.util.enlivenObjects([json]).then((objects) => {
          const obj = objects[0] as fabric.FabricObject | undefined
          if (obj) {
            ;(obj as any).id = incomingEvent.id
            obj.selectable = false
            obj.evented = false
            canvas.add(obj)
            canvas.renderAll()
          }
          suppressEventsRef.current = false
        })
        return
      }
      case 'object-modified': {
        const existing = canvas.getObjects().find((o: any) => o.id === incomingEvent.id)
        if (existing) {
          const json = JSON.parse(incomingEvent.data)
          existing.set(json)
          existing.setCoords()
          canvas.renderAll()
        }
        suppressEventsRef.current = false
        return
      }
      case 'object-removed': {
        const target = canvas.getObjects().find((o: any) => o.id === incomingEvent.id)
        if (target) {
          canvas.remove(target)
          canvas.renderAll()
        }
        suppressEventsRef.current = false
        return
      }
      case 'clear': {
        canvas.clear()
        canvas.backgroundColor = '#1a1a2e'
        canvas.renderAll()
        suppressEventsRef.current = false
        return
      }
    }
    suppressEventsRef.current = false
  }, [incomingEvent])

  // ── Tool switching logic ─────────────────────────────────────────────────
  const applyTool = useCallback((tool: DrawingTool) => {
    const canvas = fabricRef.current
    if (!canvas || !isHost) return
    setActiveTool(tool)

    // Reset states
    canvas.isDrawingMode = false
    canvas.selection = false
    canvas.defaultCursor = 'crosshair'
    canvas.off('mouse:down')
    canvas.off('mouse:move')
    canvas.off('mouse:up')

    switch (tool) {
      case 'select': {
        canvas.selection = true
        canvas.defaultCursor = 'default'
        canvas.forEachObject((o: fabric.FabricObject) => { o.selectable = true; o.evented = true })
        break
      }
      case 'pen': {
        canvas.isDrawingMode = true
        const brush = new fabric.PencilBrush(canvas)
        brush.color = strokeColor
        brush.width = 3
        canvas.freeDrawingBrush = brush
        break
      }
      case 'highlighter': {
        canvas.isDrawingMode = true
        const hBrush = new fabric.PencilBrush(canvas)
        // Make it semi-transparent
        const r = parseInt(strokeColor.slice(1, 3), 16)
        const g = parseInt(strokeColor.slice(3, 5), 16)
        const b = parseInt(strokeColor.slice(5, 7), 16)
        hBrush.color = `rgba(${r},${g},${b},0.35)`
        hBrush.width = 20
        canvas.freeDrawingBrush = hBrush
        break
      }
      case 'eraser': {
        canvas.isDrawingMode = true
        const eBrush = new fabric.PencilBrush(canvas)
        eBrush.color = '#1a1a2e' // same as background
        eBrush.width = 20
        canvas.freeDrawingBrush = eBrush
        break
      }
      case 'line': {
        setupLineDrawing(canvas)
        break
      }
      case 'rect': {
        setupRectDrawing(canvas)
        break
      }
      case 'text': {
        canvas.defaultCursor = 'text'
        setupTextTool(canvas)
        break
      }
    }
  }, [isHost, strokeColor])

  // ── Line drawing handlers ────────────────────────────────────────────────
  const setupLineDrawing = useCallback((canvas: fabric.Canvas) => {
    canvas.on('mouse:down', (e: any) => {
      const pointer = canvas.getViewportPoint(e.e)
      shapeStartRef.current = { x: pointer.x, y: pointer.y }
      const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
        stroke: strokeColor,
        strokeWidth: 3,
        selectable: false,
        evented: false,
      })
      ;(line as any).id = nextObjId()
      activeShapeRef.current = line
      suppressEventsRef.current = true
      canvas.add(line)
      suppressEventsRef.current = false
    })
    canvas.on('mouse:move', (e: any) => {
      if (!activeShapeRef.current || !shapeStartRef.current) return
      const pointer = canvas.getViewportPoint(e.e)
      const line = activeShapeRef.current as fabric.Line
      line.set({ x2: pointer.x, y2: pointer.y })
      canvas.renderAll()
    })
    canvas.on('mouse:up', () => {
      if (activeShapeRef.current && onCanvasEvent) {
        const obj = activeShapeRef.current as any
        saveUndoState()
        onCanvasEvent({ type: 'object-added', data: JSON.stringify(obj.toObject(['id'])), id: obj.id })
      }
      activeShapeRef.current = null
      shapeStartRef.current = null
    })
  }, [strokeColor, onCanvasEvent, saveUndoState])

  // ── Rectangle drawing handlers ───────────────────────────────────────────
  const setupRectDrawing = useCallback((canvas: fabric.Canvas) => {
    canvas.on('mouse:down', (e: any) => {
      const pointer = canvas.getViewportPoint(e.e)
      shapeStartRef.current = { x: pointer.x, y: pointer.y }
      const rect = new fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: 'transparent',
        stroke: strokeColor,
        strokeWidth: 3,
        selectable: false,
        evented: false,
      })
      ;(rect as any).id = nextObjId()
      activeShapeRef.current = rect
      suppressEventsRef.current = true
      canvas.add(rect)
      suppressEventsRef.current = false
    })
    canvas.on('mouse:move', (e: any) => {
      if (!activeShapeRef.current || !shapeStartRef.current) return
      const pointer = canvas.getViewportPoint(e.e)
      const start = shapeStartRef.current
      const rect = activeShapeRef.current as fabric.Rect
      const left = Math.min(start.x, pointer.x)
      const top = Math.min(start.y, pointer.y)
      rect.set({
        left,
        top,
        width: Math.abs(pointer.x - start.x),
        height: Math.abs(pointer.y - start.y),
      })
      canvas.renderAll()
    })
    canvas.on('mouse:up', () => {
      if (activeShapeRef.current && onCanvasEvent) {
        const obj = activeShapeRef.current as any
        saveUndoState()
        onCanvasEvent({ type: 'object-added', data: JSON.stringify(obj.toObject(['id'])), id: obj.id })
      }
      activeShapeRef.current = null
      shapeStartRef.current = null
    })
  }, [strokeColor, onCanvasEvent, saveUndoState])

  // ── Text tool handler ────────────────────────────────────────────────────
  const setupTextTool = useCallback((canvas: fabric.Canvas) => {
    canvas.on('mouse:down', (e: any) => {
      // Don't add new text if clicking on existing text
      if (e.target && e.target.type === 'i-text') return
      const pointer = canvas.getViewportPoint(e.e)
      const id = nextObjId()
      const text = new fabric.IText('', {
        left: pointer.x,
        top: pointer.y,
        fontSize: textOptions.fontSize,
        fontWeight: textOptions.bold ? 'bold' : 'normal',
        fontStyle: textOptions.italic ? 'italic' : 'normal',
        fill: textOptions.color,
        fontFamily: 'Inter, sans-serif',
        editable: true,
      })
      ;(text as any).id = id
      suppressEventsRef.current = true
      canvas.add(text)
      suppressEventsRef.current = false
      canvas.setActiveObject(text)
      text.enterEditing()

      // Emit when editing ends
      text.on('editing:exited', () => {
        if (text.text?.trim() === '') {
          canvas.remove(text)
          return
        }
        saveUndoState()
        if (onCanvasEvent) {
          onCanvasEvent({ type: 'object-added', data: JSON.stringify((text as any).toObject(['id'])), id })
        }
      })
    })
  }, [textOptions, onCanvasEvent, saveUndoState])

  // ── Color change: update active brush ────────────────────────────────────
  const handleColorChange = useCallback((color: string) => {
    setStrokeColor(color)
    const canvas = fabricRef.current
    if (!canvas) return
    if (canvas.freeDrawingBrush) {
      if (activeTool === 'highlighter') {
        const r = parseInt(color.slice(1, 3), 16)
        const g = parseInt(color.slice(3, 5), 16)
        const b = parseInt(color.slice(5, 7), 16)
        canvas.freeDrawingBrush.color = `rgba(${r},${g},${b},0.35)`
      } else {
        canvas.freeDrawingBrush.color = color
      }
    }
  }, [activeTool])

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || undoStack.current.length === 0) return
    isUndoRedoRef.current = true
    redoStack.current.push(JSON.stringify(canvas.toObject(['id'])))
    const prev = undoStack.current.pop()!
    canvas.loadFromJSON(JSON.parse(prev)).then(() => {
      canvas.renderAll()
      isUndoRedoRef.current = false
      if (onCanvasEvent) {
        onCanvasEvent({ type: 'snapshot', data: prev })
      }
    })
  }, [onCanvasEvent])

  const handleRedo = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || redoStack.current.length === 0) return
    isUndoRedoRef.current = true
    undoStack.current.push(JSON.stringify(canvas.toObject(['id'])))
    const next = redoStack.current.pop()!
    canvas.loadFromJSON(JSON.parse(next)).then(() => {
      canvas.renderAll()
      isUndoRedoRef.current = false
      if (onCanvasEvent) {
        onCanvasEvent({ type: 'snapshot', data: next })
      }
    })
  }, [onCanvasEvent])

  // ── Clear board ──────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    saveUndoState()
    suppressEventsRef.current = true
    canvas.clear()
    canvas.backgroundColor = '#1a1a2e'
    canvas.renderAll()
    suppressEventsRef.current = false
    if (onCanvasEvent) {
      onCanvasEvent({ type: 'clear' })
    }
  }, [onCanvasEvent, saveUndoState])

  // ── Re-apply tool when color changes ─────────────────────────────────────
  useEffect(() => {
    if (isHost) applyTool(activeTool)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokeColor])

  return (
    <div className="room-blackboard" ref={containerRef}>
      <canvas ref={canvasRef} />
      {isHost && (
        <BlackboardToolbar
          activeTool={activeTool}
          onToolChange={applyTool}
          strokeColor={strokeColor}
          onColorChange={handleColorChange}
          textOptions={textOptions}
          onTextOptionsChange={setTextOptions}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          canUndo={undoStack.current.length > 0}
          canRedo={redoStack.current.length > 0}
        />
      )}
    </div>
  )
})

export default Blackboard
