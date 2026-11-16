import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Pencil, ShieldAlert, Paperclip } from 'lucide-react'
import { expensesApi } from '../../services/expenses'
import { getAttachmentUrls, deleteAttachment } from '../../services/storage'
import { humanize } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useProject } from '../../hooks/useProject'
import { formatBDT } from '../../utils/money'
import { formatDate, formatDateTime, titleCase } from '../../utils/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card, CardBody } from '../../components/common/Card'
import { DataState } from '../../components/common/DataState'
import { Badge, StatusBadge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { VerificationPanel } from '../../components/transactions/VerificationPanel'
import { AttachmentStrip } from '../../components/forms/FileUpload'
import { ExpenseForm } from '../../components/forms/ExpenseForm'

export default function TransactionDetailPage() {
  const { txId } = useParams()
  const { user } = useAuth()
  const { isManager, projectId } = useProject()
  const navigate = useNavigate()
  const [expense, setExpense] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [urls, setUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const [ex, atts] = await Promise.all([expensesApi.get(txId), expensesApi.attachments(txId)])
      setExpense(ex)
      setAttachments(atts)
      if (atts.length) setUrls(await getAttachmentUrls(atts))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [txId])

  useEffect(() => {
    load()
  }, [load])

  const isCreator = expense?.created_by === user?.id
  const editable = isCreator && ['pending', 'clarification'].includes(expense?.status)

  const removeAttachment = async (att) => {
    setBusy(true)
    try {
      await deleteAttachment(att)
      toast.success('Attachment removed')
      load()
    } catch (e) {
      toast.error(humanize(e))
    } finally {
      setBusy(false)
    }
  }

  if (editing && expense) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Update purchase" subtitle="Your changes will be verified again." backTo={`/app/projects/${projectId}/transactions/${txId}`} />
        <ExpenseForm
          projectId={expense.project_id}
          existing={expense}
          onCreated={() => {
            setEditing(false)
            load()
          }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={expense?.title || 'Transaction'}
        subtitle={expense ? `${expense.reference} · recorded ${formatDateTime(expense.created_at)}` : ''}
        backTo={`/app/projects/${projectId}/transactions`}
        action={
          editable && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Edit
            </Button>
          )
        }
      />
      <DataState loading={loading} error={error}>
        {expense && (
          <div className="space-y-4">
            {expense.restriction_exception && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30 px-4 py-3">
                <ShieldAlert size={16} className="text-amber-600 mt-0.5" />
                <p className="text-sm text-amber-800">
                  This transaction touches a <b>restricted sponsor fund</b> and needs explicit manager resolution.
                </p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardBody className="space-y-3">
                  <Row label="Amount" value={<span className="text-lg font-bold">{formatBDT(expense.amount_poisha)}</span>} />
                  <Row label="Status" value={<StatusBadge status={expense.status} />} />
                  <Row label="Purpose" value={titleCase(expense.category)} />
                  <Row label="Purchased on" value={formatDate(expense.purchased_on)} />
                  {expense.vendor && <Row label="Vendor" value={expense.vendor} />}
                  {expense.notes && <Row label="Notes" value={expense.notes} />}
                </CardBody>
              </Card>
              <Card>
                <CardBody className="space-y-3">
                  <Row
                    label="Paid by"
                    value={expense.paid_by_user?.full_name || 'Unknown'}
                  />
                  <Row
                    label="Funding source"
                    value={
                      <span className="flex items-center gap-2">
                        {titleCase(expense.funding_source === 'advance' ? 'advance from someone' : expense.funding_source === 'personal' ? 'personal money' : 'project cash')}
                        {expense.advance && <Badge value="advance">{expense.advance.reference}</Badge>}
                      </span>
                    }
                  />
                  {expense.funding_source === 'advance' && (
                    <Row
                      label="Money provider"
                      value={expense.advance?.provider_name || expense.source_provider?.full_name || '—'}
                    />
                  )}
                  {expense.allocation && (
                    <Row
                      label="Restricted fund"
                      value={`${titleCase(expense.allocation.category)} (${formatBDT(expense.allocation.amount_poisha)})`}
                    />
                  )}
                  <Row label="Recorded by" value={expense.recorder?.full_name || expense.paid_by_user?.full_name} />
                  {expense.verified_by && <Row label={expense.status === 'rejected' ? 'Rejected by' : 'Verified by'} value={`${expense.verifier?.full_name || ''} · ${formatDateTime(expense.verified_at)}`} />}
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardBody>
                <p className="text-sm font-semibold text-surface-900 mb-3 flex items-center gap-2">
                  <Paperclip size={15} className="text-surface-400" /> Receipts ({attachments.length})
                </p>
                {attachments.length === 0 ? (
                  <p className="text-sm text-surface-400">No receipt attached.</p>
                ) : (
                  <AttachmentStrip
                    attachments={attachments}
                    urls={urls}
                    onOpen={(att, url) => window.open(url, '_blank', 'noopener')}
                    canRemove={editable || isManager}
                    onRemove={removeAttachment}
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <p className="text-sm font-semibold text-surface-900 mb-3">Verification</p>
                <VerificationPanel expense={expense} user={user} isManager={isManager} onDone={load} type="expense" />
              </CardBody>
            </Card>
          </div>
        )}
      </DataState>
    </div>
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
