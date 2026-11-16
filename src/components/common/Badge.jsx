import clsx from 'clsx'
import { titleCase } from '../../utils/format'

const tones = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  verified: 'bg-accent-50 text-accent-700 ring-accent-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30',
  clarification: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/30',
  active: 'bg-accent-50 text-accent-700 ring-accent-200',
  draft: 'bg-surface-100 text-surface-600 ring-surface-200',
  on_hold: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/30',
  completed: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30',
  archived: 'bg-surface-100 text-surface-500 ring-surface-200',
  outstanding: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  partially_reimbursed: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30',
  fully_reimbursed: 'bg-accent-50 text-accent-700 ring-accent-200',
  own_funds: 'bg-surface-100 text-surface-600 ring-surface-200',
  project_cash: 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/30',
  advance: 'bg-surface-100 text-surface-600 ring-surface-200',
  personal: 'bg-surface-100 text-surface-600 ring-surface-200',
  manager: 'bg-primary-50 text-primary-700 ring-primary-200',
  member: 'bg-surface-100 text-surface-600 ring-surface-200',
  viewer: 'bg-surface-100 text-surface-500 ring-surface-200',
  default: 'bg-surface-100 text-surface-600 ring-surface-200',
}

export function Badge({ value, tone, className, children }) {
  const key = tones[value] ? value : tone || 'default'
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap',
        tones[key],
        className,
      )}
    >
      {children ?? titleCase(value)}
    </span>
  )
}

export function StatusBadge({ status }) {
  return <Badge value={status} />
}
