import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, HandCoins, CheckCircle2, ChevronDown } from 'lucide-react'
import { advancesApi } from '../../../services/advances'
import { useProject } from '../../../hooks/useProject'
import { useAuth } from '../../../contexts/AuthContext'
import { formatBDT } from '../../../utils/money'
import { formatDate, titleCase } from '../../../utils/format'
import { PageHeader } from '../../../components/layout/PageHeader'
import { DataState } from '../../../components/common/DataState'
import { Badge, StatusBadge } from '../../../components/common/Badge'
import { Button } from '../../../components/common/Button'
import { Card, CardBody } from '../../../components/common/Card'
import { Modal } from '../../../components/common/Modal'
import { AdvanceForm } from '../../../components/contributions/AdvanceForm'
import { StatusBadge as SB } from '../../../components/common/Badge'
import clsx from 'clsx'

export default function AdvancesTab() {
  const { projectId, summary } = useProject()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [expanded, setExpanded] = useState(null)

  const load = () => {
    setLoading(true)
    advancesApi
      .list(projectId)
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const confirmReceipt = async (id) => {
    try {
      await advancesApi.confirm(id)
      toast.success('Receipt confirmed — thank you!')
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Advances"
        subtitle={`${formatBDT(summary?.custodial_cash ?? 0)} currently held by members · spent advances reconcile here`}
        action={
          <Button size="md" onClick={() => setFormOpen(true)}>
            <Plus size={16} /> Record advance
          </Button>
        }
      />

      <DataState loading={loading} error={error} onRetry={load} empty={items.length === 0} emptyTitle="No advances yet" emptyHint='Record money handed from one person to another, e.g. "Rahim gave Karim ৳500 for decoration."'>
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id}>
              <CardBody className="p-0">
                <button
                  onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  className="w-full text-left p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                        <HandCoins size={17} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-surface-900 truncate">
                          {a.provider_name} → {a.custodian?.full_name || 'member'}
                        </p>
                        <p className="text-xs text-surface-500 truncate">
                          {a.reference} · {formatDate(a.provided_on)} · {a.purpose || 'no purpose noted'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tnum text-surface-900">{formatBDT(a.amount_poisha)}</p>
                      <p className="text-[11px] tnum text-accent-700">{formatBDT(a.remaining_poisha)} left</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <SB status={a.status === 'active' ? 'active' : a.status} />
                    <Badge value={a.funding_source} />
                    {a.custodian_confirmed_at ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-accent-700">
                        <CheckCircle2 size={12} /> receipt confirmed
                      </span>
                    ) : a.custodian_id === user?.id ? (
                      <span className="text-[11px] text-amber-600">awaiting your confirmation</span>
                    ) : (
                      <span className="text-[11px] text-surface-400">receipt not confirmed yet</span>
                    )}
                    <ChevronDown size={14} className={clsx('ml-auto text-surface-400 transition-transform', expanded === a.id && 'rotate-180')} />
                  </div>
                </button>

                {expanded === a.id && (
                  <div className="border-t border-surface-100 px-4 sm:px-5 py-4 bg-surface-50/60 rounded-b-xl">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {a.custodian_id === user?.id && !a.custodian_confirmed_at && a.status === 'active' && (
                        <Button size="sm" variant="success" onClick={() => confirmReceipt(a.id)}>
                          <CheckCircle2 size={14} /> Confirm I received this money
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/app/projects/${projectId}/transactions/new`)}>
                        Record spending from this advance
                      </Button>
                    </div>
                    <AdvanceExpenses advanceId={a.id} />
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </DataState>

      <AdvanceForm
        projectId={projectId}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        defaultCustodianId=""
      />
    </div>
  )
}

function AdvanceExpenses({ advanceId }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    advancesApi.expensesFor(advanceId).then(setRows).catch(() => setRows([]))
  }, [advanceId])

  if (!rows) return <p className="text-xs text-surface-400">Loading spending…</p>
  if (!rows.length) return <p className="text-xs text-surface-400">No spending recorded against this advance yet.</p>

  const verified = rows.filter((r) => r.status === 'verified').reduce((s, r) => s + r.amount_poisha, 0)
  const pending = rows.filter((r) => ['pending', 'clarification'].includes(r.status)).reduce((s, r) => s + r.amount_poisha, 0)

  return (
    <div>
      <p className="text-xs font-semibold text-surface-700 mb-2">
        Spending — {formatBDT(verified)} reconciled{pending > 0 ? `, ${formatBDT(pending)} pending verification` : ''}
      </p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg bg-surface-50 border border-surface-100 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-surface-800 truncate">{r.title}</p>
              <p className="text-[10px] text-surface-400">
                {r.paid_by_user?.full_name || ''} · {formatDate(r.purchased_on)} · {titleCase(r.category)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold tnum">{formatBDT(r.amount_poisha)}</p>
              <SB status={r.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
