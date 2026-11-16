import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function PageHeader({ title, subtitle, backTo, action, className = '' }) {
  return (
    <div className={`mb-5 ${className}`}>
      {backTo && (
        <Link to={backTo} className="inline-flex items-center gap-1 text-xs font-medium text-surface-500 hover:text-surface-700 mb-2">
          <ArrowLeft size={14} /> Back
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-surface-500">{subtitle}</p>}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    </div>
  )
}
