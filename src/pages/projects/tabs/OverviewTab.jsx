import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BanknoteArrowDown, BanknoteArrowUp, Hourglass, HandHeart, Boxes, Landmark, ArrowRight, HandCoins,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { expensesApi } from '../../../services/expenses'
import { allocationsApi } from '../../../services/contributions'
import { useProject } from '../../../hooks/useProject'
import { formatBDT, formatBDTCompact } from '../../../utils/money'
import { titleCase } from '../../../utils/format'
import { StatCard } from '../../../components/common/StatCard'
import { Card, CardHeader, CardBody, SectionTitle } from '../../../components/common/Card'
import { DataState } from '../../../components/common/DataState'
import { Badge } from '../../../components/common/Badge'
import { TxCard } from '../../../components/transactions/TxCard'
import { Button } from '../../../components/common/Button'

const PIE_COLORS = ['#254feb', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#84cc16', '#64748b']

export default function OverviewTab() {
  const { projectId, project, summary } = useProject()
  const [recent, setRecent] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [byCategory, setByCategory] = useState([])
  const [allocations, setAllocations] = useState([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [exps, allocs] = await Promise.all([
          expensesApi.list(projectId),
          allocationsApi.listByProject(projectId),
        ])
        if (!alive) return
        setRecent(exps.slice(0, 6))
        const agg = {}
        for (const e of exps.filter((x) => x.status === 'verified')) {
          agg[e.category] = (agg[e.category] || 0) + e.amount_poisha
        }
        setByCategory(Object.entries(agg).map(([name, value]) => ({ name: titleCase(name), value: value / 100 })))
        setAllocations(allocs)
      } catch { /* non-fatal */ }
      finally { if (alive) setLoadingRecent(false) }
    })()
    return () => { alive = false }
  }, [projectId])

  const s = summary || {}
  const budget = project?.initial_budget || 0
  const usedPct = budget ? Math.min(100, Math.round(((s.expenses_verified || 0) / budget) * 100)) : null

  return (
    <div className="space-y-6">
      {/* Key figures */}
      <div>
        <SectionTitle>Financial position</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Remaining cash (verified)"
            value={s.available_cash ?? 0}
            tone={(s.available_cash ?? 0) >= 0 ? 'primary' : 'negative'}
            hint={
              s.pending_cash_delta
                ? `after pending items: ${formatBDT(s.projected_cash)}`
                : 'includes advance spending'
            }
            icon={Landmark}
          />
          <StatCard
            label="Cash received (verified)"
            value={s.cash_in_verified ?? 0}
            tone="positive"
            hint={(s.cash_in_pending ?? 0) > 0 ? `+ ${formatBDT(s.cash_in_pending)} pending` : 'verified contributions only'}
            icon={BanknoteArrowUp}
          />
          <StatCard
            label="Spent (verified)"
            value={s.expenses_verified ?? 0}
            hint={(s.advance_spent_pending ?? 0) + (s.project_cash_spent_pending ?? 0) > 0
              ? `${formatBDT((s.advance_spent_pending ?? 0) + (s.project_cash_spent_pending ?? 0))} pending`
              : undefined}
            icon={BanknoteArrowDown}
          />
          <StatCard
            label="Owed to members"
            value={s.reimbursements_outstanding ?? 0}
            tone={(s.reimbursements_outstanding ?? 0) > 0 ? 'warning' : 'default'}
            hint={`${formatBDT(s.reimbursements_paid ?? 0)} already reimbursed`}
            icon={HandHeart}
          />
        </div>
      </div>

      {/* Secondary figures */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Non-cash contributions"
          value={s.noncash_verified ?? 0}
          hint="materials, assets & access — not spendable cash"
          icon={Boxes}
        />
        <StatCard
          label="Held by members (advances)"
          value={s.custodial_cash ?? 0}
          hint="money physically with custodians"
          icon={HandCoins}
        />
        <StatCard
          label="Personal claims pending"
          value={s.personal_claims_pending ?? 0}
          hint="waiting for manager verification"
          icon={Hourglass}
        />
        <StatCard
          label="Initial budget"
          value={budget || 0}
          hint={usedPct != null ? `${usedPct}% of budget spent (verified)` : 'no budget set'}
          icon={Landmark}
        />
      </div>

      {/* Budget bar */}
      {budget > 0 && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-surface-900">Budget utilization</p>
              <p className="text-xs text-surface-500 tnum">
                {formatBDT(s.expenses_verified ?? 0)} / {formatBDT(budget)}
              </p>
            </div>
            <div className="h-2.5 rounded-full bg-surface-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-600 transition-all"
                style={{ width: `${usedPct}%` }}
              />
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Charts */}
        {byCategory.length > 0 && (
          <Card>
            <CardHeader title="Verified spending by purpose" />
            <CardBody className="pt-2">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byCategory} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => formatBDTCompact(v * 100)} />
                  <Tooltip formatter={(v) => formatBDT(v * 100)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="value" fill="#254feb" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}

        {allocations.length > 0 && (
          <Card>
            <CardHeader
              title="Restricted funds"
              subtitle="Earmarked sponsor money and what remains"
            />
            <CardBody className="space-y-4">
              {allocations.slice(0, 5).map((al) => {
                const pct = al.amount_poisha ? Math.round((al.spent_poisha / al.amount_poisha) * 100) : 0
                return (
                  <div key={al.id}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-medium text-surface-700 truncate">
                        {titleCase(al.category)} <span className="text-surface-400">· {al.contribution_title}</span>
                      </p>
                      <p className="text-[11px] tnum text-surface-500 shrink-0">
                        {formatBDT(al.remaining_poisha)} left of {formatBDT(al.amount_poisha)}
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                      <div className="h-full rounded-full bg-accent-500" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                )
              })}
              <Link to={`/app/projects/${projectId}/contributions`} className="text-xs font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
                Manage contributions <ArrowRight size={13} />
              </Link>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Recent transactions */}
      <div>
        <SectionTitle
          action={
            <Link to={`/app/projects/${projectId}/transactions`}>
              <Button variant="secondary" size="sm">View all</Button>
            </Link>
          }
        >
          Recent transactions
        </SectionTitle>
        <DataState loading={loadingRecent} empty={recent.length === 0} emptyTitle="No transactions yet" emptyHint="Record the first expense or contribution to see activity here.">
          <div className="space-y-2.5">
            {recent.map((e) => (
              <TxCard key={e.id} expense={e} projectId={projectId} />
            ))}
          </div>
        </DataState>
      </div>
    </div>
  )
}
