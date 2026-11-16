import { Link, useNavigate } from 'react-router-dom'
import { Plus, Wallet, Users, TrendingUp, ChevronRight, Search, HandCoins, FolderKanban } from 'lucide-react'
import { useProjects } from '../../hooks/useProjects'
import { formatBDT } from '../../utils/money'
import { formatDate, titleCase } from '../../utils/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { DataState } from '../../components/common/DataState'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Card, CardBody } from '../../components/common/Card'
import { StatCard } from '../../components/common/StatCard'
import { useAuth } from '../../contexts/AuthContext'
import { useState } from 'react'

export default function ProjectsPage() {
  const { projects, summaries, loading, error, refresh } = useProjects()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
  const totalCash = projects.reduce((s, p) => s + (summaries[p.id]?.available_cash || 0), 0)
  const totalOwed = projects.reduce((s, p) => s + (summaries[p.id]?.reimbursements_outstanding || 0), 0)
  const activeCount = projects.filter((p) => p.status === 'active').length

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Every project you manage or contribute to"
        action={
          <>
            <Link to="/app/join"><Button variant="secondary" size="md">Join</Button></Link>
            <Link to="/app/projects/new"><Button size="md"><Plus size={16} /> New project</Button></Link>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Active projects" value={String(activeCount)} icon={FolderKanban} />
        <StatCard label="Cash (all projects)" value={totalCash} tone="primary" icon={Wallet} />
        <StatCard label="Owed to members" value={totalOwed} tone={totalOwed > 0 ? 'warning' : 'default'} icon={HandCoins} />
        <StatCard label="Non-cash value" value={projects.reduce((s, p) => s + (summaries[p.id]?.noncash_verified || 0), 0)} icon={TrendingUp} />
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-surface-200 bg-surface-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
        />
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={refresh}
        empty={filtered.length === 0}
        emptyTitle={search ? 'No matching projects' : 'No projects yet'}
        emptyHint={search ? 'Try a different search.' : 'Create your first project — it takes about a minute.'}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((p) => {
            const s = summaries[p.id] || {}
            return (
              <Link key={p.id} to={`/app/projects/${p.id}`}>
                <Card className="h-full hover:border-primary-300 hover:shadow-card transition group cursor-pointer">
                  <CardBody>
                    <div className="flex items-start gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-12 h-12 rounded-xl object-cover border border-surface-100 shrink-0" />
                      ) : (
                        <span className="w-12 h-12 rounded-xl bg-primary-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
                          {p.name[0]?.toUpperCase()}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-surface-900 truncate group-hover:text-primary-700">{p.name}</p>
                          <Badge value={p.status} />
                        </div>
                        <p className="text-[11px] text-surface-400 mt-0.5 truncate">
                          {titleCase(p.category || 'project')} · started {formatDate(p.start_date)} ·{' '}
                          {p.my_role === 'manager' ? 'you manage' : titleCase(p.my_role)}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-surface-300 shrink-0 mt-3" />
                    </div>
                    <div className="mt-3.5 grid grid-cols-3 gap-2">
                      <MiniStat label="Remaining cash" value={formatBDT(s.available_cash ?? 0)} tone="text-primary-700" />
                      <MiniStat label="Spent" value={formatBDT(s.expenses_verified ?? 0)} />
                      <MiniStat label="Owed" value={formatBDT(s.reimbursements_outstanding ?? 0)} tone={s.reimbursements_outstanding > 0 ? 'text-amber-600' : ''} />
                    </div>
                  </CardBody>
                </Card>
              </Link>
            )
          })}
        </div>
      </DataState>
    </div>
  )
}

function MiniStat({ label, value, tone = 'text-surface-900' }) {
  return (
    <div className="rounded-lg bg-surface-50 border border-surface-100 py-1.5 text-center">
      <p className="text-[9px] text-surface-400 font-medium">{label}</p>
      <p className={`text-[11px] font-bold tnum truncate ${tone}`}>{value}</p>
    </div>
  )
}
