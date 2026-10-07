import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from './firebase';
import { collection, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaTachometerAlt, FaFolder, FaBell, FaMoon, FaSun, FaSignOutAlt,
  FaTrash, FaPalette, FaChevronLeft, FaChevronRight, FaClock, FaMoneyBillWave
} from 'react-icons/fa';
import { TypeAnimation } from 'react-type-animation';
import logo from './logo/logo.png';
import styled, { ThemeProvider } from 'styled-components';
import { useAuth } from './context/AuthContext';

//  Themes

const lightTheme = {
  background: '#f8f9fa',
  cardBackground: '#ffffff',
  text: '#212529',
  primary: '#007bff',
  secondary: '#6c757d',
  success: '#28a745',
  warning: '#ffc107',
  danger: '#dc3545',
  shadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
  gradient: 'linear-gradient(135deg, #e0eafc, #cfdef3)',
  sidebarBg: 'linear-gradient(180deg, #ffffff, #f0f4f8)'
};

const darkTheme = {
  background: '#1a1a2e',
  cardBackground: '#16213e',
  text: '#e0e0e0',
  primary: '#00d4ff',
  secondary: '#a3bffa',
  success: '#48bb78',
  warning: '#ecc94b',
  danger: '#f56565',
  shadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
  gradient: 'linear-gradient(135deg, #2a4365, #1a1a2e)',
  sidebarBg: 'linear-gradient(180deg, #16213e, #0f1419)'
};

const vibrantTheme = {
  background: '#ffeaa7',
  cardBackground: '#fff5f5',
  text: '#2d3748',
  primary: '#9f7aea',
  secondary: '#ed64a6',
  success: '#38b2ac',
  warning: '#ed8936',
  danger: '#e53e3e',
  shadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
  gradient: 'linear-gradient(135deg, #f6e05e, #ed64a6)',
  sidebarBg: 'linear-gradient(180deg, #fff5f5, #ffeaa7)'
};

//  Styled components 

const SidebarContainer = styled(motion.div)`
  width: ${props => (props.isCollapsed ? '80px' : '280px')};
  min-height: 100vh;
  transition: width 0.3s ease;
  color: ${props => props.theme.text};
  position: fixed;
  left: 0;
  top: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: ${props => props.theme.sidebarBg};
  border-right: 2px solid ${props => props.theme.primary}40;
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  display: flex;
  flex-direction: column;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: ${props => props.theme.primary}40;
    border-radius: 3px;
  }
`;

const NavLinkStyled = styled(NavLink)`
  padding: 12px 16px;
  margin: 6px 12px;
  border-radius: 10px;
  color: ${props => props.theme.text};
  display: flex;
  align-items: center;
  position: relative;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s ease;

  &.active {
    background: ${props => props.theme.primary}30;
    box-shadow: 0 4px 12px ${props => props.theme.primary}40;
    border-left: 3px solid ${props => props.theme.primary};
  }

  &:hover {
    background: ${props => props.theme.primary}20;
    transform: translateX(4px);
  }
`;

const ButtonStyled = styled(motion.button)`
  background: ${props => props.theme.primary}20;
  color: ${props => props.theme.text};
  border: 1px solid ${props => props.theme.primary}40;
  border-radius: 10px;
  padding: 10px 14px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => props.theme.primary}30;
    border-color: ${props => props.theme.primary};
    transform: translateY(-2px);
  }
`;

const ThemeToggle = styled(motion.button)`
  position: absolute;
  top: 15px;
  right: 15px;
  background: ${props => props.theme.primary};
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1001;
  box-shadow: 0 4px 12px ${props => props.theme.primary}60;
`;

const NotificationBadge = styled(motion.span)`
  background: ${props => props.theme.danger};
  color: #fff;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
  margin-left: 8px;
  box-shadow: 0 2px 8px ${props => props.theme.danger}60;
`;

const NotificationPreview = styled(motion.div)`
  position: fixed;
  left: ${props => props.isCollapsed ? '90px' : '290px'};
  top: ${props => props.top || '200px'};
  background: ${props => props.theme.cardBackground};
  color: ${props => props.theme.text};
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  border: 1px solid ${props => props.theme.primary}40;
  padding: 16px;
  min-width: 300px;
  max-width: 350px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 1050;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb {
    background: ${props => props.theme.primary}40;
    border-radius: 3px;
  }
`;

const NotificationItem = styled(motion.div)`
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: ${props => props.theme.primary}10;
  border-left: 3px solid ${props => props.theme.primary};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.theme.primary}20;
    transform: translateX(4px);
  }
`;

