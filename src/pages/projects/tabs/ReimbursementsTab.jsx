import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { HandHeart, Plus } from 'lucide-react'
import { reimbursementsApi } from '../../../services/reimbursements'
import { settleSchema } from '../../../schemas'
import { useProject } from '../../../hooks/useProject'
import { useAuth } from '../../../contexts/AuthContext'
import { formatBDT, poishaToTaka } from '../../../utils/money'
import { formatDate, titleCase, todayISO } from '../../../utils/format'
import { PageHeader } from '../../../components/layout/PageHeader'
import { DataState } from '../../../components/common/DataState'
import { StatusBadge } from '../../../components/common/Badge'
import { Card, CardBody } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { Modal } from '../../../components/common/Modal'
import { Input, Label, Select, Textarea, AmountInput } from '../../../components/common/inputs'
import { PAYMENT_METHODS } from '../../../constants'

export default function ReimbursementsTab() {
  const { projectId, isManager, summary } = useProject()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [payTarget, setPayTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await reimbursementsApi.list(projectId)
      setItems(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  const visible = isManager ? items : items.filter((r) => r.payee_id === user?.id)
  const outstanding = visible.filter((r) => r.status !== 'fully_reimbursed')

  return (
    <div>
      <PageHeader
        title="Reimbursements"
        subtitle={`${formatBDT(summary?.reimbursements_outstanding ?? 0)} owed to members · ${formatBDT(summary?.reimbursements_paid ?? 0)} settled so far`}
      />

      {!isManager && (
        <div className="mb-4 rounded-xl bg-blue-50 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/30 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          You see your own claims here. Submit them as <b>personal-money expenses</b> — once verified they appear as
          money the project owes you.
        </div>
      )}

      <DataState loading={loading} error={error} onRetry={load} empty={visible.length === 0} emptyTitle="No reimbursement claims" emptyHint="Verified personal expenses appear here as claims to settle.">
        <div className="space-y-3">
          {outstanding.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-surface-900 mb-2">Outstanding ({outstanding.length})</h2>
              <div className="space-y-2.5">
                {outstanding.map((r) => <ClaimCard key={r.id} r={r} onPay={() => setPayTarget(r)} canPay={isManager} projectId={projectId} />)}
              </div>
            </section>
          )}
          {items.filter((r) => r.status === 'fully_reimbursed').length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-surface-900 mb-2">Fully settled</h2>
              <div className="space-y-2.5 opacity-80">
                {items.filter((r) => r.status === 'fully_reimbursed').map((r) => <ClaimCard key={r.id} r={r} projectId={projectId} />)}
              </div>
            </section>
          )}
        </div>
      </DataState>

      <PayModal
        target={payTarget}
        onClose={() => setPayTarget(null)}
        onSaved={() => {
          setPayTarget(null)
          load()
        }}
      />
    </div>
  )
}

function ClaimCard({ r, onPay, canPay, projectId }) {
  const paid = r.amount_poisha - r.outstanding_poisha
  const pct = r.amount_poisha ? Math.round((paid / r.amount_poisha) * 100) : 0
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-surface-900">{r.expense?.title || 'Claim'}</p>
            <p className="text-xs text-surface-500 mt-0.5">
              {r.payee?.full_name || 'Member'} · {r.expense?.reference} · {formatDate(r.expense?.purchased_on)} · {titleCase(r.expense?.category || '')}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold tnum">{formatBDT(r.amount_poisha)}</p>
            <p className={`text-[11px] tnum ${r.outstanding_poisha > 0 ? 'text-amber-600' : 'text-accent-700'}`}>
              {r.outstanding_poisha > 0 ? `${formatBDT(r.outstanding_poisha)} owed` : 'fully settled'}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
            <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {r.payments?.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {r.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-1.5 text-[11px] text-surface-600">
                <span>Paid {formatDate(p.paid_on)} · {titleCase(p.method)}{p.reference ? ` · ${p.reference}` : ''}</span>
                <span className="font-semibold tnum">{formatBDT(p.amount_poisha)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <StatusBadge status={r.status} />
          {canPay && r.outstanding_poisha > 0 && (
            <Button size="sm" className="ml-auto" onClick={onPay}>
              Record payment
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => window.location.assign(`/app/projects/${projectId}/transactions/${r.expense_id}`)}>
            View expense
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function PayModal({ target, onClose, onSaved }) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(settleSchema),
    defaultValues: {
      amount: target ? poishaToTaka(target.outstanding_poisha) : '',
      paid_on: todayISO(),
      method: 'cash',
      reference: '',
      notes: '',
    },
  })
  const [error, setError] = useState(null)

  if (!target) return null

  const onSubmit = async (data) => {
    setError(null)
    try {
      await reimbursementsApi.settle(data, target.id)
      toast.success('Payment recorded.')
      onSaved?.()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Modal open onClose={onClose} title="Record reimbursement payment" subtitle={`${target.payee?.full_name} is owed ${formatBDT(target.outstanding_poisha)}`} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Label required>Amount paid (৳)</Label>
          <AmountInput placeholder="0.00" error={errors.amount?.message} {...register('amount')} />
          <p className="mt-1 text-[11px] text-surface-400">
            Partial payments are supported — the claim stays open until fully settled.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label required>Date</Label>
            <Input type="date" error={errors.paid_on?.message} {...register('paid_on')} />
          </div>
          <div>
            <Label required>Method</Label>
            <Select {...register('method')}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <Label>Reference</Label>
          <Input placeholder="Txn ID / receipt no." {...register('reference')} />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea rows={2} {...register('notes')} />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Record payment</Button>
        </div>
      </form>
    </Modal>
  )
}
