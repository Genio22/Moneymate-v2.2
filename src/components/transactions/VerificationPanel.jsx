import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { ShieldCheck, ShieldX, MessageCircleQuestion, Clock } from 'lucide-react'
import { expensesApi, verificationApi } from '../../services/expenses'
import { contributionsApi } from '../../services/contributions'
import { humanize } from '../../services/api'
import { Button } from '../common/Button'
import { Input } from '../common/inputs'
import { formatBDT } from '../../utils/money'
import { titleCase } from '../../utils/format'
import clsx from 'clsx'

/**
 * Verify / reject / ask-for-clarification panel.
 * Authority rules enforced again by mm_verify_expense / mm_verify_contribution
 * in the database — the UI only mirrors them.
 */
export function VerificationPanel({ expense, user, isManager, onDone, type = 'expense' }) {
  const [comment, setComment] = useState('')
  const [mode, setMode] = useState(null) // null | 'reject' | 'clarify'
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState(null)

  const isSubmitter = expense.created_by === user?.id
  const isSource = type === 'expense' && expense.source_provider_id === user?.id
  const canVerify =
    expense.status === 'pending' &&
    !isSubmitter &&
    (type === 'contribution' ? isManager || expense.contributor_user_id === user?.id : isSource || isManager)
  const waitingOn = isSubmitter
    ? type === 'expense'
      ? expense.funding_source === 'advance'
        ? expense.source_provider?.full_name || expense.advance?.provider_name || 'the money provider'
        : 'a project manager'
      : expense.contributor?.full_name || 'the contributor or a manager'
    : null

  const act = async (action) => {
    setBusy(true)
    try {
      if (type === 'expense') {
        await expensesApi.verify(expense.id, action, comment)
      } else {
        await contributionsApi.verify(expense.id, action, comment)
      }
      toast.success(
        action === 'verified' ? 'Verified and recorded.' : action === 'rejected' ? 'Transaction rejected.' : 'Clarification requested.',
      )
      setComment(null)
      setMode(null)
      loadHistory()
      onDone?.()
    } catch (e) {
      toast.error(humanize(e))
    } finally {
      setBusy(false)
    }
  }

  const loadHistory = async () => {
    try {
      const events = await verificationApi.events(type, expense.id)
      setHistory(events)
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-3">
      <div
        className={clsx(
          'rounded-xl p-4 ring-1 ring-inset',
          expense.status === 'verified' && 'bg-accent-50 ring-accent-200',
          expense.status === 'pending' && 'bg-amber-50 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30',
          expense.status === 'rejected' && 'bg-red-50 ring-red-200 dark:bg-red-500/10 dark:ring-red-500/30',
          expense.status === 'clarification' && 'bg-orange-50 ring-orange-200 dark:bg-orange-500/10 dark:ring-orange-500/30',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-surface-900">
            {titleCase(expense.status === 'verified' ? 'verified' : expense.status)} · {formatBDT(expense.amount_poisha)}
          </p>
          {expense.verified_by && expense.status !== 'pending' && (
            <p className="text-[11px] text-surface-500">
              by {expense.verifier?.full_name || expense.verified_by?.full_name}
            </p>
          )}
        </div>
        {expense.status === 'pending' && (
          <p className="mt-1 text-xs text-surface-600">
            {isSubmitter
              ? `Waiting for verification by ${waitingOn}.`
              : canVerify
                ? 'Review the details and confirm this transaction.'
                : 'You are not the assigned verifier for this transaction.'}
          </p>
        )}
      </div>

      {canVerify && (
        <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 space-y-3">
          {(type === 'expense' ? expense.funding_source === 'advance' : true) && (
            <p className="text-xs text-surface-600">
              {type === 'expense' && expense.funding_source === 'advance'
                ? 'Confirming means: I provided this money AND I authorized this purchase.'
                : 'Confirming means: this expense is genuine and for the project.'}
            </p>
          )}
          {mode === null ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="success" className="flex-1" onClick={() => act('verified')} loading={busy}>
                <ShieldCheck size={16} /> Yes, verify it
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setMode('clarify')}>
                <MessageCircleQuestion size={16} /> Ask for clarification
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => setMode('reject')}>
                <ShieldX size={16} /> Reject
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                autoFocus
                placeholder={mode === 'reject' ? 'Why are you rejecting it?' : 'What needs clarifying?'}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant={mode === 'reject' ? 'danger' : 'dark'} onClick={() => act(mode)} loading={busy}>
                  Confirm {mode === 'reject' ? 'rejection' : 'request'}
                </Button>
                <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <HistoryBlock loader={loadHistory} history={history} />
    </div>
  )
}

export function HistoryBlock({ history, loader, className }) {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState(history || null)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && !events && loader) {
      setLoading(true)
      await loader()
      setLoading(false)
    }
  }

  useEffect(() => {
    if (history) setEvents(history)
  }, [history])

  return (
    <div className={className}>
      <button onClick={toggle} className="text-xs font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
        <Clock size={13} /> {open ? 'Hide' : 'Show'} verification history
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {loading && <p className="text-xs text-surface-400">Loading…</p>}
          {events && events.length === 0 && <p className="text-xs text-surface-400">No verification actions recorded yet.</p>}
          {events?.map((ev) => (
            <div key={ev.id} className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-surface-800">
                  {ev.verifier_name || ev.verifier?.full_name || 'Unknown'} — {titleCase(ev.action)}
                </p>
                {ev.comment && <p className="text-[11px] text-surface-500 mt-0.5">“{ev.comment}”</p>}
              </div>
              <p className="text-[10px] text-surface-400 shrink-0">{new Date(ev.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
