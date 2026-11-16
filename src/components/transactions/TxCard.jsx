import { Link } from 'react-router-dom'
import { Paperclip, ShieldAlert } from 'lucide-react'
import { formatBDT } from '../../utils/money'
import { formatDate, titleCase } from '../../utils/format'
import { Badge, StatusBadge } from '../common/Badge'

const SOURCE_LABEL = {
  advance: 'Advance',
  personal: 'Personal',
  project_cash: 'Project cash',
}

/** Compact transaction row used in lists. */
export function TxCard({ expense, projectId, showProject = false }) {
  const href = `/app/projects/${expense.project_id || projectId}/transactions/${expense.id}`
  return (
    <Link
      to={href}
      className="block rounded-xl border border-surface-200 bg-surface-50 hover:border-surface-300 hover:shadow-card transition p-3.5 sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-surface-900 truncate">
            {expense.title}
            {expense.restriction_exception && (
              <ShieldAlert size={13} className="inline ml-1.5 text-amber-500 -mt-0.5" />
            )}
          </p>
          <p className="mt-0.5 text-xs text-surface-500 truncate">
            {showProject && expense.project?.name && <span className="font-medium text-surface-600">{expense.project.name} · </span>}
            {expense.paid_by_user?.full_name || 'Unknown'} · {titleCase(SOURCE_LABEL[expense.funding_source] || expense.funding_source)}
            {expense.advance?.reference ? ` · ${expense.advance.reference}` : ''}
            {expense.allocation ? ` · fund: ${titleCase(expense.allocation.category)}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold tnum text-surface-900">{formatBDT(expense.amount_poisha)}</p>
          <p className="text-[11px] text-surface-400">{formatDate(expense.purchased_on)}</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        <StatusBadge status={expense.status} />
        {expense.restriction_exception && <Badge tone="amber" value="pending">Restricted-fund review</Badge>}
        <span className="text-[11px] text-surface-400">{expense.reference}</span>
        <span className="text-[11px] text-surface-400">· {titleCase(expense.category)}</span>
      </div>
    </Link>
  )
}

/** Skeleton row. */
export function TxCardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 animate-pulse">
      <div className="flex justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="h-3.5 bg-surface-100 rounded w-1/2" />
          <div className="h-2.5 bg-surface-100 rounded w-1/3" />
        </div>
        <div className="h-4 w-16 bg-surface-100 rounded" />
      </div>
    </div>
  )
}
