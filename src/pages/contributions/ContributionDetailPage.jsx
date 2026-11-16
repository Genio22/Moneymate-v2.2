import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Trash2, ShieldCheck, Paperclip } from 'lucide-react'
import { contributionsApi, allocationsApi } from '../../services/contributions'
import { getAttachmentUrls, deleteAttachment } from '../../services/storage'
import { humanize } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useProject } from '../../hooks/useProject'
import { formatBDT, parseTakaToPoisha, poishaToTaka } from '../../utils/money'
import { formatDate, formatDateTime, titleCase } from '../../utils/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card, CardBody } from '../../components/common/Card'
import { DataState } from '../../components/common/DataState'
import { Badge, StatusBadge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Input, Label, Select, AmountInput } from '../../components/common/inputs'
import { VerificationPanel, HistoryBlock } from '../../components/transactions/VerificationPanel'
import { AttachmentStrip } from '../../components/forms/FileUpload'
import { EXPENSE_CATEGORIES } from '../../constants'

export default function ContributionDetailPage() {
  const { cid } = useParams()
  const { projectId, isManager } = useProject()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [contribution, setContribution] = useState(null)
  const [allocBalances, setAllocBalances] = useState([])
  const [attachments, setAttachments] = useState([])
  const [urls, setUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const [c, allocs, atts] = await Promise.all([
        contributionsApi.get(cid),
        allocationsApi.listByProject(projectId),
        contributionsApi.attachments(cid),
      ])
      setContribution(c)
      setAllocBalances(allocs.filter((a) => a.contribution_id === cid))
      setAttachments(atts)
      if (atts.length) setUrls(await getAttachmentUrls(atts))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [cid, projectId])

  useEffect(() => {
    load()
  }, [load])

  if (!loading && !error && !contribution) return <DataState error="Contribution not found." />

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={contribution?.title || 'Contribution'}
        subtitle={contribution ? `from ${contribution.contributor_name} · ${formatDate(contribution.received_on)}` : ''}
        backTo={`/app/projects/${projectId}/contributions`}
      />
      <DataState loading={loading} error={error} onRetry={load}>
        {contribution && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardBody className="space-y-3">
                  <Row label="Type" value={<Badge value={contribution.contribution_type} />} />
                  <Row
                    label={contribution.contribution_type === 'cash' ? 'Amount received' : 'Agreed value'}
                    value={<span className="text-lg font-bold tnum">{formatBDT(contribution.amount_poisha)}</span>}
                  />
                  {contribution.contribution_type !== 'cash' && (
                    <p className="text-[11px] text-surface-400 -mt-1">Value is reported only — never added to available cash.</p>
                  )}
                  <Row label="Status" value={<StatusBadge status={contribution.status} />} />
                  {contribution.quantity !== 1 && <Row label="Quantity" value={`${contribution.quantity} ${contribution.unit || ''}`} />}
                  {contribution.location && <Row label="Location" value={contribution.location} />}
                  <Row label="Ownership" value={titleCase(contribution.ownership_status)} />
                  {contribution.usage_start && <Row label="Access period" value={`${formatDate(contribution.usage_start)} → ${formatDate(contribution.usage_end)}`} />}
                  {contribution.usage_conditions && <Row label="Conditions" value={contribution.usage_conditions} />}
                  {contribution.description && <Row label="Description" value={contribution.description} />}
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <p className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                    <Paperclip size={15} className="text-surface-400" /> Evidence ({attachments.length})
                  </p>
                  {attachments.length === 0 ? (
                    <p className="text-sm text-surface-400">No evidence attached.</p>
                  ) : (
                    <AttachmentStrip
                      attachments={attachments}
                      urls={urls}
                      onOpen={(att, url) => window.open(url, '_blank', 'noopener')}
                    />
                  )}
                  <div className="mt-4 pt-3 border-t border-surface-100 space-y-2">
                    <Row label="Recorded by" value={contribution.recorder?.full_name || '—'} />
                    <Row label="Contributor" value={contribution.contributor?.full_name || contribution.contributor_name} />
                    {contribution.verified_at && (
                      <Row label={contribution.status === 'rejected' ? 'Rejected' : 'Verified'} value={formatDateTime(contribution.verified_at)} />
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>

            {contribution.restricted && (
              <AllocationEditor
                contribution={contribution}
                allocations={allocBalances}
                isManager={isManager}
                onChanged={load}
              />
            )}

            <Card>
              <CardBody>
                <p className="text-sm font-semibold text-surface-900 mb-3">Verification</p>
                <VerificationPanel expense={contribution} user={user} isManager={isManager} onDone={load} type="contribution" />
              </CardBody>
            </Card>
          </div>
        )}
      </DataState>
    </div>
  )
}

/** Editor for restricted-fund allocations (manager only). */
function AllocationEditor({ contribution, allocations, isManager, onChanged }) {
  const [rows, setRows] = useState(
    allocations.map((a) => ({ category: a.category, amount: poishaToTaka(a.amount_poisha), note: a.note || '' })),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const totalPoisha = rows.reduce((sum, r) => sum + (parseTakaToPoisha(r.amount) ?? 0), 0)
  const over = totalPoisha > contribution.amount_poisha

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await contributionsApi.setAllocations(
        contribution.id,
        rows.filter((r) => r.category && parseTakaToPoisha(r.amount) > 0),
      )
      toast.success('Allocations saved.')
      onChanged?.()
    } catch (e) {
      setError(humanize(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-surface-900 flex items-center gap-2">
              <ShieldCheck size={15} className="text-accent-600" /> Spending allocations
            </p>
            <p className="text-xs text-surface-500 mt-0.5">
              Divide this contribution into permitted purposes. {formatBDT(contribution.amount_poisha - totalPoisha)} remains unallocated.
            </p>
          </div>
          {isManager && (
            <Button variant="secondary" size="sm" onClick={() => setRows((r) => [...r, { category: EXPENSE_CATEGORIES[0], amount: '', note: '' }])}>
              <Plus size={14} /> Add
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_130px_auto] sm:grid-cols-[1fr_150px_auto] gap-2 items-start">
              <Select
                value={r.category}
                disabled={!isManager}
                onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}
                className="h-9 text-xs"
              >
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
              </Select>
              <AmountInput
                value={r.amount}
                disabled={!isManager}
                onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                className="[&_input]:h-9 [&_input]:text-xs"
              />
              {isManager && (
                <button
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  className="h-9 w-9 flex items-center justify-center rounded-lg text-surface-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  aria-label="Remove allocation"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-xs text-surface-400 py-3 text-center">
              No allocations yet — {isManager ? 'add the permitted purposes.' : 'the manager has not set allocations.'}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-100">
          <span className="text-surface-500">Allocated total</span>
          <span className={`tnum font-semibold ${over ? 'text-red-600' : 'text-surface-800'}`}>{formatBDT(totalPoisha)} / {formatBDT(contribution.amount_poisha)}</span>
        </div>
        {over && <p className="text-xs text-red-600">Allocations exceed the contribution amount.</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}

        {isManager && contribution.status !== 'rejected' && (
          <Button size="sm" onClick={save} loading={busy} disabled={over}>
            Save allocations
          </Button>
        )}
      </CardBody>
    </Card>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs text-surface-400 font-medium shrink-0">{label}</p>
      <p className="text-sm text-surface-800 text-right">{value}</p>
    </div>
  )
}
