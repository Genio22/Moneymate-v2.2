import { useEffect, useState, useRef } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FolderKanban, PlusCircle, Bell, Settings, ShieldCheck, LogOut, Wallet,
  Home, FolderOpen, User, CheckCheck, HandCoins, Landmark, Sun, Moon,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { notificationsApi, normalizeNotificationLink } from '../../services/notifications'
import { initials, timeAgo } from '../../utils/format'
import clsx from 'clsx'

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/projects', label: 'Projects', icon: FolderKanban },
  { to: '/app/add', label: 'Add Expense', icon: PlusCircle },
  { to: '/app/settings', label: 'Profile & Settings', icon: Settings },
]

const MOBILE_NAV = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/projects', label: 'Projects', icon: FolderOpen },
  { to: '/app/add', label: 'Add', icon: PlusCircle, accent: true },
  { to: '/app/notifications', label: 'Alerts', icon: Bell, badge: true },
  { to: '/app/settings', label: 'Profile', icon: User },
]

function Logo({ compact }) {
  return (
    <Link to="/app" className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-sm">
        <Wallet size={18} />
      </span>
      {!compact && (
        <span>
          <span className="block text-[15px] font-bold text-surface-900 leading-tight">MoneyMate</span>
          <span className="block text-[10px] text-surface-400 leading-tight">Contributions → Reconciliation</span>
        </span>
      )}
    </Link>
  )
}

function useNotifications(user) {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const refresh = async () => {
    if (!user) return
    try {
      const [list, count] = await Promise.all([
        notificationsApi.list(user.id, { limit: 12 }),
        notificationsApi.unreadCount(user.id),
      ])
      setItems(list)
      setUnread(count)
    } catch { /* offline */ }
  }
  useEffect(() => {
    if (!user) return
    refresh()
    return notificationsApi.subscribe(user.id, () => refresh())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])
  return { items, unread, refresh }
}

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg text-surface-500 hover:bg-surface-100 hover:text-surface-700"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

function NotificationBell() {
  const { user } = useAuth()
  const { items, unread, refresh } = useNotifications(user)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-surface-500 hover:bg-surface-100 hover:text-surface-700"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-w-[92vw] bg-surface-50 rounded-xl shadow-pop border border-surface-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              onClick={async () => {
                await notificationsApi.markAllRead(user.id)
                refresh()
              }}
              className="text-xs text-primary-600 font-medium hover:text-primary-700 inline-flex items-center gap-1"
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {items.length === 0 && <p className="text-sm text-surface-400 text-center py-8">No notifications yet</p>}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={async () => {
                  await notificationsApi.markRead(n.id)
                  refresh()
                  setOpen(false)
                  if (n.link) navigate(normalizeNotificationLink(n.link))
                }}
                className={clsx(
                  'block w-full text-left px-4 py-3 hover:bg-surface-50 border-b border-surface-50',
                  !n.read && 'bg-primary-50/40',
                )}
              >
                <p className="text-[13px] font-medium text-surface-800 flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary-500 shrink-0" />}
                  {n.title}
                </p>
                {n.body && <p className="text-xs text-surface-500 mt-0.5 line-clamp-2 pl-3.5">{n.body}</p>}
                <p className="text-[10px] text-surface-400 pl-3.5 mt-1">{timeAgo(n.created_at)}</p>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setOpen(false)
              navigate('/app/notifications')
            }}
            className="block w-full py-2.5 text-xs font-medium text-primary-600 hover:bg-surface-50"
          >
            View all
          </button>
        </div>
      )}
    </div>
  )
}

export function AppShell({ children }) {
  const { user, profile, isSystemAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { unread } = useNotifications(user)

  const sidebarLink = ({ isActive }) =>
    clsx(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
      isActive ? 'bg-primary-600 text-white shadow-sm' : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
    )

  return (
    <div className="min-h-full flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-surface-200 bg-surface-50 sticky top-0 h-screen">
        <div className="px-5 py-5">
          <Logo />
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={sidebarLink}>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
          {isSystemAdmin && (
            <NavLink to="/app/admin" className={sidebarLink}>
              <ShieldCheck size={18} /> Administration
            </NavLink>
          )}
          <div className="pt-4 mt-4 border-t border-surface-100">
            <Link to="/app/join" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-accent-700 hover:bg-accent-50">
              <Landmark size={18} /> Join a project
            </Link>
          </div>
        </nav>
        <div className="p-3 border-t border-surface-100">
          <Link to="/app/settings" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-100">
            <span className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
              {initials(profile?.full_name || user?.email || '?')}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-surface-800 truncate">{profile?.full_name || 'Your profile'}</span>
              <span className="block text-[11px] text-surface-400 truncate">{user?.email}</span>
            </span>
          </Link>
          <button
            onClick={async () => {
              await signOut()
              navigate('/')
            }}
            className="mt-1 w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-surface-500 hover:bg-surface-100 hover:text-red-600"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="md:hidden sticky top-0 z-40 bg-surface-50/95 backdrop-blur border-b border-surface-200">
          <div className="flex items-center justify-between px-4 h-14">
            <Logo compact />
            <div className="flex items-center gap-1">
              <NotificationBell />
              <ThemeToggle />
              <Link to="/app/settings" className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                {initials(profile?.full_name || '?')}
              </Link>
            </div>
          </div>
        </header>
        <header className="hidden md:flex sticky top-0 z-40 items-center justify-end gap-3 h-14 px-6 bg-surface-50/95 backdrop-blur border-b border-surface-200">
          <NotificationBell />
          <ThemeToggle />
        </header>

        <main className="flex-1 px-4 sm:px-6 py-4 sm:py-6 pb-24 md:pb-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-50 border-t border-surface-200 pb-safe">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) =>
            item.accent ? (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center py-2 -mt-4"
                aria-label={item.label}
              >
                <span
                  className={clsx(
                    'w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-pop',
                    location.pathname === item.to ? 'bg-primary-700' : 'bg-primary-600',
                  )}
                >
                  <item.icon size={22} />
                </span>
                <span className="text-[10px] font-medium text-surface-600 mt-0.5">{item.label}</span>
              </Link>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'flex flex-col items-center justify-center py-2 text-[10px] font-medium relative',
                    isActive ? 'text-primary-700' : 'text-surface-500',
                  )
                }
              >
                <span className="relative">
                  <item.icon size={21} />
                  {item.badge && unread > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                {item.label}
              </NavLink>
            ),
          )}
        </div>
      </nav>
    </div>
  )
}