const ToastContainer = styled(motion.div)`
  position: fixed;
  top: 20px;
  right: 20px;
  background: ${props => props.theme.cardBackground};
  color: ${props => props.theme.text};
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  border: 2px solid ${props => props.theme.danger};
  padding: 16px 20px;
  min-width: 300px;
  max-width: 400px;
  z-index: 2000;
`;

const IdleWarningBanner = styled(motion.div)`
  margin: 8px 12px 4px;
  padding: 12px 14px;
  border-radius: 10px;
  background: ${props => props.theme.danger}18;
  border: 1px solid ${props => props.theme.danger}60;
  color: ${props => props.theme.text};
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CountdownBar = styled.div`
  height: 4px;
  border-radius: 2px;
  background: ${props => props.theme.danger}30;
  overflow: hidden;

  div {
    height: 100%;
    border-radius: 2px;
    background: ${props => props.theme.danger};
    transition: width 1s linear;
    width: ${props => props.pct}%;
  }
`;

const Tooltip = styled(motion.div)`
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  background: ${props => props.theme.cardBackground};
  color: ${props => props.theme.text};
  padding: 8px 12px;
  border-radius: 8px;
  margin-left: 12px;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  border: 1px solid ${props => props.theme.primary}40;
  font-size: 0.875rem;
  font-weight: 500;
  z-index: 1001;
  pointer-events: none;
