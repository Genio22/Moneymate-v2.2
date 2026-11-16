import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ShieldCheck, Users, FolderKanban, ScrollText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card, CardBody, CardHeader } from '../../components/common/Card'
import { StatCard } from '../../components/common/StatCard'
import { DataState } from '../../components/common/DataState'
import { Badge } from '../../components/common/Badge'
import { formatDateTime, initials } from '../../utils/format'

/**
 * System administration: users, platform counts and audit trail.
 * Deliberately does NOT open private project financial data — that stays
 * behind project membership (enforced by RLS).
 */
export default function AdminPage() {
  const { user, isSystemAdmin } = useAuth()
  const [profiles, setProfiles] = useState(null)
  const [stats, setStats] = useState(null)
  const [logs, setLogs] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isSystemAdmin) return
    ;(async () => {
      try {
        const [p, counts, l] = await Promise.all([
          supabase.from('profiles').select('id, full_name, phone, is_system_admin, created_at').order('created_at', { ascending: false }).limit(200),
          Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }),
            supabase.from('projects').select('id', { count: 'exact', head: true }),
            supabase.from('expenses').select('id', { count: 'exact', head: true }),
          ]),
          supabase.from('audit_logs').select('id, action, entity_type, created_at, details, actor:profiles!audit_logs_actor_id_fkey(full_name)').order('created_at', { ascending: false }).limit(50),
        ])
        if (p.error) throw p.error
        if (l.error) throw l.error
        setProfiles(p.data)
        setStats({
          users: counts[0].count,
          projects: counts[1].count,
          transactions: counts[2].count,
        })
        setLogs(l.data)
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [isSystemAdmin])

  if (!isSystemAdmin) return <Navigate to="/app" replace />

  return (
    <div>
      <PageHeader title="Administration" subtitle="System users, platform statistics and audit trail" />

      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="Registered users" value={stats ? String(stats.users) : '…'} icon={Users} />
        <StatCard label="Projects" value={stats ? String(stats.projects) : '…'} icon={FolderKanban} />
        <StatCard label="Transactions" value={stats ? String(stats.transactions) : '…'} icon={ShieldCheck} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Users" subtitle="Profiles in this MoneyMate instance" />
          <CardBody className="pt-2 max-h-[420px] overflow-y-auto">
            <DataState loading={profiles === null} error={error} empty={profiles?.length === 0} emptyTitle="No users">
              <div className="space-y-2">
                {profiles?.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border border-surface-100 px-3 py-2">
                    <span className="w-8 h-8 rounded-full bg-surface-100 text-surface-600 flex items-center justify-center text-xs font-bold">
                      {initials(p.full_name || '?')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-surface-800 truncate">{p.full_name || 'Unnamed user'}</p>
                      <p className="text-[11px] text-surface-400">joined {formatDateTime(p.created_at)}</p>
                    </div>
                    {p.is_system_admin && <Badge tone="default" value="pending">Admin</Badge>}
                    {p.id === user.id && <Badge tone="default" value="pending">You</Badge>}
                  </div>
                ))}
              </div>
            </DataState>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Audit trail" subtitle="Recent system events" />
          <CardBody className="pt-2 max-h-[420px] overflow-y-auto">
            <DataState loading={logs === null} error={error} empty={logs?.length === 0} emptyTitle="No audit events yet">
              <div className="space-y-2">
                {logs?.map((l) => (
                  <div key={l.id} className="flex items-start justify-between gap-2 rounded-lg border border-surface-100 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-surface-800 truncate">
                        {l.actor?.full_name || 'System'} — <span className="text-surface-600">{l.action}</span>
                      </p>
                      <p className="text-[10px] text-surface-400">{l.entity_type}</p>
                    </div>
                    <p className="text-[10px] text-surface-400 shrink-0">{formatDateTime(l.created_at)}</p>
                  </div>
                ))}
              </div>
            </DataState>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
