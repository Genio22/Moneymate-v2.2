import clsx from 'clsx'
import { formatBDT } from '../../utils/money'

export function StatCard({ label, value, hint, tone = 'default', icon: Icon, onClick, className }) {
  const tones = {
    default: 'text-surface-900',
    positive: 'text-accent-700',
    negative: 'text-red-600',
    primary: 'text-primary-700',
    warning: 'text-amber-600',
  }
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-surface-50 rounded-xl border border-surface-200 shadow-card p-4',
        onClick && 'cursor-pointer hover:border-surface-300 transition',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-surface-500">{label}</p>
        {Icon && (
          <span className="text-surface-300">
            <Icon size={16} />
          </span>
        )}
      </div>
      <p className={clsx('mt-1.5 text-xl sm:text-2xl font-bold tnum tracking-tight', tones[tone])}>
        {typeof value === 'number' ? formatBDT(value) : value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-surface-400 leading-snug">{hint}</p>}
    </div>
  )
}
