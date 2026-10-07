import React, { useEffect, useRef, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  NavLink,
  Link,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Offcanvas } from 'react-bootstrap';
import { auth, db } from './firebase';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import ProjectList from './ProjectList';
import ProjectForm from './ProjectForm';
import NotificationPage from './NotificationPage';
import PaymentTracker from './PaymentTracker';
import { AppThemeProvider, ThemeToggleButton, useAppTheme, THEMES, THEME_ORDER } from './ThemeContext';
import logo from './logo/logo.png';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

const OWNER_NAME = 'Kelvin Muindi';

const NAV_ITEMS = [
  { to: '/dashboard', icon: 'bi-speedometer2', label: 'Dashboard', title: 'Dashboard' },
  { to: '/projects', icon: 'bi-folder2-open', label: 'Projects', title: 'Projects' },
  { to: '/notifications', icon: 'bi-bell', label: 'Notifications', short: 'Alerts', title: 'Notifications', badge: true },
  { to: '/payments', icon: 'bi-cash-coin', label: 'Payments', title: 'Payments' },
];

const routeTitle = (pathname) => {
  if (pathname.startsWith('/projects/new')) return 'New Project';
  if (pathname.startsWith('/projects/edit')) return 'Edit Project';
  const hit = NAV_ITEMS.find((n) => pathname.startsWith(n.to));
  return hit ? hit.title : 'Records';
};

/* Live notification feed (same Firestore logic as before, shared by every nav surface) */
function useNotificationFeed(pathname) {
  const [newCount, setNewCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preview, setPreview] = useState([]);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(collection(db, 'notifications'), async (snapshot) => {
        const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const fresh = all.filter((n) => !n.isViewed && !n.isRead);
        const unread = all.filter((n) => !n.isRead);

        if (fresh.length > newCount && fresh.length > 0) {
          setToast(fresh[0]);
          clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 5000);
        }

        setNewCount(fresh.length);
        setUnreadCount(unread.length);
        setPreview(unread.slice(0, 5));

        if (pathname === '/notifications' && fresh.length > 0) {
          await Promise.all(
            fresh.map((n) =>
              updateDoc(doc(db, 'notifications', n.id), {
                isViewed: true,
                lastUpdated: new Date().toISOString(),
              })
            )
          );
        }
      }, (error) => {
        console.error('Notification listener error:', error);
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setPreview([]);
      setNewCount(0);
      setUnreadCount(0);
    }
    return () => unsubscribe();
  }, [pathname, newCount]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const clearAll = async () => {
    try {
      await Promise.all(preview.map((n) => deleteDoc(doc(db, 'notifications', n.id))));
      return true;
    } catch (error) {
      console.error('Error clearing notifications:', error);
      return false;
    }
  };

  return { newCount, unreadCount, preview, toast, dismissToast: () => setToast(null), clearAll };
}

/* Theme selector: segmented when there is room, single cycle button when compact */
function ThemeSwitch() {
  const { themeName, setThemeName } = useAppTheme();
  return (
    <div className="theme-switch" role="group" aria-label="Colour theme">
      {THEME_ORDER.map((name) => (
        <button
          key={name}
          type="button"
          className={themeName === name ? 'active' : ''}
          onClick={() => setThemeName(name)}
          aria-pressed={themeName === name}
          title={`${THEMES[name].label} theme`}
        >
          <i className={`bi ${THEMES[name].icon}`} aria-hidden="true" />
          <span>{THEMES[name].label}</span>
        </button>
      ))}
    </div>
  );
}

