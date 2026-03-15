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
  | { type: 'cursor-move'; x: number; y: number }
  | { type: 'shape-preview'; kind: 'line' | 'rect' | 'circle'; x1: number; y1: number; x2: number; y2: number; color: string }
  | { type: 'shape-preview-end' }
  | { type: 'text-cursor'; x: number; y: number; height: number; visible: boolean }
  | { type: 'selection-highlight'; x: number; y: number; width: number; height: number; visible: boolean }

export type DrawingTool = 'pen' | 'line' | 'rect' | 'circle' | 'highlighter' | 'eraser' | 'text' | 'select'

export interface TextOptions {
  fontSize: number
  fontFamily: string
  bold: boolean
  italic: boolean
  underline: boolean
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
  const cursorDivRef = useRef<HTMLDivElement>(null)
  const caretDivRef = useRef<HTMLDivElement>(null)
  const selectionDivRef = useRef<HTMLDivElement>(null)

  // Drawing state
  const [activeTool, setActiveTool] = useState<DrawingTool>('pen')
  const [strokeColor, setStrokeColor] = useState('#ffffff')
  const [toolbarVisible, setToolbarVisible] = useState(true)
  const [textOptions, setTextOptions] = useState<TextOptions>({
    fontSize: 24,
    fontFamily: 'Courier New, monospace',
    bold: false,
    italic: false,
    underline: false,
  })

  // Always-current textOptions ref — avoids stale closure in tool handlers
  const textOptionsRef = useRef(textOptions)
  useEffect(() => { textOptionsRef.current = textOptions }, [textOptions])

  // Always-current strokeColor ref — used in text tool to pick up latest color
  const strokeColorRef = useRef(strokeColor)
  useEffect(() => { strokeColorRef.current = strokeColor }, [strokeColor])

  // Always-current onCanvasEvent ref — avoids stale closure in tool handlers
  const onCanvasEventRef = useRef(onCanvasEvent)
  useEffect(() => { onCanvasEventRef.current = onCanvasEvent }, [onCanvasEvent])

