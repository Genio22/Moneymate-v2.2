import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, SlidersHorizontal, Download } from 'lucide-react'
import { expensesApi } from '../../../services/expenses'
import { projectsApi } from '../../../services/projects'
import { useProject } from '../../../hooks/useProject'
import { formatBDT } from '../../../utils/money'
import { titleCase } from '../../../utils/format'
import { PageHeader } from '../../../components/layout/PageHeader'
import { DataState } from '../../../components/common/DataState'
import { TxCard, TxCardSkeleton } from '../../../components/transactions/TxCard'
import { Button } from '../../../components/common/Button'
import { Select } from '../../../components/common/inputs'
import { downloadCsv } from '../../../utils/format'
import { EXPENSE_CATEGORIES } from '../../../constants'

export default function TransactionsTab() {
  const { projectId } = useProject()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', funding_source: '', category: '', member: '', from: '', to: '' })
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await expensesApi.list(projectId, {
        ...filters,
        search: search || undefined,
      })
      setItems(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [projectId, filters, search])

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const totals = useMemo(() => {
    const verified = items.filter((i) => i.status === 'verified')
    return {
      all: items.reduce((s, i) => s + i.amount_poisha, 0),
      verified: verified.reduce((s, i) => s + i.amount_poisha, 0),
      pending: items.filter((i) => ['pending', 'clarification'].includes(i.status)).reduce((s, i) => s + i.amount_poisha, 0),
    }
  }, [items])

  const exportCsv = () => {
    downloadCsv(`transactions-${new Date().toISOString().slice(0, 10)}.csv`, items.map((e) => ({
      reference: e.reference,
      date: e.purchased_on,
      title: e.title,
      category: e.category,
      vendor: e.vendor || '',
      amount_bdt: (e.amount_poisha / 100).toFixed(2),
      status: e.status,
      source: e.funding_source,
      paid_by: e.paid_by_user?.full_name || '',
      verified_by: e.verifier?.full_name || '',
    })))
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle={`${items.length} recorded · ${formatBDT(totals.verified)} verified · ${formatBDT(totals.pending)} pending`}
        action={
          <>
            <Button variant="secondary" size="md" onClick={exportCsv} disabled={!items.length}>
              <Download size={16} /> <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Link to={`/app/projects/${projectId}/transactions/new`}>
              <Button size="md"><Plus size={16} /> Add expense</Button>
            </Link>
          </>
        }
      />

      {/* Filter bar */}
      <div className="mb-4 space-y-2.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, vendor, reference…"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-surface-200 bg-surface-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
            />
          </div>
          <Button variant="secondary" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 rounded-xl border border-surface-200 bg-surface-50 p-3">
            <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="h-9 text-xs">
              <option value="">All statuses</option>
              {['pending', 'clarification', 'verified', 'rejected'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </Select>
            <Select value={filters.funding_source} onChange={(e) => setFilters((f) => ({ ...f, funding_source: e.target.value }))} className="h-9 text-xs">
              <option value="">All sources</option>
              <option value="advance">Advance</option>
              <option value="personal">Personal</option>
              <option value="project_cash">Project cash</option>
            </Select>
            <Select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} className="h-9 text-xs">
              <option value="">All purposes</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
            </Select>
            <Select value={filters.member} onChange={(e) => setFilters((f) => ({ ...f, member: e.target.value }))} className="h-9 text-xs">
              <option value="">All members</option>
              <MemberOptions />
            </Select>
            <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="h-9 rounded-lg border border-surface-200 text-xs px-2" />
            <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="h-9 rounded-lg border border-surface-200 text-xs px-2" />
          </div>
        )}
      </div>

      <DataState loading={loading} error={error} onRetry={load} empty={items.length === 0} emptyTitle="No transactions found" emptyHint="Try clearing filters, or record a new expense.">
        <div className="space-y-2.5">
          {items.map((e) => <TxCard key={e.id} expense={e} projectId={projectId} />)}
        </div>
      </DataState>
    </div>
  )
}

function MemberOptions() {
  const { projectId } = useProject()
  const [members, setMembers] = useState([])
  useEffect(() => {
    projectsApi.members(projectId).then(setMembers).catch(() => {})
  }, [projectId])
  return members.map((m) => <option key={m.id} value={m.user?.id}>{m.user?.full_name}</option>)
}
