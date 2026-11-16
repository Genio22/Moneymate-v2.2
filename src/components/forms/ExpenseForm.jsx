import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import {
  Wallet, HandCoins, Banknote, ChevronLeft, Info, AlertTriangle, ArrowRight,
} from 'lucide-react'
import { expenseSchema } from '../../schemas'
import { expensesApi } from '../../services/expenses'
import { advancesApi } from '../../services/advances'
import { allocationsApi } from '../../services/contributions'
import { projectsApi } from '../../services/projects'
import { uploadReceipts } from '../../services/storage'
import { humanize } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { parseTakaToPoisha, formatBDT, poishaToTaka } from '../../utils/money'
import { EXPENSE_CATEGORIES, EXPENSE_SOURCES } from '../../constants'
import { todayISO, titleCase } from '../../utils/format'
import { Button } from '../common/Button'
import { Input, Label, Select, Textarea, AmountInput, FieldError } from '../common/inputs'
import { FileUpload } from './FileUpload'
import clsx from 'clsx'

/**
 * The ONE form members use to record a purchase.
 * Plain-language questions only; accounting is handled by the database.
 * Pass `existing` to edit a pending transaction (updates instead of creating).
 */
export function ExpenseForm({ projectId, projects = [], existing = null, onCreated }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [members, setMembers] = useState([])
  const [advances, setAdvances] = useState([])
  const [allocations, setAllocations] = useState([])
  const [files, setFiles] = useState([])
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: existing
      ? {
          project_id: existing.project_id,
          title: existing.title,
          amount: poishaToTaka(existing.amount_poisha),
          purchased_on: existing.purchased_on,
          category: existing.category,
          funding_source: existing.funding_source,
          advance_id: existing.advance_id || '',
          allocation_id: existing.contribution_allocation_id || '',
          vendor: existing.vendor || '',
          notes: existing.notes || '',
        }
      : {
          project_id: projectId || (projects.length === 1 ? projects[0].id : ''),
          title: '',
          amount: '',
          purchased_on: todayISO(),
          category: 'misc',
          funding_source: 'personal',
          advance_id: '',
          allocation_id: '',
          vendor: '',
          notes: '',
        },
  })

  const values = watch()
  const fundingSource = values.funding_source
  const advanceId = values.advance_id
  const allocationId = values.allocation_id
  const amountPoisha = parseTakaToPoisha(values.amount)

  // Load supporting data
  useEffect(() => {
    let alive = true
    const pid = projectId || values.project_id
    if (!pid || !user) {
      setMembers([])
      setAdvances([])
      setAllocations([])
      return
    }
    ;(async () => {
      try {
        const [m, a, al] = await Promise.all([
          projectsApi.members(pid),
          advancesApi.list(pid, { custodian: user.id }),
          allocationsApi.listByProject(pid),
        ])
        if (!alive) return
        setMembers(m.filter((x) => x.user))
        setAdvances(a.filter((x) => x.status === 'active' && (x.remaining_poisha ?? 0) > 0))
        setAllocations(al.filter((x) => (x.remaining_poisha ?? 0) > 0))
      } catch { /* non-fatal */ }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, values.project_id, user?.id])

  const selectedAdvance = useMemo(() => advances.find((a) => a.id === advanceId), [advances, advanceId])
  const selectedAllocation = useMemo(() => allocations.find((a) => a.id === allocationId), [allocations, allocationId])
  const managerCount = members.filter((m) => m.role === 'manager').length
  const isManager = members.some((m) => m.user?.id === user?.id && m.role === 'manager')
  const requiresManagerVerification = fundingSource !== 'advance' ||
    (selectedAdvance && (!selectedAdvance.provider_user_id || selectedAdvance.provider_user_id === user?.id))
  const needsAnotherManager = isManager && requiresManagerVerification && managerCount < 2

  // Client-side warnings mirroring server-side rules (server is authoritative)
  const advanceOver = selectedAdvance && amountPoisha != null && amountPoisha > selectedAdvance.remaining_poisha
  const allocOver = selectedAllocation && amountPoisha != null && amountPoisha > selectedAllocation.remaining_poisha
  const categoryMismatch = selectedAllocation && amountPoisha != null && values.category !== selectedAllocation.category

  // When an allocation is chosen, its permitted category drives the purpose
  useEffect(() => {
    if (selectedAllocation) setValue('category', selectedAllocation.category)
  }, [selectedAllocation, setValue])

  const onSubmit = async (data) => {
    setSubmitError(null)
    setSubmitting(true)
    const finish = (expense) => {
      setSubmitting(false)
      if (onCreated) onCreated(expense)
      else navigate(`/app/projects/${expense.project_id}/transactions/${expense.id}`)
    }
    try {
      const expense = existing
        ? await expensesApi.update(existing.id, data)
        : await expensesApi.create({
            ...data,
            paid_by: data.paid_by || user.id,
            created_by: user.id,
          })
      if (files.length) {
        try {
          await uploadReceipts(expense.project_id, 'expense', expense.id, files)
        } catch (e) {
          toast.error(`Expense saved, but a receipt failed to upload: ${humanize(e)}`)
          finish(expense)
          return
        }
      }
      toast.success(
        existing
          ? 'Updated — it will be verified again.'
          : expense.funding_source === 'advance'
            ? 'Submitted — the money provider has been asked to verify.'
            : 'Submitted — a project manager has been asked to verify.',
      )
      finish(expense)
    } catch (e) {
      setSubmitError(humanize(e))
      setSubmitting(false)
    }
  }

  if (!projectId && projects.length === 0) {
    return (
      <div className="rounded-xl border border-surface-200 bg-surface-50 p-8 text-center">
        <Wallet className="mx-auto text-surface-300" size={32} />
        <p className="mt-3 font-medium text-surface-800">No projects yet</p>
        <p className="text-sm text-surface-500 mt-1">Create or join a project before recording expenses.</p>
        <Button className="mt-4" onClick={() => navigate('/app/projects/new')}>Create a project</Button>
      </div>
    )
  }

  const memberOptions = members.map((m) => ({ value: m.user.id, label: m.user.full_name || 'Unnamed' }))

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Step 1-3: basics */}
      <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 sm:p-5 space-y-4">
        <div>
          <Label required>What did you buy?</Label>
          <Input
            placeholder="e.g. Decoration materials, banner printing…"
            error={errors.title?.message}
            {...register('title')}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label required>How much did it cost?</Label>
            <AmountInput placeholder="0.00" error={errors.amount?.message} {...register('amount')} />
          </div>
          <div>
            <Label required>When?</Label>
            <Input type="date" max={todayISO()} error={errors.purchased_on?.message} {...register('purchased_on')} />
          </div>
        </div>
        {!projectId && (
          <div>
            <Label required>Which project?</Label>
            <Select {...register('project_id')} error={errors.project_id?.message}>
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label required hint="what it was for">Purpose</Label>
            <Select {...register('category')} error={errors.category?.message} disabled={Boolean(selectedAllocation)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{titleCase(c)}</option>
              ))}
            </Select>
            {selectedAllocation && (
              <p className="mt-1 text-[11px] text-amber-600">Fixed to “{titleCase(selectedAllocation.category)}” by the restricted fund.</p>
            )}
          </div>
          <div>
            <Label>Shop / vendor</Label>
            <Input placeholder="Optional" {...register('vendor')} />
          </div>
        </div>
      </div>

      {/* Step 4-5: who paid & where the money came from */}
      <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 sm:p-5 space-y-4">
        <div>
          <Label required>Who paid?</Label>
          <Select {...register('paid_by')} defaultValue={existing ? existing.paid_by : user?.id}>
            <option value={user?.id}>I paid (me)</option>
            {memberOptions.filter((m) => m.value !== user?.id).map((m) => (
              <option key={m.value} value={m.value}>{m.label} paid</option>
            ))}
          </Select>
        </div>

        <div>
          <Label required>Where did the money come from?</Label>
          <div className="grid sm:grid-cols-3 gap-2">
            {EXPENSE_SOURCES.map((s) => {
              const icons = { advance: HandCoins, personal: Banknote, project_cash: Wallet }
              const Icon = icons[s.value]
              const active = fundingSource === s.value
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    setValue('funding_source', s.value)
                    setValue('advance_id', '')
                    setValue('allocation_id', '')
                  }}
                  className={clsx(
                    'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition',
                    active ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-surface-200 bg-surface-50 hover:border-surface-300',
                  )}
                >
                  <span className={clsx('flex items-center gap-1.5 text-sm font-semibold', active ? 'text-primary-700' : 'text-surface-700')}>
                    <Icon size={15} /> {titleCase(s.label.split('(')[0].trim())}
                  </span>
                  <span className="text-[11px] text-surface-500 leading-snug">{s.label.match(/\((.*)\)/)?.[1] || ''}</span>
                </button>
              )
            })}
          </div>
        </div>

        {fundingSource === 'advance' && (
          <div>
            <Label required>Which advance did you spend from?</Label>
            {advances.length === 0 ? (
              <div className="rounded-lg bg-amber-50 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
                No advance is currently held by you in this project. If someone gave you money, ask them (or a manager)
                to record it under <b>Advances</b> first.
              </div>
            ) : (
              <div className="space-y-2">
                {advances.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setValue('advance_id', a.id)}
                    className={clsx(
                      'w-full flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition',
                      advanceId === a.id ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-surface-200 hover:border-surface-300',
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-surface-800">
                        {formatBDT(a.amount_poisha)} from {a.provider_name}
                      </p>
                      <p className="text-[11px] text-surface-500">{a.reference} · {a.purpose || 'no purpose noted'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold tnum text-accent-700">{formatBDT(a.remaining_poisha)} left</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <FieldError message={errors.advance_id?.message} />
          </div>
        )}

        {(fundingSource === 'advance' || fundingSource === 'project_cash') && allocations.length > 0 && (
          <div>
            <Label hint="optional">Use a restricted sponsor fund?</Label>
            <Select {...register('allocation_id')}>
              <option value="">No — unrestricted / general funds</option>
              {allocations.map((al) => (
                <option key={al.id} value={al.id}>
                  {al.contribution_title} → {titleCase(al.category)} ({formatBDT(al.remaining_poisha)} left)
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-surface-400">
              Restricted funds can only pay for their agreed purpose. The balance shown is what is left.
            </p>
          </div>
        )}

        {(advanceOver || allocOver || categoryMismatch) && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30 px-3 py-2.5">
            <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
              {advanceOver && <p>Amount exceeds this advance's remaining {formatBDT(selectedAdvance.remaining_poisha)}. Reduce the amount or split into two expenses.</p>}
              {allocOver && <p>Amount exceeds this restricted fund's remaining {formatBDT(selectedAllocation.remaining_poisha)}.</p>}
              {categoryMismatch && <p>This restricted fund only permits “{titleCase(selectedAllocation.category)}” spending.</p>}
            </div>
          </div>
        )}

        {fundingSource === 'personal' && (
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/30 px-3 py-2.5">
            <Info size={15} className="text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800 dark:text-blue-300">
              This becomes a <b>reimbursement claim</b>: after a manager verifies it, the project will owe you{' '}
              {amountPoisha != null ? formatBDT(amountPoisha) : 'this amount'}.
            </p>
          </div>
        )}
      </div>

      {/* Step 6: receipt */}
      <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 sm:p-5 space-y-3">
        <div>
          <Label required>Receipt / photo proof</Label>
          <p className="text-xs text-surface-500 -mt-1 mb-2">A photo of the receipt (or the item) helps the verifier trust the purchase.</p>
          <FileUpload files={files} onChange={setFiles} />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea rows={2} placeholder="Anything the verifier should know…" {...register('notes')} />
        </div>
      </div>

      {needsAnotherManager && (
        <div className="rounded-lg bg-amber-50 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-semibold">Another manager must verify this expense.</p>
          <p className="mt-0.5 text-xs">You are the only manager. You cannot verify your own expense. Add a trusted manager first.</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => navigate(`/app/projects/${projectId || values.project_id}/members`)}>
            Go to Members
          </Button>
        </div>
      )}

      {submitError && (
        <div className="rounded-lg bg-red-50 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:ring-red-500/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">{submitError}</div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
        <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} /> Cancel
        </Button>
        <Button type="submit" size="lg" loading={submitting} disabled={needsAnotherManager} className="flex-1">
          Submit for verification <ArrowRight size={16} />
        </Button>
      </div>
      <p className="text-[11px] text-surface-400 text-center -mt-1">
        It will appear in project activity immediately as <b>Pending verification</b>. You'll be notified once verified.
      </p>
    </form>
  )
}
