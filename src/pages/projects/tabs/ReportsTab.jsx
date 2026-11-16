import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { expensesApi } from '../../../services/expenses'
import { contributionsApi } from '../../../services/contributions'
import { advancesApi } from '../../../services/advances'
import { reimbursementsApi } from '../../../services/reimbursements'
import { ledgerApi } from '../../../services/ledger'
import { useProject } from '../../../hooks/useProject'
import { formatBDT } from '../../../utils/money'
import { formatDate, titleCase, downloadCsv } from '../../../utils/format'
import { PageHeader } from '../../../components/layout/PageHeader'
import { DataState } from '../../../components/common/DataState'
import { Card, CardHeader, CardBody } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { StatCard } from '../../../components/common/StatCard'

export default function ReportsTab() {
  const { projectId, summary, project } = useProject()
  const [expenses, setExpenses] = useState([])
  const [contributions, setContributions] = useState([])
  const [advances, setAdvances] = useState([])
  const [reimbursements, setReimbursements] = useState([])
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [range, setRange] = useState({ from: '', to: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [e, c, a, r, l] = await Promise.all([
        expensesApi.list(projectId, { from: range.from || undefined, to: range.to || undefined }),
        contributionsApi.list(projectId),
        advancesApi.list(projectId),
        reimbursementsApi.list(projectId),
        ledgerApi.list(projectId, { from: range.from || undefined, to: range.to || undefined }),
      ])
      setExpenses(e)
      setContributions(c)
      setAdvances(a)
      setReimbursements(r)
      setLedger(l)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [projectId, range])

  useEffect(() => {
    load()
  }, [load])

  const s = summary || {}

  const csv = {
    cashSummary: () =>
      downloadCsv('cash-summary.csv', [
        { item: 'Cash received (verified)', amount_bdt: ((s.cash_in_verified || 0) / 100).toFixed(2) },
        { item: 'Cash received (pending verification)', amount_bdt: ((s.cash_in_pending || 0) / 100).toFixed(2) },
        { item: 'Advances from own funds (active)', amount_bdt: ((s.own_funds_advances || 0) / 100).toFixed(2) },
        { item: 'Advance spending (verified)', amount_bdt: ((s.advance_spent_verified || 0) / 100).toFixed(2) },
        { item: 'Advance spending (pending)', amount_bdt: ((s.advance_spent_pending || 0) / 100).toFixed(2) },
        { item: 'Project-cash spending (verified)', amount_bdt: ((s.project_cash_spent_verified || 0) / 100).toFixed(2) },
        { item: 'Reimbursements paid', amount_bdt: ((s.reimbursements_paid || 0) / 100).toFixed(2) },
        { item: 'Reimbursements outstanding', amount_bdt: ((s.reimbursements_outstanding || 0) / 100).toFixed(2) },
        { item: 'AVAILABLE CASH (confirmed)', amount_bdt: ((s.available_cash || 0) / 100).toFixed(2) },
        { item: 'Cash held by custodians', amount_bdt: ((s.custodial_cash || 0) / 100).toFixed(2) },
        { item: 'Non-cash contribution value (verified)', amount_bdt: ((s.noncash_verified || 0) / 100).toFixed(2) },
      ]),
    contributions: () =>
      downloadCsv('contributions.csv', contributions.map((c) => ({
        date: c.received_on,
        type: c.contribution_type,
        title: c.title,
        contributor: c.contributor_name,
        amount_bdt: (c.amount_poisha / 100).toFixed(2),
        restricted: c.restricted ? 'yes' : 'no',
        status: c.status,
        ownership: c.ownership_status,
      }))),
    expenses: () =>
      downloadCsv('expenses.csv', expenses.map((e) => ({
        reference: e.reference,
        date: e.purchased_on,
        title: e.title,
        category: e.category,
        vendor: e.vendor || '',
        amount_bdt: (e.amount_poisha / 100).toFixed(2),
        status: e.status,
        source: e.funding_source,
        paid_by: e.paid_by_user?.full_name || '',
      }))),
    advances: () =>
      downloadCsv('advance-reconciliation.csv', advances.map((a) => ({
        reference: a.reference,
        provider: a.provider_name,
        custodian: a.custodian?.full_name || '',
        advance_bdt: (a.amount_poisha / 100).toFixed(2),
        reconciled_bdt: (a.reconciled_poisha / 100).toFixed(2),
        pending_bdt: (a.pending_poisha / 100).toFixed(2),
        remaining_bdt: (a.remaining_poisha / 100).toFixed(2),
        status: a.status,
      }))),
    reimbursements: () =>
      downloadCsv('reimbursements.csv', reimbursements.map((r) => ({
        claim: r.expense?.title || '',
        payee: r.payee?.full_name || '',
        claimed_bdt: (r.amount_poisha / 100).toFixed(2),
        outstanding_bdt: (r.outstanding_poisha / 100).toFixed(2),
        status: r.status,
        payments: (r.payments || []).length,
      }))),
    ledger: () =>
      downloadCsv('ledger.csv', ledger.map((l) => ({
        date: l.entry_date,
        kind: l.entry_kind,
        bucket: l.bucket,
        amount_bdt: (l.amount_poisha / 100).toFixed(2),
        description: l.description || '',
      }))),
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={`${project?.name} — figures follow the verified transaction ledger`}
        action={
          <div className="flex gap-2">
            <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="h-9 rounded-lg border border-surface-200 text-xs px-2" />
            <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="h-9 rounded-lg border border-surface-200 text-xs px-2" />
            {(range.from || range.to) && (
              <Button variant="ghost" size="sm" onClick={() => setRange({ from: '', to: '' })}>Clear</Button>
            )}
          </div>
        }
      />

      <DataState loading={loading} error={error} onRetry={load}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Available cash (confirmed)" value={s.available_cash ?? 0} tone="primary" />
            <StatCard label="Total contribution value" value={(s.cash_in_verified ?? 0) + (s.noncash_verified ?? 0)} hint="cash + non-cash" />
            <StatCard label="Verified expenses" value={s.expenses_verified ?? 0} />
            <StatCard label="Owed to members" value={s.reimbursements_outstanding ?? 0} tone="warning" />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <ReportCard title="Project cash summary" desc="In / out / remaining" onDownload={csv.cashSummary} />
            <ReportCard title="Contribution report" desc="All contributions incl. non-cash" onDownload={csv.contributions} />
            <ReportCard title="Expense report" desc="All purchases with sources" onDownload={csv.expenses} />
            <ReportCard title="Advance reconciliation" desc="Given / reconciled / remaining" onDownload={csv.advances} />
            <ReportCard title="Reimbursement report" desc="Claims & settlements" onDownload={csv.reimbursements} />
            <ReportCard title="Financial ledger" desc="Chronological cash events" onDownload={csv.ledger} />
          </div>

          {/* Ledger table */}
          <Card>
            <CardHeader title="Financial ledger" subtitle={`${ledger.length} entries in the selected period`} />
            <CardBody className="pt-0">
              {ledger.length === 0 ? (
                <p className="text-sm text-surface-400 py-6 text-center">No verified cash movements in this period yet.</p>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-surface-400 border-b border-surface-100">
                        <th className="py-2 font-medium">Date</th>
                        <th className="py-2 font-medium">Event</th>
                        <th className="py-2 font-medium">Bucket</th>
                        <th className="py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.slice().reverse().map((l) => (
                        <tr key={l.id} className="border-b border-surface-50">
                          <td className="py-2 text-surface-500 text-xs whitespace-nowrap">{formatDate(l.entry_date)}</td>
                          <td className="py-2">
                            <span className="text-surface-800">{titleCase(l.entry_kind)}</span>
                            <span className="block text-[11px] text-surface-400">{l.description}</span>
                          </td>
                          <td className="py-2 text-xs text-surface-500">{titleCase(l.bucket)}</td>
                          <td className={`py-2 text-right font-semibold tnum ${l.amount_poisha > 0 ? 'text-accent-700' : 'text-surface-800'}`}>
                            {formatBDT(l.amount_poisha, { signed: true })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </DataState>
    </div>
  )
}

function ReportCard({ title, desc, onDownload }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3 py-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-surface-900">{title}</p>
          <p className="text-xs text-surface-500 mt-0.5">{desc}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onDownload}>
          <Download size={14} /> CSV
        </Button>
      </CardBody>
    </Card>
  )
}
