import { Inbox, AlertTriangle, Loader2 } from 'lucide-react'
import { Spinner } from './Spinner'

/** Loading / empty / error wrapper for lists & details. */
export function DataState({ loading, error, empty, emptyTitle = 'Nothing here yet', emptyHint, children, onRetry }) {
  if (loading) return <div className="py-14 flex justify-center"><Spinner label="Loading…" /></div>
  if (error) {
    return (
      <div className="py-10 text-center px-4">
        <div className="mx-auto w-11 h-11 rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300 flex items-center justify-center mb-3">
          <AlertTriangle size={20} />
        </div>
        <p className="text-sm text-surface-700 font-medium mb-1">Something went wrong</p>
        <p className="text-sm text-surface-500 max-w-md mx-auto mb-4">{error}</p>
        {onRetry && (
          <button onClick={onRetry} className="text-sm font-medium text-primary-600 hover:text-primary-700">
            Try again
          </button>
        )}
      </div>
    )
  }
  if (empty) {
    return (
      <div className="py-10 text-center px-4">
        <div className="mx-auto w-11 h-11 rounded-full bg-surface-100 text-surface-400 flex items-center justify-center mb-3">
          <Inbox size={20} />
        </div>
        <p className="text-sm text-surface-700 font-medium">{emptyTitle}</p>
        {emptyHint && <p className="text-sm text-surface-500 max-w-md mx-auto mt-1">{emptyHint}</p>}
      </div>
    )
  }
  return children
}
