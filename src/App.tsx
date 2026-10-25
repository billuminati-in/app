import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import { AuthCallback, ResetPassword } from './pages/AuthCallback'
import Groups from './pages/Groups'
import NewGroup from './pages/NewGroup'
import Group from './pages/Group'
import ExpenseForm from './pages/ExpenseForm'
import Balances from './pages/Balances'
import { PaymentDetail, SettleUp } from './pages/SettleUp'
import Members from './pages/Members'
import Join from './pages/Join'
import Activity from './pages/Activity'
import GroupSettings from './pages/GroupSettings'
import Account from './pages/Account'

function Private({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Spinner />
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/reset" element={<ResetPassword />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="/" element={<Private><Groups /></Private>} />
          <Route path="/new" element={<Private><NewGroup /></Private>} />
          <Route path="/account" element={<Private><Account /></Private>} />
          <Route path="/g/:id" element={<Private><Group /></Private>} />
          <Route path="/g/:id/expense/:eid" element={<Private><ExpenseForm /></Private>} />
          <Route path="/g/:id/balances" element={<Private><Balances /></Private>} />
          <Route path="/g/:id/settle" element={<Private><SettleUp /></Private>} />
          <Route path="/g/:id/payment/:sid" element={<Private><PaymentDetail /></Private>} />
          <Route path="/g/:id/members" element={<Private><Members /></Private>} />
          <Route path="/g/:id/activity" element={<Private><Activity /></Private>} />
          <Route path="/g/:id/settings" element={<Private><GroupSettings /></Private>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
