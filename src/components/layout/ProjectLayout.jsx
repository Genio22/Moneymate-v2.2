import { NavLink, Outlet, Link } from 'react-router-dom'
import {
  LayoutDashboard, ReceiptText, Gift, HandCoins, Boxes, ShieldCheck, HandHeart,
  Users, BarChart3, Settings, ArrowLeft,
} from 'lucide-react'
import { useProject } from '../../hooks/useProject'
import { Badge } from '../common/Badge'
import clsx from 'clsx'

const TABS = [
  { to: '.', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: 'transactions', label: 'Transactions', icon: ReceiptText },
  { to: 'contributions', label: 'Contributions', icon: Gift },
  { to: 'advances', label: 'Advances', icon: HandCoins },
  { to: 'resources', label: 'Resources', icon: Boxes },
  { to: 'verification', label: 'Verification', icon: ShieldCheck },
  { to: 'reimbursements', label: 'Reimbursements', icon: HandHeart },
  { to: 'members', label: 'Members', icon: Users },
  { to: 'reports', label: 'Reports', icon: BarChart3 },
  { to: 'settings', label: 'Settings', icon: Settings },
]

export function ProjectLayout() {
  const { project, role } = useProject()

  const tabClass = ({ isActive }) =>
    clsx(
      'flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium transition',
      isActive ? 'bg-primary-600 text-white shadow-sm' : 'text-surface-600 hover:bg-surface-100',
    )

  return (
    <div>
      {/* Project header */}
      <div className="mb-4">
        <Link to="/app/projects" className="inline-flex items-center gap-1 text-xs font-medium text-surface-500 hover:text-surface-700 mb-2">
          <ArrowLeft size={14} /> All projects
        </Link>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 tracking-tight">{project.name}</h1>
          <Badge value={project.status} />
          <Badge value={role} />
        </div>
        {project.description && (
          <p className="mt-1 text-sm text-surface-500 line-clamp-2 max-w-3xl">{project.description}</p>
        )}
      </div>

      {/* Tabs */}
      <nav className="mb-5 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
        <div className="flex gap-1 pb-1 min-w-max">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={tabClass}>
              <t.icon size={15} />
              <span>{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <Outlet />
    </div>
  )
}