function Sidebar({ user, collapsed, onToggle, feed, onLogout }) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewTop, setPreviewTop] = useState(0);
  const { newCount, unreadCount, preview, clearAll } = feed;
  const badgeValue = newCount > 0 ? newCount : unreadCount;

  const handleClear = async () => {
    const ok = await clearAll();
    if (ok) setShowPreview(false);
  };

  return (
    <aside className="app-sidebar d-none d-lg-flex" aria-label="Main navigation">
      <div className="side-scroll">
        <div className="side-profile">
          <img src={logo} alt="Company logo" />
          <div className="min-w-0">
            <div className="side-name">{OWNER_NAME}</div>
            <div className="side-email" title={user?.email || ''}>{user?.email || 'No email'}</div>
          </div>
        </div>

        <div>
          <div className="side-section-label mb-2">Menu</div>
          <nav className="side-nav">
            {NAV_ITEMS.map((item) => {
              const link = (
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
                  title={collapsed ? item.title : undefined}
                >
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                  <span className="side-label">{item.label}</span>
                  {item.badge && badgeValue > 0 && (
                    <span className={`side-badge${newCount > 0 ? ' pulse' : ''}`}>
                      {collapsed ? badgeValue : newCount > 0 ? `${newCount} new` : `${unreadCount}`}
                    </span>
                  )}
                </NavLink>
              );

              if (!item.badge) return <React.Fragment key={item.to}>{link}</React.Fragment>;

              return (
                <div
                  key={item.to}
                  onMouseEnter={(e) => {
                    setPreviewTop(e.currentTarget.getBoundingClientRect().top);
                    setShowPreview(true);
                  }}
                  onMouseLeave={() => setShowPreview(false)}
                >
                  {link}
                  {unreadCount > 0 && showPreview && (
                    <div className="notif-pop" style={{ top: previewTop }}>
                      <div className="notif-pop-card">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="mb-0 card-title-sm"><i className="bi bi-bell" aria-hidden="true" /> Unread</h6>
                          <button type="button" className="btn btn-soft-danger btn-sm" onClick={handleClear}>
                            <i className="bi bi-trash3" aria-hidden="true" /> Clear all
                          </button>
                        </div>
                        {preview.length > 0 ? (
                          preview.map((n) => (
                            <div key={n.id} className="notif-pop-item">
                              <span>
                                <strong>{n.title || 'Untitled'}</strong>: {n.message?.slice(0, 30) || 'No message'}...
                              </span>
                            </div>
                          ))
                        ) : (
                          <small className="text-secondary">No unread notifications</small>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div>
          <div className="side-section-label mb-2">Quick action</div>
          <Link to="/projects/new" className="side-link" title={collapsed ? 'Add project' : undefined}>
            <i className="bi bi-plus-circle" aria-hidden="true" />
            <span className="side-label">Add project</span>
          </Link>
        </div>
      </div>

      <div className="side-foot">
        <ThemeSwitch />
        {collapsed && <ThemeToggleButton className="side-link justify-content-center" />}
        <button type="button" className="side-link" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <i className={`bi ${collapsed ? 'bi-layout-sidebar-inset' : 'bi-layout-sidebar-inset-reverse'}`} aria-hidden="true" />
          <span className="side-label">Collapse</span>
        </button>
        <button type="button" className="side-link danger" onClick={onLogout} title={collapsed ? 'Logout' : undefined}>
          <i className="bi bi-box-arrow-right" aria-hidden="true" />
          <span className="side-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}

function MobileMenu({ show, onHide, user, feed, onLogout }) {
  const badgeValue = feed.newCount > 0 ? feed.newCount : feed.unreadCount;
  return (
    <Offcanvas show={show} onHide={onHide} placement="end" aria-labelledby="mobile-menu-title">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title id="mobile-menu-title" className="side-profile p-0">
          <img src={logo} alt="Company logo" />
          <div className="min-w-0">
            <div className="side-name">{OWNER_NAME}</div>
            <div className="side-email">{user?.email || 'No email'}</div>
          </div>
        </Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body className="d-flex flex-column gap-3">
        <nav className="side-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onHide}
              className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
            >
              <i className={`bi ${item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
              {item.badge && badgeValue > 0 && (
                <span className="side-badge">{feed.newCount > 0 ? `${feed.newCount} new` : feed.unreadCount}</span>
              )}
            </NavLink>
          ))}
          <Link to="/projects/new" onClick={onHide} className="side-link">
            <i className="bi bi-plus-circle" aria-hidden="true" />
            <span>Add project</span>
          </Link>
        </nav>

        <div>
          <div className="side-section-label mb-2 px-0">Theme</div>
          <ThemeSwitch />
        </div>

        <button type="button" className="btn btn-soft-danger mt-auto" onClick={onLogout}>
          <i className="bi bi-box-arrow-right" aria-hidden="true" /> Logout
        </button>
      </Offcanvas.Body>
    </Offcanvas>
  );
}

function TabBar({ feed }) {
  const badgeValue = feed.newCount > 0 ? feed.newCount : feed.unreadCount;
  const tab = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}
    >
      <i className={`bi ${item.icon}`} aria-hidden="true" />
      <span>{item.short || item.label}</span>
      {item.badge && badgeValue > 0 && <span className="tab-badge">{badgeValue}</span>}
    </NavLink>
  );
  return (
    <nav className="app-tabbar d-lg-none" aria-label="Primary">
      {tab(NAV_ITEMS[0])}
      {tab(NAV_ITEMS[1])}
      <Link to="/projects/new" className="tab-fab" aria-label="Add project" title="Add project">
        <i className="bi bi-plus-lg" aria-hidden="true" />
      </Link>
      {tab(NAV_ITEMS[2])}
      {tab(NAV_ITEMS[3])}
    </nav>
  );
}

const IDLE_LIMIT_MS = 10 * 60 * 1000; // log out after 10 minutes without activity
const IDLE_CHECK_MS = 15 * 1000;
const IDLE_KEY = 'lastActivityAt';
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

/* Signs the user out after IDLE_LIMIT_MS of inactivity.
   Uses timestamps (not one long timer) so it stays correct when a tab is
   throttled or the device sleeps, and shares activity across open tabs. */
function useIdleLogout(onIdle) {
  const onIdleRef = useRef(onIdle);
  useEffect(() => { onIdleRef.current = onIdle; }, [onIdle]);

  useEffect(() => {
    let last = Date.now();
    let fired = false;

    const readShared = () => {
      try {
        const v = Number(window.localStorage.getItem(IDLE_KEY));
        return Number.isFinite(v) ? v : 0;
      } catch (err) {
        return 0;
      }
    };
    const markActive = () => {
      last = Date.now();
      try { window.localStorage.setItem(IDLE_KEY, String(last)); } catch (err) { /* ignore */ }
    };
    const check = () => {
      if (fired) return;
      const latest = Math.max(last, readShared());
      if (Date.now() - latest >= IDLE_LIMIT_MS) {
        fired = true;
        onIdleRef.current();
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };

    markActive();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(check, IDLE_CHECK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive));
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, []);
}

function AppShell({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const feed = useNotificationFeed(location.pathname);

  const isFormRoute =
    location.pathname.startsWith('/projects/new') || location.pathname.startsWith('/projects/edit');

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setMenuOpen(false);
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  useIdleLogout(handleLogout);

  return (
    <div className={`app-shell${collapsed ? ' is-collapsed' : ''}${isFormRoute ? ' no-tabbar' : ''}`}>
      <Sidebar
        user={user}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        feed={feed}
        onLogout={handleLogout}
      />

      <header className="app-topbar d-lg-none">
        <div className="topbar-brand">
          <img src={logo} alt="Company logo" />
          <span className="topbar-title truncate">{routeTitle(location.pathname)}</span>
        </div>
        <div className="topbar-actions">
          <ThemeToggleButton />
          <button type="button" className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <i className="bi bi-list" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="app-content">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </div>
        <footer className="app-footer">
          &copy; {new Date().getFullYear()} {OWNER_NAME}. All rights reserved.
        </footer>
      </main>

      <TabBar feed={feed} />
      <MobileMenu show={menuOpen} onHide={() => setMenuOpen(false)} user={user} feed={feed} onLogout={handleLogout} />

      {feed.toast && (
        <div className="app-toast-wrap" role="status" aria-live="polite">
          <div className="app-toast warning">
            <i className="bi bi-bell-fill" aria-hidden="true" />
            <div className="min-w-0">
              <strong className="d-block">New notification</strong>
              <span className="small">
                {feed.toast.title}: {feed.toast.message?.slice(0, 30) || 'No message'}...
              </span>
            </div>
            <button type="button" className="btn-close" aria-label="Dismiss" onClick={feed.dismissToast} />
          </div>
        </div>
      )}
    </div>
  );
}

/* Auth gate + persistent layout: the shell stays mounted while child routes change */
function PrivateLayout({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell user={user} />;
}

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AppThemeProvider>
      {!authChecked ? (
        <div className="page-loader vh-100">
          <div className="spinner-ring" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mb-0">Loading your experience...</p>
        </div>
      ) : (
        <Router>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to="/login" /> : <Register />} />

            <Route element={<PrivateLayout user={user} />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<ProjectList />} />
              <Route path="/projects/new" element={<ProjectForm />} />
              <Route path="/projects/edit/:id" element={<ProjectForm />} />
              <Route path="/notifications" element={<NotificationPage />} />
              <Route path="/payments" element={<PaymentTracker />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Router>
      )}
    </AppThemeProvider>
  );
}

export default App;
