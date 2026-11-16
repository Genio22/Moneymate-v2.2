import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Banknote, Package, Boxes as AssetIcon, Home, Pencil } from 'lucide-react'
import { contributionsApi } from '../../../services/contributions'
import { useProject } from '../../../hooks/useProject'
import { formatBDT } from '../../../utils/money'
import { formatDate, titleCase } from '../../../utils/format'
import { PageHeader } from '../../../components/layout/PageHeader'
import { DataState } from '../../../components/common/DataState'
import { Badge, StatusBadge } from '../../../components/common/Badge'
import { Button } from '../../../components/common/Button'
import { Modal } from '../../../components/common/Modal'
import { ContributionForm } from '../../../components/contributions/ContributionForm'
import clsx from 'clsx'

const TYPE_ICONS = { cash: Banknote, material: Package, asset: AssetIcon, in_kind: Home }
const FILTERS = [
  { value: '', label: 'All' },
  { value: 'cash', label: 'Cash' },
  { value: 'material', label: 'Materials' },
  { value: 'asset', label: 'Assets' },
  { value: 'in_kind', label: 'In-kind' },
]

export default function ContributionsTab() {
  const { projectId, project } = useProject()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  const load = () => {
    setLoading(true)
    contributionsApi
      .list(projectId, { type: filter || undefined })
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filter])

  return (
    <div>
      <PageHeader
        title="Contributions"
        subtitle="Money, materials, assets and access the project received"
        action={
          <Link to={`/app/projects/${projectId}/contributions/new`}>
            <Button size="md"><Plus size={16} /> Add contribution</Button>
          </Link>
        }
      />

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition',
              filter === f.value ? 'bg-primary-600 text-white' : 'bg-surface-50 border border-surface-200 text-surface-600 hover:bg-surface-50',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataState loading={loading} error={error} onRetry={load} empty={items.length === 0} emptyTitle="No contributions yet" emptyHint="Record the first cash, material, asset or in-kind contribution.">
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((c) => {
            const Icon = TYPE_ICONS[c.contribution_type]
            return (
              <div key={c.id} className="rounded-xl border border-surface-200 bg-surface-50 p-4 hover:border-surface-300 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3 min-w-0">
                    <span className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', c.contribution_type === 'cash' ? 'bg-accent-50 text-accent-700' : 'bg-primary-50 text-primary-700')}>
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0">
                      <Link to={`/app/projects/${projectId}/contributions/${c.id}`} className="block text-sm font-semibold text-surface-900 truncate hover:text-primary-700">
                        {c.title}
                      </Link>
                      <p className="text-xs text-surface-500 truncate">
                        {c.contributor_name}
                        {c.contribution_type !== 'cash' && ` · ${titleCase(c.contribution_type)}`}
                      </p>
                      <p className="text-[11px] text-surface-400 mt-0.5">{formatDate(c.received_on)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tnum text-surface-900">{formatBDT(c.amount_poisha)}</p>
                    <p className="text-[10px] text-surface-400">{c.contribution_type === 'cash' ? 'cash' : 'agreed value'}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <StatusBadge status={c.status} />
                  {c.restricted && <Badge tone="amber" value="pending">Restricted</Badge>}
                  {c.ownership_status === 'contributor_retained' && c.contribution_type !== 'cash' && (
                    <Badge tone="default" value="pending">Owner retains</Badge>
                  )}
                  <button onClick={() => setEditTarget(c)} className="ml-auto text-surface-300 hover:text-surface-600" title="Edit">
                    <Pencil size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </DataState>

      <Modal open={Boolean(editTarget)} onClose={() => setEditTarget(null)} title="Edit contribution" subtitle="Only pending contributions can be changed; verified ones stay immutable.">
        {editTarget && (
          <ContributionForm
            projectId={projectId}
            existing={editTarget}
            onDone={() => {
              setEditTarget(null)
              load()
            }}
          />
        )}
      </Modal>
    </div>
  )
}
