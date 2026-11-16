import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderKanban, ShieldCheck, HandHeart, Wallet, Plus, ArrowRight, Sparkles, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useProjects } from '../../hooks/useProjects'
import { expensesApi } from '../../services/expenses'
import { reimbursementsApi } from '../../services/reimbursements'
import { notificationsApi } from '../../services/notifications'
import { formatBDT } from '../../utils/money'
import { formatDate, timeAgo, initials } from '../../utils/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { StatCard } from '../../components/common/StatCard'
import { Card, CardBody } from '../../components/common/Card'
import { DataState } from '../../components/common/DataState'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { TxCard } from '../../components/transactions/TxCard'
import { Input, Label, Textarea } from '../../components/common/inputs'
import { Modal } from '../../components/common/Modal'
import { authApi } from '../../services/auth'
import { profileSchema } from '../../schemas'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const { user, profile, refreshProfile } = useAuth()
  const { projects, summaries, loading, error, refresh } = useProjects()
  const [recentTx, setRecentTx] = useState([])
  const [myClaims, setMyClaims] = useState([])
  const [pendingVerify, setPendingVerify] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [loadingTx, setLoadingTx] = useState(true)
  const [profileModal, setProfileModal] = useState(false)

  const needsOnboarding = profile && !profile.onboarded

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [tx, claims, count, notes] = await Promise.all([
          expensesApi.listAcrossProjects({ paid_by: user.id }),
          reimbursementsApi.listMine(user.id),
          expensesApi.pendingCountAcrossProjects(user.id),
          notificationsApi.list(user.id, { limit: 5 }),
        ])
        if (!alive) return
        setRecentTx(tx)
        setMyClaims(claims)
        setPendingVerify(count)
        setNotifications(notes)
      } catch { /* non-fatal */ }
      finally { if (alive) setLoadingTx(false) }
    })()
    return () => { alive = false }
  }, [user.id])

  const outstandingTotal = myClaims.reduce((s, r) => s + (r.outstanding_poisha || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${profile?.full_name?.split(' ')[0] || 'there'} 👋`}
        subtitle="Here's where your projects stand today."
        action={
          <>
            <Link to="/app/join"><Button variant="secondary" size="md">Join project</Button></Link>
            <Link to="/app/projects/new"><Button size="md"><Plus size={16} /> New project</Button></Link>
          </>
        }
      />

      {needsOnboarding && (
        <Card className="border-primary-200 dark:border-primary-500/30 bg-gradient-to-br from-primary-50 to-white dark:from-primary-500/10 dark:to-transparent">
          <CardBody>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-primary-800 dark:text-primary-300 flex items-center gap-1.5">
                  <Sparkles size={15} /> Welcome to MoneyMate!
                </p>
                <p className="text-xs text-surface-600 mt-1">
                  1. Finish your profile &nbsp;·&nbsp; 2. Create a project &nbsp;·&nbsp; 3. Record your first
                  contribution or expense.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setProfileModal(true)}>Complete profile</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Personal stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="My projects" value={String(projects.length)} icon={FolderKanban} />
        <StatCard
          label="Waiting for my verification"
          value={String(pendingVerify)}
          tone={pendingVerify > 0 ? 'warning' : 'default'}
          icon={ShieldCheck}
          hint={pendingVerify > 0 ? 'open the Verification tab in each project' : 'all caught up'}
        />
        <StatCard
          label="Owed to me"
          value={outstandingTotal}
          tone={outstandingTotal > 0 ? 'positive' : 'default'}
          icon={HandHeart}
          hint={`${myClaims.length} open claim${myClaims.length === 1 ? '' : 's'}`}
        />
        <StatCard label="Cash across projects" value={projects.reduce((s, p) => s + (summaries[p.id]?.available_cash || 0), 0)} icon={Wallet} hint="verified, all my projects" />
      </div>

      {/* Projects */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base sm:text-lg font-semibold text-surface-900">My projects</h2>
          <Link to="/app/projects" className="text-xs font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
            View all <ArrowRight size={13} />
          </Link>
        </div>
        <DataState loading={loading} error={error} onRetry={refresh} empty={!loading && projects.length === 0} emptyTitle="No projects yet" emptyHint="Create your first project or join one with an invite code.">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.slice(0, 6).map((p) => {
              const s = summaries[p.id] || {}
              return (
                <Link
                  key={p.id}
                  to={`/app/projects/${p.id}`}
                  className="rounded-xl border border-surface-200 bg-surface-50 p-4 hover:border-primary-300 hover:shadow-card transition group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-9 h-9 rounded-lg object-cover border border-surface-100" />
                      ) : (
                        <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center text-sm font-bold shrink-0">
                          {p.name[0]?.toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-surface-900 truncate group-hover:text-primary-700">{p.name}</p>
                        <p className="text-[11px] text-surface-400">
                          {p.my_role === 'manager' ? 'You manage' : 'Member'} · {s.custodial_cash > 0 ? 'advances active' : 'no advances'}
                        </p>
                      </div>
                    </div>
                    <Badge value={p.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <MiniStat label="Cash" value={formatBDT(s.available_cash ?? 0)} tone="text-primary-700" />
                    <MiniStat label="Spent" value={formatBDT(s.expenses_verified ?? 0)} />
                    <MiniStat label="Owed" value={formatBDT(s.reimbursements_outstanding ?? 0)} tone={s.reimbursements_outstanding > 0 ? 'text-amber-600' : ''} />
                  </div>
                </Link>
              )
            })}
          </div>
        </DataState>
      </section>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent activity */}
        <section className="lg:col-span-2">
          <h2 className="text-base sm:text-lg font-semibold text-surface-900 mb-3">Recent activity</h2>
          <DataState loading={loadingTx} empty={recentTx.length === 0} emptyTitle="No transactions yet" emptyHint="Record an expense from the + button below.">
            <div className="space-y-2.5">
              {recentTx.slice(0, 6).map((e) => (
                <TxCard key={e.id} expense={e} showProject />
              ))}
            </div>
          </DataState>
        </section>

        {/* Notifications preview */}
        <section>
          <h2 className="text-base sm:text-lg font-semibold text-surface-900 mb-3">Latest notifications</h2>
          <Card>
            <CardBody className="space-y-2.5">
              {notifications.length === 0 && <p className="text-sm text-surface-400 text-center py-4">Nothing yet.</p>}
              {notifications.map((n) => (
                <Link key={n.id} to={n.link || '/app/notifications'} className="block rounded-lg hover:bg-surface-50 px-2 py-2 -mx-2">
                  <p className="text-xs font-medium text-surface-800 flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary-500 shrink-0" />}
                    {n.title}
                  </p>
                  <p className="text-[10px] text-surface-400 pl-3.5">{timeAgo(n.created_at)}</p>
                </Link>
              ))}
              <Link to="/app/notifications" className="block pt-2 text-xs font-medium text-primary-600 hover:text-primary-700">
                View all →
              </Link>
            </CardBody>
          </Card>
        </section>
      </div>

      <ProfileModal
        open={profileModal}
        profile={profile}
        onClose={() => setProfileModal(false)}
        onSaved={async () => {
          await refreshProfile()
          try {
            await authApi.updateProfile(user.id, { onboarded: true })
            await refreshProfile()
          } catch { /* ignore */ }
          refresh()
        }}
      />
    </div>
  )
}

function MiniStat({ label, value, tone = 'text-surface-900' }) {
  return (
    <div className="rounded-lg bg-surface-50 border border-surface-100 py-1.5">
      <p className="text-[9px] text-surface-400 font-medium">{label}</p>
      <p className={`text-[11px] font-bold tnum truncate ${tone}`}>{value}</p>
    </div>
  )
}

function ProfileModal({ open, profile, onClose, onSaved }) {
  const [name, setName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [busy, setBusy] = useState(false)
  const { user } = useAuth()

  const save = async () => {
    const parsed = profileSchema.safeParse({ full_name: name, phone })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message)
      return
    }
    setBusy(true)
    try {
      await authApi.updateProfile(user.id, parsed.data)
      toast.success('Profile saved.')
      onSaved?.()
      onClose()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Complete your profile" size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-base font-bold">
            {initials(name || user?.email || '?')}
          </span>
          <div>
            <p className="text-sm font-medium text-surface-800">{user?.email}</p>
            <p className="text-xs text-surface-400">Name shown to teammates and verifiers</p>
          </div>
        </div>
        <div>
          <Label required>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Karim Ahmed" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Later</Button>
          <Button onClick={save} loading={busy}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}
