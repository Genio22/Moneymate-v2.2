import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Wallet, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Spinner } from '../../components/common/Spinner'
import { ConfigNotice } from '../public/ConfigNotice'

const POINTS = [
  'Record every contribution — cash, materials, assets or access',
  'Advances with live remaining balance',
  'Receipt photos from any phone camera',
  'Verification by the person who provided the money',
]

export default function AuthLayout() {
  const { user, loading, isSupabaseConfigured } = useAuth()
  const location = useLocation()

  if (!isSupabaseConfigured) return <ConfigNotice />
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <Spinner size="lg" />
      </div>
    )
  }
  // Already signed in? straight to the app (except on /auth/reset, where a
  // recovery session is expected).
  if (user && !location.pathname.includes('/reset')) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] bg-primary-800 text-white p-10">
        <Link to="/" className="flex items-center gap-2.5 w-fit">
          <span className="w-10 h-10 rounded-xl bg-white/10 ring-1 ring-inset ring-white/20 flex items-center justify-center">
            <Wallet size={20} />
          </span>
          <span>
            <span className="block font-bold">MoneyMate</span>
            <span className="block text-[11px] text-primary-200">From Contributions to Reconciliation</span>
          </span>
        </Link>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Every contribution counts.
            <br />Every transaction matters.
          </h2>
          <ul className="mt-6 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-primary-100">
                <CheckCircle2 size={17} className="text-accent-300 shrink-0 mt-0.5" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-primary-300">BDT · Asia/Dhaka · Built for teams that don't do accounting</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 lg:hidden flex items-center gap-2">
          <Link to="/" className="p-2 -ml-2 rounded-lg text-surface-500 hover:bg-surface-100">
            <ArrowLeft size={18} />
          </Link>
          <span className="flex items-center gap-2 font-bold text-surface-900">
            <span className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center">
              <Wallet size={15} />
            </span>
            MoneyMate
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
