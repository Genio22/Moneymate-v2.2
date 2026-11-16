import { Loader2 } from 'lucide-react'

export function Spinner({ size = 'md', label, className = '' }) {
  const px = { sm: 16, md: 24, lg: 32 }[size] || 24
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-surface-500 ${className}`}>
      <Loader2 size={px} className="animate-spin text-primary-600" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}
