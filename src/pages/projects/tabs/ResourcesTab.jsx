import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Boxes, ChevronDown, CheckCircle2 } from 'lucide-react'
import { resourcesApi } from '../../../services/resources'
import { projectsApi } from '../../../services/projects'
import { useProject } from '../../../hooks/useProject'
import { useAuth } from '../../../contexts/AuthContext'
import { formatBDT } from '../../../utils/money'
import { formatDate, titleCase, timeAgo } from '../../../utils/format'
import { PageHeader } from '../../../components/layout/PageHeader'
import { DataState } from '../../../components/common/DataState'
import { Badge, StatusBadge } from '../../../components/common/Badge'
import { Button } from '../../../components/common/Button'
import { Card, CardBody } from '../../../components/common/Card'
import { Modal, ConfirmDialog } from '../../../components/common/Modal'
import { Select, Input, Label } from '../../../components/common/inputs'
import { ResourceForm } from '../../../components/resources/ResourceForm'
import { RESOURCE_STATUSES } from '../../../constants'

const STATUS_TONE = {
  proposed: 'bg-surface-100 text-surface-600',
  committed: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  available: 'bg-accent-50 text-accent-700',
  assigned: 'bg-primary-50 text-primary-700',
  in_use: 'bg-primary-50 text-primary-700',
  returned: 'bg-surface-100 text-surface-500',
  unavailable: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
}

export default function ResourcesTab() {
  const { projectId } = useProject()
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [moveTarget, setMoveTarget] = useState(null)
  const [detail, setDetail] = useState(null)

  const load = () => {
    setLoading(true)
    resourcesApi
      .list(projectId)
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  return (
    <div>
      <PageHeader
        title="Resources"
        subtitle="Materials, assets and access — with owner and custody tracked separately"
        action={
          <Button size="md" onClick={() => setFormOpen(true)}>
            <Plus size={16} /> Add resource
          </Button>
        }
      />

      <DataState loading={loading} error={error} onRetry={load} empty={items.length === 0} emptyTitle="No resources tracked yet" emptyHint="Add contributed or purchased materials, equipment and access.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((r) => (
            <Card key={r.id} className="flex flex-col">
              <CardBody className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-surface-900 truncate">{r.name}</p>
                    <p className="text-xs text-surface-500 truncate">
                      {titleCase(r.resource_type)} · owner: {r.owner?.full_name || r.owner_name}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${STATUS_TONE[r.status] || ''}`}>
                    {titleCase(r.status)}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-surface-600">
                  {r.agreed_value_poisha > 0 && <p className="tnum">Value: {formatBDT(r.agreed_value_poisha)}</p>}
                  {r.quantity !== 1 && <p>{r.quantity} {r.unit || ''}</p>}
                  {r.custodian && <p>Custodian: {r.custodian.full_name}</p>}
                  {r.location && <p className="truncate">📍 {r.location}</p>}
                  {r.usage_start && r.resource_type === 'access' && (
                    <p>{formatDate(r.usage_start)} → {formatDate(r.usage_end)}</p>
                  )}
                </div>
              </CardBody>
              <div className="flex items-center gap-1.5 px-4 pb-3 pt-1">
                <Button size="sm" variant="secondary" onClick={() => setDetail(r.id)}>History</Button>
                <Button size="sm" onClick={() => setMoveTarget(r)}>Update status</Button>
              </div>
            </Card>
          ))}
        </div>
      </DataState>

      <ResourceForm projectId={projectId} open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
      <ResourceMoveModal resource={moveTarget} onClose={() => setMoveTarget(null)} onSaved={load} />
      <ResourceDetailModal resourceId={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

function ResourceMoveModal({ resource, onClose, onSaved }) {
  const { projectId } = useProject()
  const [status, setStatus] = useState(resource?.status || 'available')
  const [custodianId, setCustodianId] = useState(resource?.custodian_id || '')
  const [location, setLocation] = useState(resource?.location || '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [members, setMembers] = useState([])

  useEffect(() => {
    if (resource) {
      setStatus(resource.status)
      setCustodianId(resource.custodian_id || '')
      setLocation(resource.location || '')
      setNote('')
      setError(null)
      projectsApi.members(projectId).then(setMembers).catch(() => {})
    }
  }, [resource, projectId])

  if (!resource) return null

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await resourcesApi.setStatus(resource.id, status, custodianId, location, note)
      toast.success('Resource updated.')
      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Update: ${resource.name}`} subtitle="Status changes are logged as movements.">
      <div className="space-y-4">
        <div>
          <Label required>New status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {RESOURCE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
        <div>
          <Label>Custodian</Label>
          <Select value={custodianId} onChange={(e) => setCustodianId(e.target.value)}>
            <option value="">Nobody / with owner</option>
            {members.map((m) => <option key={m.id} value={m.user.id}>{m.user.full_name}</option>)}
          </Select>
        </div>
        <div>
          <Label>Location</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where is it now?" />
        </div>
        <div>
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. handed to Karim for shoot on Friday" />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={busy}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}

function ResourceDetailModal({ resourceId, onClose }) {
  const { projectId } = useProject()
  const [resource, setResource] = useState(null)
  const [movements, setMovements] = useState([])

  useEffect(() => {
    if (!resourceId) return
    resourcesApi.get(resourceId).then(setResource).catch(() => {})
    resourcesApi.movements(resourceId).then(setMovements).catch(() => {})
  }, [resourceId])

  if (!resourceId) return null

  return (
    <Modal open onClose={onClose} title={resource?.name || 'Resource'} subtitle="Movement history" size="md">
      <div className="space-y-3">
        {resource && (
          <div className="rounded-xl bg-surface-50 ring-1 ring-inset ring-surface-200 p-3 text-sm text-surface-700 space-y-1">
            <p><b>Owner:</b> {resource.owner?.full_name || resource.owner_name} · ownership {titleCase(resource.ownership_status)}</p>
            <p><b>Status:</b> {titleCase(resource.status)}{resource.custodian ? ` · custodian ${resource.custodian.full_name}` : ''}</p>
            {resource.usage_conditions && <p><b>Conditions:</b> {resource.usage_conditions}</p>}
          </div>
        )}
        {movements.length === 0 && <p className="text-sm text-surface-400 text-center py-4">No movements recorded yet.</p>}
        {movements.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-surface-100 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-surface-800">→ {titleCase(m.status_to)}</p>
              <p className="text-[11px] text-surface-500">
                {m.custodian_name ? `${m.custodian_name} · ` : ''}{m.location || ''}{m.note ? ` · ${m.note}` : ''}
              </p>
            </div>
            <p className="text-[10px] text-surface-400 shrink-0">{timeAgo(m.created_at)}</p>
          </div>
        ))}
      </div>
    </Modal>
  )
}
