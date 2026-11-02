
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import { useAuth } from '../features/auth/AuthContext';

function MainLayout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const isAdmin = user.roles.includes('ADMIN');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await signOut();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="app-header">
        <Link className="header-brand" to={isAdmin ? '/admin' : '/dashboard'} aria-label="HealthBridge dashboard" onClick={() => setMenuOpen(false)}><BrandMark /><div><h1>HealthBridge Insurance</h1><p>{isAdmin ? 'Administration Portal' : 'Health Insurance Member Portal'}</p></div></Link>

        <button type="button" className="mobile-nav-toggle" aria-expanded={menuOpen} aria-controls="portal-navigation" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? 'Close menu' : 'Menu'} <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span></button>
      </header>

      <div className="app-body">
        <nav id="portal-navigation" className={`sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation" onClick={event => { if ((event.target as HTMLElement).closest('a')) setMenuOpen(false); }}>
          <p className={`sidebar-label${isAdmin ? ' sidebar-label-admin' : ''}`}>{isAdmin ? 'ADMINISTRATION' : 'YOUR MEMBER PORTAL'}</p>
          {isAdmin ? <>
            <NavLink to="/admin" end>Admin Dashboard</NavLink>
            <NavLink to="/admin/plans">Insurance Plans</NavLink>
            <NavLink to="/admin/claims">Claims Management</NavLink>
            <NavLink to="/admin/members" end>Member Management</NavLink>
            <NavLink to="/admin/members/new">Register Member</NavLink>
          </> : <>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/benefits">My Benefits</NavLink>
          <NavLink to="/claims">My Claims</NavLink>
          <NavLink to="/providers">Find a Doctor</NavLink>
          <NavLink to="/id-card">Digital ID Card</NavLink>
          <NavLink to="/pharmacy">Pharmacy & Prescriptions</NavLink>
          <NavLink to="/profile">My Profile</NavLink>
          </>}
          <button type="button" className="sidebar-logout" data-leave-form disabled={loggingOut} onClick={handleLogout}>
            <span className="logout-symbol" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H5v14h4M13 8l4 4-4 4M8 12h12" /></svg></span>
            <span className="logout-label">{loggingOut ? 'Signing out...' : 'Logout'}<small aria-hidden="true">End your session</small></span>
          </button>
        </nav>

        <main id="main-content" className="page-content" tabIndex={-1}>
          {pathname !== (isAdmin ? '/admin' : '/dashboard') && <nav className="page-breadcrumb" aria-label="Breadcrumb"><Link to={isAdmin ? '/admin' : '/dashboard'}>{isAdmin ? 'Admin home' : 'Member home'}</Link><span aria-hidden="true">/</span><span aria-current="page">{({ '/admin/plans': 'Insurance plans', '/admin/claims': 'Claims management', '/admin/members': 'Members', '/admin/members/new': 'Register member', '/benefits': 'My benefits', '/claims': 'My claims', '/providers': 'Find a doctor', '/id-card': 'Digital ID', '/pharmacy': 'Pharmacy', '/profile': 'My profile' } as Record<string,string>)[pathname] ?? 'Member details'}</span></nav>}
          <div className="page-view" key={pathname}><Outlet /></div>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