`;

// Component 

function Sidebar({ user }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { idleWarning, secondsLeft, dismissIdleWarning, logout } = useAuth();

  const [isCollapsed, setIsCollapsed]                       = useState(false);
  const [theme, setTheme]                                   = useState(darkTheme);
  const [newCount, setNewCount]                             = useState(0);
  const [unreadCount, setUnreadCount]                       = useState(0);
  const [showNotificationPreview, setShowNotificationPreview] = useState(false);
  const [notificationsPreview, setNotificationsPreview]     = useState([]);
  const [newNotificationToast, setNewNotificationToast]     = useState(null);
  const [hoveredLink, setHoveredLink]                       = useState(null);

  const toggleTheme = () => {
    if (theme === lightTheme) setTheme(darkTheme);
    else if (theme === darkTheme) setTheme(vibrantTheme);
    else setTheme(lightTheme);
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      try {
        await auth.signOut();
        navigate('/login');
      } catch (error) {
        console.error('Failed to log out:', error);
      }
    }
  };

  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
    setShowNotificationPreview(false);
  };

  const fetchNotificationsData = () => {
    try {
      const unsubscribe = onSnapshot(collection(db, 'notifications'), async (snapshot) => {
        const notificationsData = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        const newNotifications    = notificationsData.filter(n => !n.isViewed && !n.isRead);
        const unreadNotifications = notificationsData.filter(n => !n.isRead);

        if (newNotifications.length > newCount && newNotifications.length > 0) {
          const latestNotification = newNotifications[0];
          setNewNotificationToast(latestNotification);
          setTimeout(() => setNewNotificationToast(null), 5000);
        }

        setNewCount(newNotifications.length);
        setUnreadCount(unreadNotifications.length);
        setNotificationsPreview(unreadNotifications.slice(0, 10));

        if (location.pathname === '/notifications' && newNotifications.length > 0) {
          const updatePromises = newNotifications.map(n =>
            updateDoc(doc(db, 'notifications', n.id), {
              isViewed: true,
              lastUpdated: new Date().toISOString()
            })
          );
          await Promise.all(updatePromises);
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const clearAllNotifications = async () => {
    if (window.confirm('Are you sure you want to clear all notifications?')) {
      try {
        const deletePromises = notificationsPreview.map(n =>
          deleteDoc(doc(db, 'notifications', n.id))
        );
        await Promise.all(deletePromises);
        setShowNotificationPreview(false);
      } catch (error) {
        console.error('Error clearing notifications:', error);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = fetchNotificationsData();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [location.pathname, newCount]);

  const iconVariants = {
    hover: { scale: 1.15, rotate: 5 },
    tap:   { scale: 0.95 }
  };

  const badgeVariants = {
    initial: { scale: 0 },
    animate: { scale: 1, transition: { type: 'spring', stiffness: 500, damping: 15 } },
    pulse:   { scale: [1, 1.15, 1], transition: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } }
  };

  const warnPct = Math.round((secondsLeft / 60) * 100);

  return (
    <ThemeProvider theme={theme}>
      <SidebarContainer isCollapsed={isCollapsed}>

        {/* Theme Toggle */}
        <ThemeToggle
          onClick={toggleTheme}
          whileHover={{ scale: 1.1, rotate: 180 }}
          whileTap={{ scale: 0.9 }}
          transition={{ duration: 0.3 }}
        >
          {theme === lightTheme ? <FaSun /> : theme === darkTheme ? <FaMoon /> : <FaPalette />}
        </ThemeToggle>

        {/* New-notification toast */}
        <AnimatePresence>
          {newNotificationToast && (
            <ToastContainer
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              transition={{ duration: 0.3 }}
            >
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div className="d-flex align-items-center gap-2">
                  <FaBell size={18} color={theme.danger} />
                  <strong>New Notification</strong>
                </div>
                <button
                  className="btn-close btn-sm"
                  onClick={() => setNewNotificationToast(null)}
                  style={{ fontSize: '0.7rem' }}
                />
              </div>
              <div style={{ fontSize: '0.875rem' }}>
                <strong>{newNotificationToast.title || 'Untitled'}</strong>
                <div className="text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                  {newNotificationToast.type?.replace('-', ' ') || 'Notification'}
                </div>
              </div>
            </ToastContainer>
          )}
        </AnimatePresence>

        {/* Notification preview popup */}
        <AnimatePresence>
          {showNotificationPreview && notificationsPreview.length > 0 && (
            <NotificationPreview
              isCollapsed={isCollapsed}
              initial={{ opacity: 0, scale: 0.9, x: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: -20 }}
              transition={{ duration: 0.2 }}
              theme={theme}
            >
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0 fw-bold">Recent Notifications</h6>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={clearAllNotifications}
                  style={{ fontSize: '0.75rem' }}
                >
                  <FaTrash size={12} /> Clear All
                </button>
              </div>
              {notificationsPreview.map((notif, index) => (
                <NotificationItem
                  key={notif.id}
                  theme={theme}
                  onClick={() => navigate('/notifications')}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="d-flex align-items-start gap-2">
                    <div style={{
                      width: '6px', height: '6px',
                      background: theme.primary, borderRadius: '50%', marginTop: '6px'
                    }} />
                    <div style={{ flex: 1 }}>
                      <div className="fw-bold" style={{ fontSize: '0.875rem' }}>
                        {notif.title || 'Untitled'}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {notif.type?.replace('-', ' ') || 'Notification'}
                      </div>
                    </div>
                  </div>
                </NotificationItem>
              ))}
              <button
                className="btn btn-primary btn-sm w-100 mt-2"
                onClick={() => navigate('/notifications')}
              >
                View All Notifications
              </button>
            </NotificationPreview>
          )}
        </AnimatePresence>

        {/* Profile section */}
        <div className="p-3 border-bottom" style={{ borderColor: `${theme.primary}30` }}>
          {!isCollapsed ? (
            <motion.div className="text-center" whileHover={{ scale: 1.02 }}>
              <motion.img
                src={logo}
                alt="Company Logo"
                className="rounded-circle mb-2"
                style={{
                  width: '70px', height: '70px',
                  border: `3px solid ${theme.primary}`,
                  boxShadow: `0 0 20px ${theme.primary}60`,
                  objectFit: 'cover'
                }}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.3 }}
              />
              <TypeAnimation
                sequence={['Kelvin Muindi', 2000]}
                wrapper="h5"
                speed={50}
                style={{ color: theme.text, fontSize: '1.1rem', fontWeight: '600', marginBottom: '4px' }}
                repeat={Infinity}
              />
              <small style={{ color: theme.secondary, fontSize: '0.8rem' }}>
                {user?.email || 'No email'}
              </small>
            </motion.div>
          ) : (
            <div className="d-flex justify-content-center">
              <motion.img
                src={logo}
                alt="Logo"
                className="rounded-circle"
                style={{
                  width: '50px', height: '50px',
                  border: `2px solid ${theme.primary}`,
                  boxShadow: `0 0 15px ${theme.primary}50`,
                  objectFit: 'cover'
                }}
                whileHover={{ scale: 1.15, rotate: 10 }}
              />
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <div className="px-3 pt-2">
          <ButtonStyled
            onClick={toggleSidebar}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {isCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
            {!isCollapsed && <span>Collapse</span>}
          </ButtonStyled>
        </div>

        {/* Navigation links */}
        <nav className="nav flex-column py-3 flex-grow-1">
          <NavLinkStyled
            to="/dashboard"
            onMouseEnter={() => setHoveredLink('dashboard')}
            onMouseLeave={() => setHoveredLink(null)}
          >
            <motion.div variants={iconVariants} whileHover="hover" whileTap="tap">
              <FaTachometerAlt size={20} />
            </motion.div>
            {!isCollapsed && <span className="ms-3">Dashboard</span>}
            {isCollapsed && hoveredLink === 'dashboard' && (
              <Tooltip theme={theme} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                Dashboard
              </Tooltip>
            )}
          </NavLinkStyled>

          <NavLinkStyled
            to="/projects"
            onMouseEnter={() => setHoveredLink('projects')}
            onMouseLeave={() => setHoveredLink(null)}
          >
            <motion.div variants={iconVariants} whileHover="hover" whileTap="tap">
              <FaFolder size={20} />
            </motion.div>
            {!isCollapsed && <span className="ms-3">Projects</span>}
            {isCollapsed && hoveredLink === 'projects' && (
              <Tooltip theme={theme} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                Projects
              </Tooltip>
            )}
          </NavLinkStyled>

          <NavLinkStyled
            to="/notifications"
            onMouseEnter={() => setHoveredLink('notifications')}
            onMouseLeave={() => setHoveredLink(null)}
            onClick={() => setShowNotificationPreview(false)}
          >
            <motion.div
              variants={iconVariants}
              whileHover="hover"
              whileTap="tap"
              animate={newCount > 0 ? { rotate: [0, -15, 15, -15, 0] } : {}}
              transition={{ duration: 0.5, repeat: newCount > 0 ? Infinity : 0, repeatDelay: 3 }}
            >
              <FaBell size={20} />
            </motion.div>
            {!isCollapsed && (
              <>
                <span className="ms-3">Notifications</span>
                {(newCount > 0 || unreadCount > 0) && (
                  <NotificationBadge
                    theme={theme}
                    variants={badgeVariants}
                    initial="initial"
                    animate={newCount > 0 ? 'pulse' : 'animate'}
                    onMouseEnter={() => setShowNotificationPreview(true)}
                    onMouseLeave={() => setTimeout(() => setShowNotificationPreview(false), 300)}
                  >
                    {newCount > 0 ? newCount : unreadCount}
                  </NotificationBadge>
                )}
              </>
            )}
            {isCollapsed && (
              <>
                {(newCount > 0 || unreadCount > 0) && (
                  <NotificationBadge
                    theme={theme}
                    variants={badgeVariants}
                    initial="initial"
                    animate={newCount > 0 ? 'pulse' : 'animate'}
                    style={{ position: 'absolute', top: '8px', right: '8px', padding: '3px 6px' }}
                  >
                    {newCount > 0 ? newCount : unreadCount}
                  </NotificationBadge>
                )}
                {hoveredLink === 'notifications' && (
                  <Tooltip theme={theme} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                    Notifications {unreadCount > 0 && `(${unreadCount})`}
                  </Tooltip>
                )}
              </>
            )}
          </NavLinkStyled>

          <NavLinkStyled
            to="/payments"
            onMouseEnter={() => setHoveredLink('payments')}
            onMouseLeave={() => setHoveredLink(null)}
          >
            <motion.div variants={iconVariants} whileHover="hover" whileTap="tap">
              <FaMoneyBillWave size={20} />
            </motion.div>
            {!isCollapsed && <span className="ms-3">Payments</span>}
            {isCollapsed && hoveredLink === 'payments' && (
              <Tooltip theme={theme} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                Payments
              </Tooltip>
            )}
          </NavLinkStyled>
        </nav>

        {/* Idle warning banner */}
        <AnimatePresence>
          {idleWarning && (
            <IdleWarningBanner
              theme={theme}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="d-flex align-items-center gap-2" style={{ color: theme.danger, fontWeight: 600 }}>
                <FaClock size={13} />
                {!isCollapsed
                  ? `Session expires in ${secondsLeft}s`
                  : `${secondsLeft}s`
                }
              </div>

              {!isCollapsed && (
                <>
                  <CountdownBar theme={theme} pct={warnPct}>
                    <div />
                  </CountdownBar>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm flex-grow-1"
                      style={{
                        background: theme.primary,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '7px',
                        fontSize: '0.75rem',
                        padding: '5px 0'
                      }}
                      onClick={dismissIdleWarning}
                    >
                      Stay logged in
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{
                        background: 'transparent',
                        color: theme.danger,
                        border: `1px solid ${theme.danger}60`,
                        borderRadius: '7px',
                        fontSize: '0.75rem',
                        padding: '5px 10px'
                      }}
                      onClick={() => { logout(); navigate('/login'); }}
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
            </IdleWarningBanner>
          )}
        </AnimatePresence>

        {/* Logout button */}
        <div className="p-3 border-top mt-auto" style={{ borderColor: `${theme.primary}30` }}>
          <ButtonStyled
            onClick={handleLogout}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <motion.div variants={iconVariants} whileHover="hover" whileTap="tap">
              <FaSignOutAlt />
            </motion.div>
            {!isCollapsed && <span>Logout</span>}
          </ButtonStyled>
        </div>

      </SidebarContainer>
    </ThemeProvider>
  );
}

export default Sidebar;