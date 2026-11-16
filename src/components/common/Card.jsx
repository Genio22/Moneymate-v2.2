import clsx from 'clsx'

export function Card({ className, children, ...rest }) {
  return (
    <div className={clsx('bg-surface-50 rounded-xl border border-surface-200 shadow-card', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={clsx('flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5', className)}>
      <div>
        <h3 className="text-sm font-semibold text-surface-900">{title}</h3>
        {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, children }) {
  return <div className={clsx('px-4 sm:px-5 py-4 sm:py-5', className)}>{children}</div>
}

export function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base sm:text-lg font-semibold text-surface-900">{children}</h2>
      {action}
    </div>
  )
}
