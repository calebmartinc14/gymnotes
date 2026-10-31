import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

export interface ChartPoint {
  label: string
  value: number
  meta?: string
}

interface ChartProps {
  points: ChartPoint[]
  formatValue: (value: number) => string
  formatAxis?: (value: number) => string
  color?: string
  height?: number
  emptyLabel?: string
  ariaLabel?: string
}

interface PlottedPoint extends ChartPoint {
  x: number
  y: number
}

export function LineChart({
  points,
  formatValue,
  formatAxis,
  color = '#c8f169',
  height = 280,
  emptyLabel = 'No data yet',
  ariaLabel = 'Progress chart',
}: ChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(760)
  const [hovered, setHovered] = useState<number | null>(null)
  const gradientId = useId().replace(/:/g, '')

  useEffect(() => {
    const element = wrapperRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width
      if (next && next > 0) setWidth(next)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const padding = useMemo(
    () => ({ top: 18, right: 18, bottom: 34, left: width < 480 ? 42 : 54 }),
    [width],
  )
  const plotWidth = Math.max(10, width - padding.left - padding.right)
  const plotHeight = Math.max(10, height - padding.top - padding.bottom)

  const chart = useMemo(() => {
    if (points.length === 0) return null

    const values = points.map((point) => point.value)
    const rawMin = Math.min(...values)
    const rawMax = Math.max(...values)
    const spread = rawMax - rawMin
    const fallback = Math.max(Math.abs(rawMax) * 0.1, 1)
    const range = spread > 0 ? spread : fallback
    const min = Math.max(0, rawMin - range * 0.16)
    const max = rawMax + range * 0.14

    const scaleX = (index: number) =>
      points.length === 1
        ? padding.left + plotWidth / 2
        : padding.left + (index / (points.length - 1)) * plotWidth
    const scaleY = (value: number) =>
      padding.top + plotHeight - ((value - min) / (max - min || 1)) * plotHeight

    const plotted: PlottedPoint[] = points.map((point, index) => ({
      ...point,
      x: scaleX(index),
      y: scaleY(point.value),
    }))

    const yTicks = Array.from({ length: 4 }, (_, index) => {
      const value = min + ((max - min) / 3) * index
      return { value, y: scaleY(value) }
    })

    const labelCount = width < 480 ? 3 : width < 760 ? 4 : 5
    const labelIndices =
      points.length <= labelCount
        ? points.map((_, index) => index)
        : Array.from({ length: labelCount }, (_, index) =>
            Math.round((index / (labelCount - 1)) * (points.length - 1)),
          )

    const line = plotted.map((point) => `${point.x},${point.y}`).join(' ')
    const area = `${padding.left},${padding.top + plotHeight} ${line} ${
      padding.left + plotWidth
    },${padding.top + plotHeight}`

    return { plotted, yTicks, labelIndices, line, area, min, max }
  }, [points, padding.left, padding.top, plotHeight, plotWidth, width])

  function handlePointer(event: ReactPointerEvent<SVGRectElement>) {
    if (!chart) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = padding.left + ((event.clientX - rect.left) / rect.width) * plotWidth
    let closest = 0
    let distance = Infinity
    chart.plotted.forEach((point, index) => {
      const next = Math.abs(point.x - x)
      if (next < distance) {
        distance = next
        closest = index
      }
    })
    setHovered(closest)
  }

  function handleKeyDown(event: ReactKeyboardEvent<SVGSVGElement>) {
    if (!chart) return
    const total = chart.plotted.length
    if (total === 0) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      setHovered((current) => (current === null ? 0 : Math.min(total - 1, current + 1)))
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      setHovered((current) => (current === null ? total - 1 : Math.max(0, current - 1)))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setHovered(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setHovered(total - 1)
    } else if (event.key === 'Escape') {
      setHovered(null)
    }
  }

  const active = hovered !== null ? chart?.plotted[hovered] : null
  const axisFormatter = formatAxis ?? ((value: number) => `${Math.round(value)}`)
  const leftPercent = active ? Math.min(88, Math.max(12, (active.x / width) * 100)) : 0
  const topPercent = active ? (active.y / height) * 100 : 0

  return (
    <div className="chart-wrap" ref={wrapperRef} style={{ height }}>
      {!chart ? (
        <div className="chart-empty">
          <span className="chart-empty-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 19V5M4 19h16M7 15l4-5 4 3 5-7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p>{emptyLabel}</p>
        </div>
      ) : (
        <>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={ariaLabel}
            className="chart-svg"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onBlur={() => setHovered(null)}
          >
            <defs>
              <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {chart.yTicks.map((tick, index) => (
              <g key={index}>
                <line
                  x1={padding.left}
                  x2={padding.left + plotWidth}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="rgba(255,255,255,0.065)"
                  strokeDasharray="3 5"
                />
                <text
                  x={padding.left - 10}
                  y={tick.y + 3.5}
                  textAnchor="end"
                  className="chart-axis-label"
                >
                  {axisFormatter(tick.value)}
                </text>
              </g>
            ))}

            <polygon
              points={chart.area}
              fill={`url(#${gradientId}-fill)`}
              opacity={chart.plotted.length > 1 ? 1 : 0}
            />
            {chart.plotted.length > 1 && (
              <polyline
                points={chart.line}
                fill="none"
                stroke={color}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {chart.plotted.map((point, index) => {
              const isLatest = index === chart.plotted.length - 1
              return (
                <circle
                  key={`${point.label}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={isLatest ? 4.6 : 2.8}
                  fill={isLatest ? color : '#101513'}
                  stroke={color}
                  strokeWidth={isLatest ? 2 : 1.8}
                  style={isLatest ? { filter: `drop-shadow(0 0 6px ${color}99)` } : undefined}
                />
              )
            })}

            {active && (
              <>
                <line
                  x1={active.x}
                  x2={active.x}
                  y1={padding.top}
                  y2={padding.top + plotHeight}
                  stroke="rgba(255,255,255,0.22)"
                  strokeDasharray="3 4"
                />
                <circle cx={active.x} cy={active.y} r="6" fill={color} fillOpacity="0.18" />
                <circle cx={active.x} cy={active.y} r="4" fill={color} />
              </>
            )}

            {chart.labelIndices.map((index) => {
              const point = chart.plotted[index]
              const anchor =
                chart.plotted.length === 1
                  ? 'middle'
                  : index === 0
                    ? 'start'
                    : index === chart.plotted.length - 1
                      ? 'end'
                      : 'middle'
              return (
                <text
                  key={`label-${index}`}
                  x={point.x}
                  y={height - 10}
                  textAnchor={anchor}
                  className="chart-axis-label"
                >
                  {point.label}
                </text>
              )
            })}

            <rect
              x={padding.left}
              y={padding.top}
              width={plotWidth}
              height={plotHeight}
              fill="transparent"
              onPointerMove={handlePointer}
              onPointerDown={handlePointer}
              onPointerLeave={() => setHovered(null)}
              style={{ touchAction: 'pan-y' }}
            />
          </svg>

          {active && (
            <div
              className="chart-tooltip"
              style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
            >
              <span className="chart-tooltip-label">{active.label}</span>
              <strong>{formatValue(active.value)}</strong>
              {active.meta && <span className="chart-tooltip-meta">{active.meta}</span>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
