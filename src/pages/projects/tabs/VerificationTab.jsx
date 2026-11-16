import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Hourglass, ArrowRight } from 'lucide-react'
import { expensesApi } from '../../../services/expenses'
import { contributionsApi } from '../../../services/contributions'
import { projectsApi } from '../../../services/projects'
import { useProject } from '../../../hooks/useProject'
import { useAuth } from '../../../contexts/AuthContext'
import { formatBDT } from '../../../utils/money'
import { formatDate, titleCase } from '../../../utils/format'
import { PageHeader } from '../../../components/layout/PageHeader'
import { DataState } from '../../../components/common/DataState'
import { StatusBadge } from '../../../components/common/Badge'
import { Card, CardBody } from '../../../components/common/Card'
import { VerificationPanel } from '../../../components/transactions/VerificationPanel'
import { Button } from '../../../components/common/Button'

/**
 * The verification inbox.
 * Scenario A (advance spending) -> the money provider verifies.
 * Scenario B (personal claims)  -> project managers verify.
 */
export default function VerificationTab() {
  const { projectId, project } = useProject()
  const { user, isSystemAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [contributions, setContributions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [role, setRole] = useState(null)
  const [managerCount, setManagerCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [exps, cons, members] = await Promise.all([
        expensesApi.myPendingVerifications(projectId, user.id),
        contributionsApi.list(projectId),
        projectsApi.members(projectId),
      ])
      const myRole = members.find((m) => m.user?.id === user?.id)?.role
      setRole(myRole)
      setManagerCount(members.filter((m) => m.role === 'manager').length)
      const canManager = myRole === 'manager'
      // Expenses I can act on:
      const mine = exps.filter((e) => {
        if (e.created_by === user.id) return false
        if (e.funding_source === 'advance') {
          return e.source_provider_id === user.id || (canManager && (e.source_provider_id == null || isSystemAdmin))
        }
        return canManager
      })
      setItems(mine)
      // Contributions pending where I can act (contributor or manager, not recorder-only)
      setContributions(
        cons.filter(
          (c) =>
            c.status === 'pending' &&
            (canManager || c.contributor_user_id === user.id) &&
            !(c.recorded_by === user.id && c.contributor_user_id !== user.id),
        ),
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [projectId, user.id, isSystemAdmin])

  useEffect(() => {
    load()
  }, [load])

  const others = []

  return (
    <div>
      <PageHeader
        title="Verification"
        subtitle="Confirm purchases made with money you provided, or claims as a manager"
      />

      {role === 'manager' && managerCount < 2 && (
        <Card className="mb-5 border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <CardBody>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">You are the only manager</p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">Your own expenses cannot be verified. Promote a trusted member to Manager before submitting manager-verified expenses.</p>
            <Link to={`/app/projects/${projectId}/members`} className="mt-2 inline-flex text-xs font-medium text-primary-700 dark:text-primary-300 hover:underline">
              Go to Members <ArrowRight size={12} className="ml-1" />
            </Link>
          </CardBody>
        </Card>
      )}

      <DataState
        loading={loading}
        error={error}
        onRetry={load}
        empty={items.length === 0 && contributions.length === 0}
        emptyTitle="Nothing waiting for you"
        emptyHint="When someone spends money you provided, or submits a claim, it appears here."
      >
        <div className="space-y-6">
          {items.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-surface-900 mb-2.5 flex items-center gap-2">
                <ShieldCheck size={15} className="text-primary-600" /> Transactions ({items.length})
              </h2>
              <div className="space-y-3">
                {items.map((e) => (
                  <Card key={e.id}>
                    <CardBody className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-surface-900">{e.title}</p>
                          <p className="text-xs text-surface-500 mt-0.5">
                            {e.paid_by_user?.full_name || 'Member'} · {titleCase(e.funding_source === 'advance' ? `advance from ${e.advance?.provider_name || 'provider'}` : e.funding_source === 'personal' ? 'personal money (claim)' : 'project cash')}
                          </p>
                          <p className="text-[11px] text-surface-400">
                            {e.reference} · {formatDate(e.purchased_on)} · {titleCase(e.category)}
                            {e.vendor ? ` · ${e.vendor}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-bold tnum">{formatBDT(e.amount_poisha)}</p>
                          <StatusBadge status={e.status} />
                        </div>
                      </div>
                      <VerificationPanel expense={e} user={user} isManager={role === 'manager'} onDone={load} type="expense" />
                      <Link
                        to={`/app/projects/${projectId}/transactions/${e.id}`}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                      >
                        Open full details <ArrowRight size={12} />
                      </Link>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {contributions.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-surface-900 mb-2.5 flex items-center gap-2">
                <Hourglass size={15} className="text-amber-500" /> Contributions ({contributions.length})
              </h2>
              <div className="space-y-3">
                {contributions.map((c) => (
                  <Card key={c.id}>
                    <CardBody className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-surface-900">{c.title}</p>
                          <p className="text-xs text-surface-500 mt-0.5">
                            {c.contributor_name} · {titleCase(c.contribution_type)} · {formatDate(c.received_on)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-bold tnum">{formatBDT(c.amount_poisha)}</p>
                          <StatusBadge status={c.status} />
                        </div>
                      </div>
                      <VerificationPanel expense={c} user={user} isManager={role === 'manager'} onDone={load} type="contribution" />
                      <Link
                        to={`/app/projects/${projectId}/contributions/${c.id}`}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                      >
                        Open full details <ArrowRight size={12} />
                      </Link>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      </DataState>
    </div>
  )
}
