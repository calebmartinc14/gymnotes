import { addDays, formatWeekday } from '../lib/calc'
import type { HeatmapCell, HeatmapGrid } from '../lib/habits'

const REFERENCE_MONDAY = '2024-01-01'
const WEEKDAY_ROWS = Array.from({ length: 7 }, (_, index) => addDays(REFERENCE_MONDAY, index))

export function Heatmap({
  grid,
  label,
  ariaLabel,
  compact = false,
}: {
  grid: HeatmapGrid
  label: (cell: HeatmapCell) => string
  ariaLabel: string
  compact?: boolean
}) {
  return (
    <div className={`heatmap${compact ? ' heatmap-compact' : ''}`}>
      <div className="heatmap-weekdays" aria-hidden="true">
        {WEEKDAY_ROWS.map((date, index) => (
          <span key={date}>{index % 2 === 0 ? formatWeekday(date) : ''}</span>
        ))}
      </div>
      <div className="heatmap-scroll">
        <div className="heatmap-grid" role="img" aria-label={ariaLabel}>
          {grid.map((week) => (
            <div className="heatmap-week" key={week[0]?.date}>
              {week.map((cell) => (
                <span
                  key={cell.date}
                  className={`heat-cell heat-${cell.level}${cell.future ? ' is-future' : ''}`}
                  title={label(cell)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function HeatLegend({ less, more }: { less: string; more: string }) {
  return (
    <div className="heat-legend" aria-hidden="true">
      <span>{less}</span>
      {[0, 1, 2, 3, 4].map((level) => (
        <span key={level} className={`heat-cell heat-${level}`} />
      ))}
      <span>{more}</span>
    </div>
  )
}
