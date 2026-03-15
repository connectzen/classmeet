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
  | { type: 'drawing-live'; points: number[]; color: string; width: number }
  | { type: 'drawing-live-end' }

export type DrawingTool = 'pen' | 'line' | 'rect' | 'highlighter' | 'eraser' | 'text' | 'select'

export interface TextOptions {
  fontSize: number
  fontFamily: string
  bold: boolean
  italic: boolean
  underline: boolean
  color: string
}

export interface BlackboardHandle {
  getSnapshot: () => string | null
  applyLiveEvent: (event: BlackboardEvent) => void
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

// Throttle helper for live drawing
function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0
  return ((...args: any[]) => {
    const now = Date.now()
    if (now - last >= ms) {
      last = now
      fn(...args)
    }
  }) as T
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
  const [toolbarVisible, setToolbarVisible] = useState(true)
  const [textOptions, setTextOptions] = useState<TextOptions>({
    fontSize: 24,
    fontFamily: 'Arial, sans-serif',
    bold: false,
    italic: false,
    underline: false,
    color: '#ffffff',
  })

  // Shape drawing refs (line / rect)
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null)
  const activeShapeRef = useRef<fabric.Object | null>(null)

  // Live drawing points buffer for streaming
  const livePointsRef = useRef<number[]>([])
  const isDrawingRef = useRef(false)

  // Live drawing preview path for participants
  const livePreviewRef = useRef<fabric.Path | null>(null)

  // Undo/redo stacks
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const isUndoRedoRef = useRef(false)

  // ── Handle live drawing events imperatively (bypasses React state batching) ──
  const handleLiveEvent = useCallback((event: BlackboardEvent) => {
    const canvas = fabricRef.current
    if (!canvas) return

    if (event.type === 'drawing-live') {
      const pts = event.points
      if (pts.length < 4) return
      // Remove old preview
      if (livePreviewRef.current) {
        canvas.remove(livePreviewRef.current)
      }
      // Build SVG path from points
      let pathStr = `M ${pts[0]} ${pts[1]}`
      for (let i = 2; i < pts.length - 2; i += 2) {
        const mx = (pts[i] + pts[i + 2]) / 2
        const my = (pts[i + 1] + pts[i + 3]) / 2
        pathStr += ` Q ${pts[i]} ${pts[i + 1]} ${mx} ${my}`
      }
      pathStr += ` L ${pts[pts.length - 2]} ${pts[pts.length - 1]}`
      const preview = new fabric.Path(pathStr, {
        stroke: event.color,
        strokeWidth: event.width,
        fill: 'transparent',
        selectable: false,
        evented: false,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      })
      ;(preview as any)._livePreview = true
      livePreviewRef.current = preview
      suppressEventsRef.current = true
      canvas.add(preview)
      canvas.renderAll()
      suppressEventsRef.current = false
      return
    }

    if (event.type === 'drawing-live-end') {
      if (livePreviewRef.current) {
        suppressEventsRef.current = true
        canvas.remove(livePreviewRef.current)
        livePreviewRef.current = null
        canvas.renderAll()
        suppressEventsRef.current = false
      }
      return
    }
  }, [])

  // ── Expose methods to parent ─────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getSnapshot: () => {
      const canvas = fabricRef.current
      if (!canvas) return null
      return JSON.stringify(canvas.toObject(['id']))
    },
    applyLiveEvent: handleLiveEvent,
  }))

  // ── Save state for undo ──────────────────────────────────────────────────
  const saveUndoState = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || isUndoRedoRef.current) return
    undoStack.current.push(JSON.stringify(canvas.toObject(['id'])))
    if (undoStack.current.length > 50) undoStack.current.shift()
    redoStack.current = []
  }, [])

  // ── Initialize fabric canvas (retina handled by fabric's enableRetinaScaling) ──
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return

    const container = containerRef.current
    const w = container?.clientWidth || 800
    const h = container?.clientHeight || 600

    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#1a1a2e',
      isDrawingMode: isHost,
      selection: isHost,
      width: w,
      height: h,
    })

    if (isHost) {
      const brush = new fabric.PencilBrush(canvas)
      brush.color = '#ffffff'
      brush.width = 3
      canvas.freeDrawingBrush = brush
    }

    fabricRef.current = canvas

    // Fit to container on resize
    const resize = () => {
      const c = containerRef.current
      if (!c || !fabricRef.current) return
      const cw = c.clientWidth
      const ch = c.clientHeight
      if (cw > 0 && ch > 0) {
        fabricRef.current.setDimensions({ width: cw, height: ch })
        fabricRef.current.renderAll()
      }
    }
    const ro = new ResizeObserver(resize)
    if (container) ro.observe(container)

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

    // Throttled live drawing emitter (~30fps)
    const emitLiveDrawing = throttle((points: number[], color: string, width: number) => {
      onCanvasEvent({ type: 'drawing-live', points: [...points], color, width })
    }, 33)

    const onMouseDown = () => {
      if (!canvas.isDrawingMode) return
      isDrawingRef.current = true
      livePointsRef.current = []
    }

    const onMouseMove = (e: any) => {
      if (!isDrawingRef.current || !canvas.isDrawingMode) return
      const pointer = canvas.getScenePoint(e.e)
      livePointsRef.current.push(pointer.x, pointer.y)
      const brush = canvas.freeDrawingBrush
      if (brush && livePointsRef.current.length >= 4) {
        emitLiveDrawing(livePointsRef.current, brush.color, brush.width)
      }
    }

    const onMouseUp = () => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false
        livePointsRef.current = []
        onCanvasEvent({ type: 'drawing-live-end' })
      }
    }

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

    canvas.on('mouse:down', onMouseDown)
    canvas.on('mouse:move', onMouseMove)
    canvas.on('mouse:up', onMouseUp)
    canvas.on('path:created', onPathCreated)
    canvas.on('object:added', onObjectAdded)
    canvas.on('object:modified', onObjectModified)
    canvas.on('object:removed', onObjectRemoved)

    return () => {
      canvas.off('mouse:down', onMouseDown)
      canvas.off('mouse:move', onMouseMove)
      canvas.off('mouse:up', onMouseUp)
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

    // Live drawing events are handled imperatively via applyLiveEvent — skip here
    if (incomingEvent.type === 'drawing-live' || incomingEvent.type === 'drawing-live-end') return

    suppressEventsRef.current = true

    switch (incomingEvent.type) {
      case 'snapshot': {
        // Remove live preview before loading snapshot
        if (livePreviewRef.current) {
          canvas.remove(livePreviewRef.current)
          livePreviewRef.current = null
        }
        canvas.loadFromJSON(JSON.parse(incomingEvent.data)).then(() => {
          canvas.renderAll()
          suppressEventsRef.current = false
        })
        return
      }
      case 'object-added': {
        // Remove live preview when final object arrives
        if (livePreviewRef.current) {
          canvas.remove(livePreviewRef.current)
          livePreviewRef.current = null
        }
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
          // Remove read-only properties that are getters in fabric v7
          delete json.type
          delete json.version
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
        if (livePreviewRef.current) livePreviewRef.current = null
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
    // Only remove tool-specific handlers (not the live drawing handlers)
    canvas.off('mouse:down', (canvas as any).__toolMouseDown)
    canvas.off('mouse:move', (canvas as any).__toolMouseMove)
    canvas.off('mouse:up', (canvas as any).__toolMouseUp)

    // Make objects not selectable by default (select tool re-enables)
    canvas.forEachObject((o: fabric.FabricObject) => { o.selectable = false; o.evented = false })

    switch (tool) {
      case 'select': {
        canvas.selection = true
        canvas.defaultCursor = 'default'
        canvas.forEachObject((o: fabric.FabricObject) => {
          o.selectable = true
          o.evented = true
          o.setCoords()
        })
        canvas.requestRenderAll()
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
        eBrush.color = '#1a1a2e'
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
    const mouseDown = (e: any) => {
      const pointer = canvas.getScenePoint(e.e)
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
    }
    const mouseMove = (e: any) => {
      if (!activeShapeRef.current || !shapeStartRef.current) return
      const pointer = canvas.getScenePoint(e.e)
      const line = activeShapeRef.current as fabric.Line
      line.set({ x2: pointer.x, y2: pointer.y })
      line.setCoords()
      canvas.renderAll()
    }
    const mouseUp = () => {
      if (activeShapeRef.current && onCanvasEvent) {
        const obj = activeShapeRef.current as any
        saveUndoState()
        onCanvasEvent({ type: 'object-added', data: JSON.stringify(obj.toObject(['id'])), id: obj.id })
      }
      activeShapeRef.current = null
      shapeStartRef.current = null
    }
    ;(canvas as any).__toolMouseDown = mouseDown
    ;(canvas as any).__toolMouseMove = mouseMove
    ;(canvas as any).__toolMouseUp = mouseUp
    canvas.on('mouse:down', mouseDown)
    canvas.on('mouse:move', mouseMove)
    canvas.on('mouse:up', mouseUp)
  }, [strokeColor, onCanvasEvent, saveUndoState])

  // ── Rectangle drawing handlers ───────────────────────────────────────────
  const setupRectDrawing = useCallback((canvas: fabric.Canvas) => {
    const mouseDown = (e: any) => {
      const pointer = canvas.getScenePoint(e.e)
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
    }
    const mouseMove = (e: any) => {
      if (!activeShapeRef.current || !shapeStartRef.current) return
      const pointer = canvas.getScenePoint(e.e)
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
      rect.setCoords()
      canvas.renderAll()
    }
    const mouseUp = () => {
      if (activeShapeRef.current && onCanvasEvent) {
        const obj = activeShapeRef.current as any
        saveUndoState()
        onCanvasEvent({ type: 'object-added', data: JSON.stringify(obj.toObject(['id'])), id: obj.id })
      }
      activeShapeRef.current = null
      shapeStartRef.current = null
    }
    ;(canvas as any).__toolMouseDown = mouseDown
    ;(canvas as any).__toolMouseMove = mouseMove
    ;(canvas as any).__toolMouseUp = mouseUp
    canvas.on('mouse:down', mouseDown)
    canvas.on('mouse:move', mouseMove)
    canvas.on('mouse:up', mouseUp)
  }, [strokeColor, onCanvasEvent, saveUndoState])

  // ── Text tool handler ────────────────────────────────────────────────────
  const setupTextTool = useCallback((canvas: fabric.Canvas) => {
    const mouseDown = (e: any) => {
      if (e.target && (e.target.type === 'i-text' || e.target.type === 'IText')) return
      const pointer = canvas.getScenePoint(e.e)
      const id = nextObjId()
      const text = new fabric.IText('', {
        left: pointer.x,
        top: pointer.y,
        fontSize: textOptions.fontSize,
        fontWeight: textOptions.bold ? 'bold' : 'normal',
        fontStyle: textOptions.italic ? 'italic' : 'normal',
        underline: textOptions.underline,
        fill: textOptions.color,
        fontFamily: textOptions.fontFamily,
        editable: true,
        objectCaching: false,
        paintFirst: 'fill',
        strokeWidth: 0,
      })
      ;(text as any).id = id
      suppressEventsRef.current = true
      canvas.add(text)
      suppressEventsRef.current = false

      // Broadcast immediately so participants create the placeholder object
      if (onCanvasEvent) {
        onCanvasEvent({ type: 'object-added', data: JSON.stringify((text as any).toObject(['id'])), id })
      }

      canvas.setActiveObject(text)
      canvas.renderAll()
      text.enterEditing()
      text.selectAll()

      // Stream every keystroke live to participants (~20fps)
      const emitTextLive = throttle(() => {
        if (onCanvasEvent) {
          onCanvasEvent({ type: 'object-modified', data: JSON.stringify((text as any).toObject(['id'])), id })
        }
      }, 50)
      text.on('changed', emitTextLive)

      text.on('editing:exited', () => {
        if (text.text?.trim() === '') {
          suppressEventsRef.current = true
          canvas.remove(text)
          suppressEventsRef.current = false
          if (onCanvasEvent) {
            onCanvasEvent({ type: 'object-removed', id })
          }
          return
        }
        saveUndoState()
        // Emit final confirmed state
        if (onCanvasEvent) {
          onCanvasEvent({ type: 'object-modified', data: JSON.stringify((text as any).toObject(['id'])), id })
        }
      })
    }
    ;(canvas as any).__toolMouseDown = mouseDown
    canvas.on('mouse:down', mouseDown)
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

  // ── Apply text option changes to the currently editing IText ─────────────
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !isHost) return
    const active = canvas.getActiveObject()
    if (active && active.type === 'i-text' && (active as fabric.IText).isEditing) {
      const txt = active as fabric.IText
      txt.set({
        fontSize: textOptions.fontSize,
        fontWeight: textOptions.bold ? 'bold' : 'normal',
        fontStyle: textOptions.italic ? 'italic' : 'normal',
        underline: textOptions.underline,
        fill: textOptions.color,
        fontFamily: textOptions.fontFamily,
      })
      canvas.renderAll()
    }
  }, [textOptions, isHost])

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
          toolbarVisible={toolbarVisible}
          onToggleToolbar={() => setToolbarVisible(v => !v)}
        />
      )}
    </div>
  )
})

export default Blackboard
