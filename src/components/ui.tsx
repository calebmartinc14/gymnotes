import type { ReactNode } from 'react'
import { LEVELS } from '../lib/calc'
import { levelLabel, useI18n } from '../lib/i18n'

export function PageHead({
  kicker,
  title,
  subtitle,
  actions,
}: {
  kicker: string
  title: string
  subtitle: string
  actions?: ReactNode
}) {
  return (
    <header className="page-head">
      <div>
        <span className="page-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  )
}

export function LevelPill({
  level,
  color,
  small = false,
}: {
  level: string
  color: string
  small?: boolean
}) {
  return (
    <span
      className={`level-pill${small ? ' level-pill-sm' : ''}`}
      style={{ color, backgroundColor: `${color}18`, borderColor: `${color}3b` }}
    >
      <span className="level-dot" style={{ backgroundColor: color }} />
      {level}
    </span>
  )
}

export function LevelBar({ score, color }: { score: number; color: string }) {
  const { t } = useI18n()
  return (
    <div className="level-bar" aria-hidden="true">
      <div className="level-bar-track">
        <div
          className="level-bar-fill"
          style={{
            width: `${Math.max(2, Math.min(100, score))}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
          }}
        />
        {LEVELS.slice(1).map((label, index) => (
          <span
            key={label}
            className="level-bar-tick"
            style={{ left: `${((index + 1) / LEVELS.length) * 100}%` }}
          />
        ))}
      </div>
      <div className="level-bar-labels">
        <span>{levelLabel(LEVELS[0], t)}</span>
        <span>{levelLabel(LEVELS[LEVELS.length - 1], t)}</span>
      </div>
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = false,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon: ReactNode
  accent?: boolean
}) {
  return (
    <div className={`stat-card${accent ? ' stat-card-accent' : ''}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-copy">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}
