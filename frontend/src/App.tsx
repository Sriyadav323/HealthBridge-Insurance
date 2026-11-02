
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
} from 'react-router-dom';

import MainLayout from './layouts/MainLayout';
import DashboardPage from './features/dashboard/pages/DashboardPage';
import BenefitsPage from './features/benefits/pages/BenefitsPage';
import ClaimsPage from './features/claims/pages/ClaimsPage';
import ProvidersPage from './features/providers/pages/ProvidersPage';
import IdCardPage from './features/id-card/pages/IdCardPage';
import ProfilePage from './features/profile/pages/ProfilePage';
import PharmacyPage from './features/pharmacy/pages/PharmacyPage';

import RequireSession from './features/auth/RequireSession';
import { useAuth } from './features/auth/AuthContext';
import type { Role } from './features/auth/AuthContext';
import AdminClaimsPage from './features/admin/pages/AdminClaimsPage';
import InsurancePlansPage from './features/admin/pages/InsurancePlansPage';
import AdminDashboardPage from './features/admin/pages/AdminDashboardPage';
import MembersPage from './features/admin/pages/MembersPage';
import MemberDetailsPage from './features/admin/pages/MemberDetailsPage';
import RegisterMemberPage from './features/admin/pages/RegisterMemberPage';
import PasswordSetupPage from './features/auth/PasswordSetupPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import './App.css';
import './premium.css';
import './portal-system.css';

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user.roles.includes('ADMIN') ? '/admin' : '/dashboard'} replace />;
}

function RoleRoute({ role }: { role: Role }) {
  const { user } = useAuth();
  return user.roles.includes(role) ? <Outlet /> : <HomeRedirect />;
}

function PortalRoutes() {
  return <Routes><Route element={<MainLayout />}>
    <Route path="/" element={<HomeRedirect />} />
    <Route element={<RoleRoute role="ADMIN" />}>
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/admin/plans" element={<InsurancePlansPage />} />
      <Route path="/admin/claims" element={<AdminClaimsPage />} />
      <Route path="/admin/members" element={<MembersPage />} />
      <Route path="/admin/members/new" element={<RegisterMemberPage />} />
      <Route path="/admin/members/:id" element={<MemberDetailsPage />} />
    </Route>
    <Route element={<RoleRoute role="MEMBER" />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/benefits" element={<BenefitsPage />} />
      <Route path="/claims" element={<ClaimsPage />} />
      <Route path="/providers" element={<ProvidersPage />} />
      <Route path="/id-card" element={<IdCardPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/pharmacy" element={<PharmacyPage />} />
    </Route>
    <Route path="*" element={<div><h1>Page not found</h1><a href="/">Return to your dashboard</a></div>} />
  </Route></Routes>;
}

function SessionPortal() {
  const navigate = useNavigate();
  return <RequireSession onSignIn={account => navigate(account.roles.includes('ADMIN') ? '/admin' : '/dashboard', { replace: true })}>
    <PortalRoutes />
  </RequireSession>;
}

function App() {
  return <BrowserRouter><Routes>
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<PasswordSetupPage reset />} />
    <Route path="/set-password" element={<PasswordSetupPage />} />
    <Route path="*" element={<SessionPortal />} />
  </Routes></BrowserRouter>;
}

export default App;