  // Shape drawing refs (line / rect)
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null)
  const activeShapeRef = useRef<fabric.Object | null>(null)

  // Guard: prevents tool switch while mid-drag for shape drawing
  const isDrawingShapeRef = useRef(false)

  // rAF handle for smooth student-side preview
  const previewRafRef = useRef<number>(0)

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

    if (event.type === 'cursor-move') {
      const el = cursorDivRef.current
      if (el) {
        el.style.left = `${event.x}px`
        el.style.top = `${event.y}px`
        el.style.display = 'block'
      }
      return
    }

    if (event.type === 'text-cursor') {
      const el = caretDivRef.current
      if (el) {
        if (event.visible) {
          el.style.left = `${event.x}px`
          el.style.top = `${event.y}px`
          el.style.height = `${event.height}px`
          el.style.display = 'block'
          // Hide the cursor dot while the text caret is visible
          if (cursorDivRef.current) cursorDivRef.current.style.display = 'none'
        } else {
          el.style.display = 'none'
        }
      }
      return
    }

    if (event.type === 'selection-highlight') {
      const el = selectionDivRef.current
      if (el) {
        if (event.visible) {
          el.style.left = `${event.x}px`
          el.style.top = `${event.y}px`
          el.style.width = `${event.width}px`
          el.style.height = `${event.height}px`
          el.style.display = 'block'
        } else {
          el.style.display = 'none'
        }
      }
      return
    }

    if (event.type === 'shape-preview') {
      // Buffer latest preview and render on next animation frame for smoothness
      cancelAnimationFrame(previewRafRef.current)
      previewRafRef.current = requestAnimationFrame(() => {
        const c = fabricRef.current
        if (!c) return
        const ctx = (c as any).contextTop as CanvasRenderingContext2D | undefined
        const uc = (c as any).upperCanvasEl as HTMLCanvasElement | undefined
        if (!ctx || !uc) return
        ctx.clearRect(0, 0, uc.width, uc.height)
        ctx.save()
        ctx.strokeStyle = event.color
        ctx.lineWidth = 3
        if (event.kind === 'line') {
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(event.x1, event.y1)
          ctx.lineTo(event.x2, event.y2)
          ctx.stroke()
        } else if (event.kind === 'rect') {
          const rx = Math.min(event.x1, event.x2)
          const ry = Math.min(event.y1, event.y2)
          const rw = Math.abs(event.x2 - event.x1)
          const rh = Math.abs(event.y2 - event.y1)
          ctx.strokeRect(rx, ry, rw, rh)
        } else if (event.kind === 'circle') {
          const rx = Math.abs(event.x2 - event.x1) / 2
          const ry = Math.abs(event.y2 - event.y1) / 2
          const cx = (event.x1 + event.x2) / 2
          const cy = (event.y1 + event.y2) / 2
          ctx.beginPath()
          ctx.ellipse(cx, cy, rx || 1, ry || 1, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
      })
      return
    }

    if (event.type === 'shape-preview-end') {
      const ctx = (canvas as any).contextTop as CanvasRenderingContext2D | undefined
      const uc = (canvas as any).upperCanvasEl as HTMLCanvasElement | undefined
      if (ctx && uc) ctx.clearRect(0, 0, uc.width, uc.height)
      return
    }

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
    if (!canvas || !isHost) return

    // Throttled live drawing emitter (~60fps)
    const emitLiveDrawing = throttle((points: number[], color: string, width: number) => {
      onCanvasEventRef.current?.({ type: 'drawing-live', points: [...points], color, width })
    }, 16)

    const emitCursor = throttle((x: number, y: number) => {
      onCanvasEventRef.current?.({ type: 'cursor-move', x, y })
    }, 16)

    const onCursorMove = (e: any) => {
      const pointer = canvas.getScenePoint(e.e)
      emitCursor(pointer.x, pointer.y)
    }

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
        onCanvasEventRef.current?.({ type: 'drawing-live-end' })
      }
    }

    const onPathCreated = (e: any) => {
      if (suppressEventsRef.current) return
      const path = e.path as fabric.FabricObject
      const id = nextObjId()
      ;(path as any).id = id
      saveUndoState()
      onCanvasEventRef.current?.({ type: 'object-added', data: JSON.stringify(path.toObject(['id'])), id })
    }

    const onObjectAdded = (e: any) => {
      if (suppressEventsRef.current) return
      const obj = e.target as fabric.FabricObject
      if (!obj || (obj as any)._fromPath) return
      if (!(obj as any).id) (obj as any).id = nextObjId()
      if (obj.type === 'path') return
      saveUndoState()
      onCanvasEventRef.current?.({ type: 'object-added', data: JSON.stringify(obj.toObject(['id'])), id: (obj as any).id })
    }

    const onObjectModified = (e: any) => {
      if (suppressEventsRef.current) return
      const obj = e.target as fabric.FabricObject
      if (!obj || !(obj as any).id) return
      saveUndoState()
      onCanvasEventRef.current?.({ type: 'object-modified', data: JSON.stringify(obj.toObject(['id'])), id: (obj as any).id })
    }

    const onObjectRemoved = (e: any) => {
      if (suppressEventsRef.current) return
      const obj = e.target as fabric.FabricObject
      if (!obj || !(obj as any).id) return
      onCanvasEventRef.current?.({ type: 'object-removed', id: (obj as any).id })
    }

    // Selection highlight: broadcast bounding box when teacher selects/deselects
    const emitSelectionHighlight = () => {
      const active = canvas.getActiveObject()
      if (active) {
        const bound = active.getBoundingRect()
        onCanvasEventRef.current?.({
          type: 'selection-highlight',
          x: bound.left, y: bound.top, width: bound.width, height: bound.height,
          visible: true,
        })
      } else {
        onCanvasEventRef.current?.({ type: 'selection-highlight', x: 0, y: 0, width: 0, height: 0, visible: false })
      }
    }

    const onSelectionCreated = () => emitSelectionHighlight()
    const onSelectionUpdated = () => emitSelectionHighlight()
    const onSelectionCleared = () => {
      onCanvasEventRef.current?.({ type: 'selection-highlight', x: 0, y: 0, width: 0, height: 0, visible: false })
    }

    // Hide cursor when mouse leaves canvas
    const onMouseOut = () => {
      onCanvasEventRef.current?.({ type: 'cursor-move', x: -100, y: -100 })
    }

    canvas.on('mouse:down', onMouseDown)
    canvas.on('mouse:move', onMouseMove)
    canvas.on('mouse:move', onCursorMove)
    canvas.on('mouse:up', onMouseUp)
    canvas.on('mouse:out', onMouseOut)
    canvas.on('path:created', onPathCreated)
    canvas.on('object:added', onObjectAdded)
    canvas.on('object:modified', onObjectModified)
    canvas.on('object:removed', onObjectRemoved)
    canvas.on('selection:created', onSelectionCreated)
    canvas.on('selection:updated', onSelectionUpdated)
    canvas.on('selection:cleared', onSelectionCleared)

    return () => {
      canvas.off('mouse:down', onMouseDown)
      canvas.off('mouse:move', onMouseMove)
      canvas.off('mouse:move', onCursorMove)
      canvas.off('mouse:up', onMouseUp)
      canvas.off('mouse:out', onMouseOut)
      canvas.off('path:created', onPathCreated)
      canvas.off('object:added', onObjectAdded)
      canvas.off('object:modified', onObjectModified)
      canvas.off('object:removed', onObjectRemoved)
      canvas.off('selection:created', onSelectionCreated)
      canvas.off('selection:updated', onSelectionUpdated)
      canvas.off('selection:cleared', onSelectionCleared)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, saveUndoState])

  // ── Participant: apply incoming events ────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !incomingEvent) return

    // Live drawing / cursor / shape-preview events are handled imperatively via applyLiveEvent — skip here
    if (
      incomingEvent.type === 'drawing-live' ||
      incomingEvent.type === 'drawing-live-end' ||
      incomingEvent.type === 'cursor-move' ||
      incomingEvent.type === 'shape-preview' ||
      incomingEvent.type === 'shape-preview-end' ||
      incomingEvent.type === 'text-cursor'
    ) return

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
            // Clear shape-preview from contextTop now that committed object is on canvas
            const ctx2 = (canvas as any).contextTop as CanvasRenderingContext2D | undefined
            const uc2 = (canvas as any).upperCanvasEl as HTMLCanvasElement | undefined
            if (ctx2 && uc2) ctx2.clearRect(0, 0, uc2.width, uc2.height)
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
    // Prevent switching tool while mid-drag on a shape
    if (isDrawingShapeRef.current) return
    setActiveTool(tool)

    // Reset states
    canvas.isDrawingMode = false
    canvas.selection = false
    canvas.defaultCursor = 'crosshair'
    // Clear any in-progress contextTop preview (line / rect / circle)
    const topCtx = (canvas as any).contextTop as CanvasRenderingContext2D | undefined
    if (topCtx) {
      const uc = (canvas as any).upperCanvasEl as HTMLCanvasElement
      topCtx.clearRect(0, 0, uc?.width ?? canvas.width, uc?.height ?? canvas.height)
    }
    // Remove any in-progress live shape (legacy guard)
    if (activeShapeRef.current) {
      suppressEventsRef.current = true
      canvas.remove(activeShapeRef.current)
      suppressEventsRef.current = false
      activeShapeRef.current = null
    }
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
        brush.color = strokeColorRef.current
        brush.width = 3
        canvas.freeDrawingBrush = brush
        break
      }
      case 'highlighter': {
        canvas.isDrawingMode = true
        const hBrush = new fabric.PencilBrush(canvas)
        const c = strokeColorRef.current
        const r = parseInt(c.slice(1, 3), 16)
        const g = parseInt(c.slice(3, 5), 16)
        const b = parseInt(c.slice(5, 7), 16)
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
      case 'circle': {
        setupCircleDrawing(canvas)
        break
      }
      case 'text': {
        canvas.defaultCursor = 'text'
        setupTextTool(canvas)
        break
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost])

  // ── Line drawing handlers ────────────────────────────────────────────────
  const setupLineDrawing = useCallback((canvas: fabric.Canvas) => {
    const local = { id: '', sx: 0, sy: 0 }

    const mouseDown = (e: any) => {
      if (local.id) return // guard against double-fire
      local.id = nextObjId()
      local.sx = e.scenePoint.x
      local.sy = e.scenePoint.y
      isDrawingShapeRef.current = true
    }

    const emitLinePreview = throttle((x1: number, y1: number, x2: number, y2: number) => {
      onCanvasEventRef.current?.({ type: 'shape-preview', kind: 'line', x1, y1, x2, y2, color: strokeColorRef.current })
    }, 16)

    const mouseMove = (e: any) => {
      if (!local.id) return
      const ctx = (canvas as any).contextTop as CanvasRenderingContext2D | undefined
      if (!ctx) return
      const uc = (canvas as any).upperCanvasEl as HTMLCanvasElement
      ctx.clearRect(0, 0, uc.width, uc.height)
      ctx.strokeStyle = strokeColorRef.current
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(local.sx, local.sy)
      ctx.lineTo(e.scenePoint.x, e.scenePoint.y)
      ctx.stroke()
      emitLinePreview(local.sx, local.sy, e.scenePoint.x, e.scenePoint.y)
    }

    const mouseUp = (e: any) => {
      if (!local.id) return
      const ex = e.scenePoint.x, ey = e.scenePoint.y
      const line = new fabric.Path(`M ${local.sx} ${local.sy} L ${ex} ${ey}`, {
        stroke: strokeColorRef.current,
        strokeWidth: 3,
        fill: '',
        selectable: false,
        evented: false,
        strokeLineCap: 'round',
      })
      ;(line as any).id = local.id
      suppressEventsRef.current = true
      canvas.add(line)
      suppressEventsRef.current = false
      canvas.renderAll()
      // Clear preview after committed shape is rendered
      const ctx = (canvas as any).contextTop as CanvasRenderingContext2D | undefined
      const uc = (canvas as any).upperCanvasEl as HTMLCanvasElement
      if (ctx && uc) ctx.clearRect(0, 0, uc.width, uc.height)
      saveUndoState()
      onCanvasEventRef.current?.({ type: 'object-added', data: JSON.stringify((line as any).toObject(['id'])), id: local.id })
      onCanvasEventRef.current?.({ type: 'shape-preview-end' })
      local.id = ''
      isDrawingShapeRef.current = false
      activeShapeRef.current = null
      shapeStartRef.current = null
    }

    ;(canvas as any).__toolMouseDown = mouseDown
    ;(canvas as any).__toolMouseMove = mouseMove
    ;(canvas as any).__toolMouseUp = mouseUp
    canvas.on('mouse:down', mouseDown)
    canvas.on('mouse:move', mouseMove)
    canvas.on('mouse:up', mouseUp)
  }, [saveUndoState])

  // ── Rectangle drawing handlers (live fabric object, sync render) ──
  const setupRectDrawing = useCallback((canvas: fabric.Canvas) => {
    const local: { id: string; sx: number; sy: number; ex: number; ey: number; shape: fabric.Rect | null; drawing: boolean } = { id: '', sx: 0, sy: 0, ex: 0, ey: 0, shape: null, drawing: false }

    const mouseDown = (e: any) => {
      if (local.drawing) return
      local.id = nextObjId()
      local.sx = e.scenePoint.x
      local.sy = e.scenePoint.y
      local.ex = local.sx
      local.ey = local.sy
      local.drawing = true
      isDrawingShapeRef.current = true
      const rect = new fabric.Rect({
        left: local.sx, top: local.sy, width: 1, height: 1,
        originX: 'left', originY: 'top',
        fill: 'transparent', stroke: strokeColorRef.current, strokeWidth: 3,
        selectable: false, evented: false,
      })
      ;(rect as any).id = local.id
      local.shape = rect
      activeShapeRef.current = rect
      suppressEventsRef.current = true
      canvas.add(rect)
      suppressEventsRef.current = false
    }

    const emitRectPreview = throttle((x1: number, y1: number, x2: number, y2: number) => {
      onCanvasEventRef.current?.({ type: 'shape-preview', kind: 'rect', x1, y1, x2, y2, color: strokeColorRef.current })
    }, 16)

    const mouseMove = (e: any) => {
      if (!local.drawing || !local.shape) return
      const ex = e.scenePoint.x, ey = e.scenePoint.y
      local.ex = ex
      local.ey = ey
      const left = Math.min(local.sx, ex)
      const top = Math.min(local.sy, ey)
      const width = Math.max(1, Math.abs(ex - local.sx))
      const height = Math.max(1, Math.abs(ey - local.sy))
      local.shape.set({ left, top, width, height })
      local.shape.setCoords()
      canvas.renderAll()  // synchronous — prevents "restart" flicker
      emitRectPreview(local.sx, local.sy, ex, ey)
    }

    const mouseUp = () => {
      if (!local.drawing || !local.shape) return
      local.drawing = false
      saveUndoState()
      onCanvasEventRef.current?.({ type: 'object-added', data: JSON.stringify((local.shape as any).toObject(['id'])), id: local.id })
      onCanvasEventRef.current?.({ type: 'shape-preview-end' })
      local.id = ''
      local.shape = null
      isDrawingShapeRef.current = false
      activeShapeRef.current = null
      shapeStartRef.current = null
    }

    ;(canvas as any).__toolMouseDown = mouseDown
    ;(canvas as any).__toolMouseMove = mouseMove
    ;(canvas as any).__toolMouseUp = mouseUp
    canvas.on('mouse:down', mouseDown)
    canvas.on('mouse:move', mouseMove)
    canvas.on('mouse:up', mouseUp)
  }, [saveUndoState])

  // ── Circle/Ellipse drawing handlers (live fabric object, sync render) ──
  const setupCircleDrawing = useCallback((canvas: fabric.Canvas) => {
    const local: { id: string; sx: number; sy: number; shape: fabric.Ellipse | null; drawing: boolean } = { id: '', sx: 0, sy: 0, shape: null, drawing: false }

    const mouseDown = (e: any) => {
      if (local.drawing) return
      local.id = nextObjId()
      local.sx = e.scenePoint.x
      local.sy = e.scenePoint.y
      local.drawing = true
      isDrawingShapeRef.current = true
      const ellipse = new fabric.Ellipse({
        left: local.sx, top: local.sy, rx: 1, ry: 1,
        originX: 'left', originY: 'top',
        fill: 'transparent', stroke: strokeColorRef.current, strokeWidth: 3,
        selectable: false, evented: false,
      })
      ;(ellipse as any).id = local.id
      local.shape = ellipse
      activeShapeRef.current = ellipse
      suppressEventsRef.current = true
      canvas.add(ellipse)
      suppressEventsRef.current = false
    }

    const emitCirclePreview = throttle((x1: number, y1: number, x2: number, y2: number) => {
      onCanvasEventRef.current?.({ type: 'shape-preview', kind: 'circle', x1, y1, x2, y2, color: strokeColorRef.current })
    }, 16)

    const mouseMove = (e: any) => {
      if (!local.drawing || !local.shape) return
      const ex = e.scenePoint.x, ey = e.scenePoint.y
      const rx = Math.max(1, Math.abs(ex - local.sx) / 2)
      const ry = Math.max(1, Math.abs(ey - local.sy) / 2)
      const left = Math.min(local.sx, ex)
      const top = Math.min(local.sy, ey)
      local.shape.set({ left, top, rx, ry })
      local.shape.setCoords()
      canvas.renderAll()  // synchronous — prevents "restart" flicker
      emitCirclePreview(local.sx, local.sy, ex, ey)
    }

    const mouseUp = () => {
      if (!local.drawing || !local.shape) return
      local.drawing = false
      saveUndoState()
      onCanvasEventRef.current?.({ type: 'object-added', data: JSON.stringify((local.shape as any).toObject(['id'])), id: local.id })
      onCanvasEventRef.current?.({ type: 'shape-preview-end' })
      local.id = ''
      local.shape = null
      isDrawingShapeRef.current = false
      activeShapeRef.current = null
      shapeStartRef.current = null
    }

    ;(canvas as any).__toolMouseDown = mouseDown
    ;(canvas as any).__toolMouseMove = mouseMove
    ;(canvas as any).__toolMouseUp = mouseUp
    canvas.on('mouse:down', mouseDown)
    canvas.on('mouse:move', mouseMove)
    canvas.on('mouse:up', mouseUp)
  }, [saveUndoState])

  // ── Text tool handler ────────────────────────────────────────────────────
  const setupTextTool = useCallback((canvas: fabric.Canvas) => {
    const mouseDown = (e: any) => {
      if (e.target && (e.target.type === 'i-text' || e.target.type === 'IText')) return
      const pointer = canvas.getScenePoint(e.e)
      const id = nextObjId()
      const opts = textOptionsRef.current   // always the latest selection
      const text = new fabric.IText('', {
        left: pointer.x,
        top: pointer.y,
        fontSize: opts.fontSize,
        fontWeight: opts.bold ? 'bold' : 'normal',
        fontStyle: opts.italic ? 'italic' : 'normal',
        underline: opts.underline,
        fill: strokeColorRef.current,
        fontFamily: opts.fontFamily,
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
      onCanvasEventRef.current?.({ type: 'object-added', data: JSON.stringify((text as any).toObject(['id'])), id })

      canvas.setActiveObject(text)
      canvas.renderAll()
      text.enterEditing()
      text.selectAll()

      // Hide the teacher cursor dot while typing — prevents leftover dot at click origin
      onCanvasEventRef.current?.({ type: 'cursor-move', x: -100, y: -100 })

      // Show text cursor to students at actual typing position
      onCanvasEventRef.current?.({ type: 'text-cursor', x: pointer.x, y: pointer.y, height: opts.fontSize, visible: true })

      // Stream every keystroke live to participants
      const emitTextLive = throttle(() => {
        onCanvasEventRef.current?.({ type: 'object-modified', data: JSON.stringify((text as any).toObject(['id'])), id })
        // Compute actual cursor pixel position using fabric's internal cursor rendering data
        try {
          const rd = (text as any).getCursorRenderingData()
          if (rd) {
            // rd.left/top are in local coords (offset from object center), add object center to get canvas coords
            const cx = (text.left || 0) + rd.left
            const cy = (text.top || 0) + rd.top
            onCanvasEventRef.current?.({ type: 'text-cursor', x: cx, y: cy, height: rd.height || text.fontSize || 24, visible: true })
          }
        } catch {
          onCanvasEventRef.current?.({ type: 'text-cursor', x: text.left || 0, y: text.top || 0, height: text.fontSize || 24, visible: true })
        }
      }, 50)
      text.on('changed', emitTextLive)

      text.on('editing:exited', () => {
        // Hide text cursor for students
        onCanvasEventRef.current?.({ type: 'text-cursor', x: 0, y: 0, height: 0, visible: false })

        if (text.text?.trim() === '') {
          suppressEventsRef.current = true
          canvas.remove(text)
          suppressEventsRef.current = false
          onCanvasEventRef.current?.({ type: 'object-removed', id })
          return
        }
        saveUndoState()
        // Emit final confirmed state
        onCanvasEventRef.current?.({ type: 'object-modified', data: JSON.stringify((text as any).toObject(['id'])), id })
      })
    }
    ;(canvas as any).__toolMouseDown = mouseDown
    canvas.on('mouse:down', mouseDown)
  }, [saveUndoState])

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
      onCanvasEventRef.current?.({ type: 'snapshot', data: prev })
    })
  }, [])

  const handleRedo = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || redoStack.current.length === 0) return
    isUndoRedoRef.current = true
    undoStack.current.push(JSON.stringify(canvas.toObject(['id'])))
    const next = redoStack.current.pop()!
    canvas.loadFromJSON(JSON.parse(next)).then(() => {
      canvas.renderAll()
      isUndoRedoRef.current = false
      onCanvasEventRef.current?.({ type: 'snapshot', data: next })
    })
  }, [])

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
    onCanvasEventRef.current?.({ type: 'clear' })
  }, [saveUndoState])

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
        fill: strokeColor,
        fontFamily: textOptions.fontFamily,
      })
      canvas.renderAll()
    }
  }, [textOptions, strokeColor, isHost])

  return (
    <div className="room-blackboard" ref={containerRef}>
      <canvas ref={canvasRef} />
      {!isHost && (
        <>
          <div ref={cursorDivRef} className="room-bb-cursor" style={{ display: 'none' }} />
          <div ref={caretDivRef} className="room-bb-caret" style={{ display: 'none' }} />
          <div ref={selectionDivRef} className="room-bb-selection" style={{ display: 'none' }} />
        </>
      )}
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
