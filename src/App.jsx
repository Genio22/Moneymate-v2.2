import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { AppShell } from './components/layout/AppShell'
import { Spinner } from './components/common/Spinner'
import { ConfigNotice } from './pages/public/ConfigNotice'

import LandingPage from './pages/public/LandingPage'
import AuthLayout from './pages/auth/AuthLayout'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'

import DashboardPage from './pages/dashboard/DashboardPage'
import ProjectsPage from './pages/projects/ProjectsPage'
import NewProjectPage from './pages/projects/NewProjectPage'
import JoinProjectPage from './pages/projects/JoinProjectPage'
import NotificationsPage from './pages/dashboard/NotificationsPage'
import ProfileSettingsPage from './pages/settings/ProfileSettingsPage'
import AdminPage from './pages/settings/AdminPage'
import QuickExpensePage from './pages/transactions/QuickExpensePage'

import { ProjectProvider } from './hooks/useProject'
import OverviewTab from './pages/projects/tabs/OverviewTab'
import TransactionsTab from './pages/projects/tabs/TransactionsTab'
import ContributionsTab from './pages/projects/tabs/ContributionsTab'
import AdvancesTab from './pages/projects/tabs/AdvancesTab'
import ResourcesTab from './pages/projects/tabs/ResourcesTab'
import VerificationTab from './pages/projects/tabs/VerificationTab'
import ReimbursementsTab from './pages/projects/tabs/ReimbursementsTab'
import MembersTab from './pages/projects/tabs/MembersTab'
import ReportsTab from './pages/projects/tabs/ReportsTab'
import ProjectSettingsTab from './pages/projects/tabs/ProjectSettingsTab'

import NewExpensePage from './pages/transactions/NewExpensePage'
import TransactionDetailPage from './pages/transactions/TransactionDetailPage'
import NewContributionPage from './pages/contributions/NewContributionPage'
import ContributionDetailPage from './pages/contributions/ContributionDetailPage'

import NotFoundPage from './pages/public/NotFoundPage'

function ProtectedRoute() {
  const { user, loading, isSupabaseConfigured } = useAuth()
  if (!isSupabaseConfigured) return <ConfigNotice />
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-100">
        <Spinner size="lg" label="Loading MoneyMate…" />
      </div>
    )
  }
  if (!user) return <Navigate to="/auth/login" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/auth" element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="forgot" element={<ForgotPasswordPage />} />
        <Route path="reset" element={<ResetPasswordPage />} />
        <Route index element={<Navigate to="/auth/login" replace />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<DashboardPage />} />
        <Route path="/app/projects" element={<ProjectsPage />} />
        <Route path="/app/projects/new" element={<NewProjectPage />} />
        <Route path="/app/join" element={<JoinProjectPage />} />
        <Route path="/app/add" element={<QuickExpensePage />} />
        <Route path="/app/notifications" element={<NotificationsPage />} />
        <Route path="/app/settings" element={<ProfileSettingsPage />} />
        <Route path="/app/admin" element={<AdminPage />} />

        <Route path="/app/projects/:projectId" element={<ProjectProvider />}>
          <Route index element={<OverviewTab />} />
          <Route path="transactions" element={<TransactionsTab />} />
          <Route path="transactions/new" element={<NewExpensePage />} />
          <Route path="transactions/:txId" element={<TransactionDetailPage />} />
          <Route path="contributions" element={<ContributionsTab />} />
          <Route path="contributions/new" element={<NewContributionPage />} />
          <Route path="contributions/:cid" element={<ContributionDetailPage />} />
          <Route path="advances" element={<AdvancesTab />} />
          <Route path="resources" element={<ResourcesTab />} />
          <Route path="verification" element={<VerificationTab />} />
          <Route path="reimbursements" element={<ReimbursementsTab />} />
          <Route path="members" element={<MembersTab />} />
          <Route path="reports" element={<ReportsTab />} />
          <Route path="settings" element={<ProjectSettingsTab />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
