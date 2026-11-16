import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, Bell } from 'lucide-react'
import { notificationsApi, normalizeNotificationLink } from '../../services/notifications'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader } from '../../components/layout/PageHeader'
import { DataState } from '../../components/common/DataState'
import { Button } from '../../components/common/Button'
import { timeAgo } from '../../utils/format'
import clsx from 'clsx'

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setItems(await notificationsApi.list(user.id, { limit: 100 }))
    } catch (e) {
      setError(e.message)
    }
  }, [user.id])

  useEffect(() => {
    load()
    return notificationsApi.subscribe(user.id, load)
  }, [load])

  const open = async (n) => {
    if (!n.read) {
      try { await notificationsApi.markRead(n.id) } catch { /* ignore */ }
    }
    if (n.link) navigate(normalizeNotificationLink(n.link))
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Notifications"
        subtitle="Verification requests, payments, resources and project updates"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await notificationsApi.markAllRead(user.id)
              load()
            }}
          >
            <CheckCheck size={15} /> Mark all read
          </Button>
        }
      />
      <DataState loading={items === null} error={error} onRetry={load} empty={items?.length === 0} emptyTitle="No notifications yet" emptyHint="Activity that concerns you will show up here.">
        <div className="space-y-2">
          {items?.map((n) => (
            <button
              key={n.id}
              onClick={() => open(n)}
              className={clsx(
                'block w-full text-left rounded-xl border px-4 py-3.5 transition hover:shadow-card',
                n.read ? 'border-surface-200 bg-surface-50' : 'border-primary-200 bg-primary-50/50',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-surface-900">{n.title}</p>
                  {n.body && <p className="text-xs text-surface-500 mt-0.5">{n.body}</p>}
                </div>
                <span className="text-[10px] text-surface-400 shrink-0">{timeAgo(n.created_at)}</span>
              </div>
              {!n.read && <span className="mt-1.5 inline-block text-[10px] font-semibold text-primary-600">NEW</span>}
            </button>
          ))}
        </div>
      </DataState>
    </div>
  )
}
