import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { collection, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTachometerAlt, FaFolder, FaBell, FaMoon, FaSun, FaSignOutAlt, FaTrash, FaPalette } from 'react-icons/fa';
import { TypeAnimation } from 'react-type-animation';
import styled, { ThemeProvider } from 'styled-components';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import ProjectList from './ProjectList';
import ProjectForm from './ProjectForm';
import NotificationPage from './NotificationPage';
import logo from './logo/logo.png';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

// Define themes (shared across the app)
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
  gradient: 'linear-gradient(135deg, #e0eafc, #cfdef3)'
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
  gradient: 'linear-gradient(135deg, #2a4365, #1a1a2e)'
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
  gradient: 'linear-gradient(135deg, #f6e05e, #ed64a6)'
};

// Styled components for the layout
const AppContainer = styled.div`
  display: flex;
  min-height: 100vh;
  background: ${props => props.theme.gradient};
  position: relative;
  overflow: hidden;
`;

const MainContent = styled.main`
  flex-grow: 1;
  padding: 3rem;
  background: ${props => props.theme.background};
  color: ${props => props.theme.text};
`;

const Footer = styled.footer`
  padding: 1rem 0;
  background: ${props => props.theme.cardBackground};
  color: ${props => props.theme.text};
  border-top: 1px solid ${props => props.theme.secondary}33;
  text-align: center;
`;

const SidebarContainer = styled.div`
  width: ${props => (props.isCollapsed ? '80px' : '280px')};
  min-height: 100vh;
  transition: width 0.3s ease;
  color: ${props => props.theme.text};
  position: relative;
  overflow: hidden;
  background: ${props => props.theme.gradient};
  border-right: 1px solid rgba(255, 255, 255, 0.1);
`;

const NavLinkStyled = styled(NavLink)`
  padding: 10px 15px;
  margin: 5px 10px;
  border-radius: 8px;
  color: ${props => props.theme.text};
  display: flex;
  align-items: center;
  position: relative;
  background: ${props => props.isActive ? `${props.theme.primary}33` : 'transparent'};
  box-shadow: ${props => props.isActive ? `0 0 15px ${props.theme.primary}66` : 'none'};
  justify-content: ${props => (props.isCollapsed ? 'center' : 'flex-start')};
  transition: all 0.3s ease;
  &:hover {
    background: ${props => `${props.theme.primary}22`};
  }
`;

const ButtonStyled = styled(motion.button)`
  background: ${props => props.theme.primary};
  color: ${props => props.theme.cardBackground};
  border: none;
  border-radius: 8px;
  padding: 8px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: ${props => (props.isCollapsed ? 'center' : 'flex-start')};
  margin: 5px 0;
  transition: all 0.3s ease;
`;

const ThemeToggle = styled(motion.button)`
  position: absolute;
  top: 20px;
  right: 20px;
  background: ${props => props.theme.primary};
  color: ${props => props.theme.cardBackground};
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1000;
`;

const Sidebar = ({ user, theme, toggleTheme }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isProfileHovered, setIsProfileHovered] = useState(false);
  const [notificationsPreview, setNotificationsPreview] = useState([]);
  const [newNotificationToast, setNewNotificationToast] = useState(null);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };

  // Fetch new and unread notifications count and preview
  const fetchNotificationsData = () => {
    try {
      const unsubscribe = onSnapshot(collection(db, 'notifications'), async (snapshot) => {
        const notificationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Only count as "new" if not viewed AND not read
        const newNotifications = notificationsData.filter(notif => !notif.isViewed && !notif.isRead);
        const unreadNotifications = notificationsData.filter(notif => !notif.isRead);

        if (newNotifications.length > newCount && newNotifications.length > 0) {
          const latestNotification = newNotifications[0];
          setNewNotificationToast(latestNotification);
          setTimeout(() => setNewNotificationToast(null), 5000);
        }

        setNewCount(newNotifications.length);
        setUnreadCount(unreadNotifications.length);
        setNotificationsPreview(unreadNotifications.slice(0, 5) || []);

        if (location.pathname === '/notifications' && newNotifications.length > 0) {
          const updatePromises = newNotifications.map(notif =>
            updateDoc(doc(db, 'notifications', notif.id), {
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
      setNotificationsPreview([]);
      setNewCount(0);
      setUnreadCount(0);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const notificationsToDelete = notificationsPreview.map(notif =>
        deleteDoc(doc(db, 'notifications', notif.id))
      );
      await Promise.all(notificationsToDelete);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = fetchNotificationsData();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [location.pathname, newCount]);

  const iconVariants = {
    hover: { scale: 1.2, rotate: 10, transition: { duration: 0.2 } },
    initial: { scale: 1, rotate: 0 },
    pulse: {
      scale: [1, 1.2, 1],
      transition: { duration: 0.8, repeat: Infinity }
    }
  };

  const badgeVariants = {
    initial: { scale: 0 },
    animate: { scale: 1, transition: { type: 'spring', stiffness: 300 } },
    pulse: {
      scale: [1, 1.2, 1],
      boxShadow: [`0 0 5px ${theme.danger}50`, `0 0 15px ${theme.danger}80`, `0 0 5px ${theme.danger}50`],
      transition: { duration: 0.8, repeat: Infinity }
    }
  };

  const tooltipVariants = {
    hidden: { opacity: 0, x: 10 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.2 } }
  };

  const toastVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -50, transition: { duration: 0.3 } }
  };

  const profileVariants = {
    hover: { scale: 1.05, rotateX: 10, rotateY: 10, transition: { duration: 0.3 } },
    initial: { scale: 1, rotateX: 0, rotateY: 0 }
  };

  return (
    <SidebarContainer isCollapsed={isCollapsed}>
      <ThemeToggle
        onClick={toggleTheme}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {theme === lightTheme ? <FaSun /> : theme === darkTheme ? <FaMoon /> : <FaPalette />}
      </ThemeToggle>

      <style>
        {`
          @keyframes float {
            0% { transform: translateY(0); }
            50% { transform: translateY(-20vh); }
            100% { transform: translateY(0); }
          }
          .particle {
            position: absolute;
            width: 5px;
            height: 5px;
            background: ${theme.primary};
            border-radius: 50%;
            opacity: 0.3;
            animation: float ${Math.random() * 10 + 5}s infinite;
          }
          @keyframes glitch {
            0% { transform: translate(0); }
            20% { transform: translate(-2px, 2px); }
            40% { transform: translate(2px, -2px); }
            60% { transform: translate(-2px, 2px); }
            80% { transform: translate(2px, -2px); }
            100% { transform: translate(0); }
          }
          .glitch:hover {
            animation: glitch 0.3s linear infinite;
          }
        `}
      </style>
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
        />
      ))}

      <AnimatePresence>
        {newNotificationToast && (
          <motion.div
            className="position-fixed top-0 start-50 translate-middle-x p-3"
            style={{ zIndex: 1050, minWidth: '200px' }}
            variants={toastVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="toast show" style={{ background: theme.cardBackground, color: theme.text, border: `1px solid ${theme.danger}` }}>
              <div className="toast-header">
                <strong className="me-auto">New Notification</strong>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setNewNotificationToast(null)}
                ></button>
              </div>
              <div className="toast-body">
                {newNotificationToast.title}: {newNotificationToast.message?.slice(0, 30) || 'No message'}...
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="p-3 border-bottom"
        style={{ borderColor: `rgba(${theme.text === '#e0e0e0' ? '255, 255, 255' : '0, 0, 0'}, 0.2)` }}
        onMouseEnter={() => setIsProfileHovered(true)}
        onMouseLeave={() => setIsProfileHovered(false)}
      >
        {!isCollapsed ? (
          <motion.div
            className="text-center glitch"
            variants={profileVariants}
            initial="initial"
            animate={isProfileHovered ? "hover" : "initial"}
            style={{ perspective: '1000px' }}
          >
            <motion.img
              src={logo}
              alt="Company Logo"
              className="rounded-circle mb-2"
              style={{
                width: '60px',
                height: '60px',
                border: `2px solid ${theme.primary}`,
                boxShadow: `0 0 15px ${theme.primary}66`,
                objectFit: 'cover'
              }}
              whileHover={{ scale: 1.1 }}
            />
            <TypeAnimation
              sequence={[`Kelvin Muindi`, 1000]}
              wrapper="h5"
              speed={50}
              style={{ color: theme.text, fontSize: '1.2rem', textShadow: `0 0 10px ${theme.primary}50` }}
              repeat={0}
            />
            <small style={{ color: theme.text, textShadow: `0 0 5px ${theme.primary}30` }}>
              {user?.email || 'No email'}
            </small>
          </motion.div>
        ) : (
          <motion.img
            src={logo}
            alt="Company Logo"
            className="rounded-circle"
            style={{
              width: '40px',
              height: '40px',
              border: `2px solid ${theme.primary}`,
              boxShadow: `0 0 10px ${theme.primary}50`,
              objectFit: 'cover'
            }}
            whileHover={{ scale: 1.1 }}
          />
        )}
        <ButtonStyled
          onClick={toggleSidebar}
          isCollapsed={isCollapsed}
          whileHover={{ scale: 1.05, boxShadow: `0 0 15px ${theme.primary}50` }}
          whileTap={{ scale: 0.95 }}
        >
          <i className={`bi ${isCollapsed ? 'bi-arrow-right' : 'bi-arrow-left'}`}></i>
          {!isCollapsed && <span className="ms-2">Collapse</span>}
        </ButtonStyled>
      </motion.div>

      <nav className="nav flex-column py-3">
        <NavLinkStyled to="/dashboard" isCollapsed={isCollapsed}>
          {({ isActive }) => (
            <>
              <motion.div whileHover="hover" variants={iconVariants}>
                <FaTachometerAlt className="me-2" />
              </motion.div>
              {!isCollapsed && 'Dashboard'}
              {isCollapsed && (
                <motion.div
                  className="position-absolute p-2 rounded shadow-lg"
                  style={{ left: '100%', top: '50%', transform: 'translateY(-50%)', zIndex: 1000, background: theme.cardBackground, color: theme.text }}
                  variants={tooltipVariants}
                  initial="hidden"
                  whileHover="visible"
                >
                  Dashboard
                </motion.div>
              )}
            </>
          )}
        </NavLinkStyled>

        <NavLinkStyled to="/projects" isCollapsed={isCollapsed}>
          {({ isActive }) => (
            <>
              <motion.div whileHover="hover" variants={iconVariants}>
                <FaFolder className="me-2" />
              </motion.div>
              {!isCollapsed && 'Projects'}
              {isCollapsed && (
                <motion.div
                  className="position-absolute p-2 rounded shadow-lg"
                  style={{ left: '100%', top: '50%', transform: 'translateY(-50%)', zIndex: 1000, background: theme.cardBackground, color: theme.text }}
                  variants={tooltipVariants}
                  initial="hidden"
                  whileHover="visible"
                >
                  Projects
                </motion.div>
              )}
            </>
          )}
        </NavLinkStyled>

        <NavLinkStyled to="/notifications" isCollapsed={isCollapsed}>
          {({ isActive }) => (
            <>
              <motion.div
                whileHover="hover"
                animate={newCount > 0 ? "pulse" : "initial"}
                variants={iconVariants}
              >
                <FaBell className="me-2" />
              </motion.div>
              {!isCollapsed && (
                <>
                  Notifications
                  {(newCount > 0 || unreadCount > 0) && (
                    <motion.span
                      className="badge ms-2"
                      style={{ background: theme.danger, color: theme.cardBackground }}
                      variants={badgeVariants}
                      initial="initial"
                      animate={newCount > 0 ? "pulse" : "animate"}
                    >
                      {newCount > 0 ? `${newCount} New` : `${unreadCount} Unread`}
                    </motion.span>
                  )}
                  {unreadCount > 0 && (
                    <motion.div
                      className="position-absolute p-3 rounded shadow-lg"
                      style={{ top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, minWidth: '220px', maxHeight: '200px', overflowY: 'auto', background: theme.cardBackground, color: theme.text }}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      whileHover={{ scale: 1.05 }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0">Notifications</h6>
                        <motion.button
                          className="btn btn-sm btn-outline-primary"
                          onClick={clearAllNotifications}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <FaTrash /> Clear All
                        </motion.button>
                      </div>
                      {notificationsPreview.length > 0 ? (
                        notificationsPreview.map(notif => (
                          <div key={notif.id} className="d-flex align-items-start mb-2">
                            <div className="me-2" style={{ width: '5px', height: '5px', background: theme.primary, borderRadius: '50%' }}></div>
                            <small>
                              <strong>{notif.title || 'Untitled'}</strong>: {notif.message?.slice(0, 30) || 'No message'}...
                            </small>
                          </div>
                        ))
                      ) : (
                        <small>No unread notifications</small>
                      )}
                    </motion.div>
                  )}
                </>
              )}
              {isCollapsed && (newCount > 0 || unreadCount > 0) && (
                <motion.span
                  className="badge position-absolute top-0 end-0 mt-1 me-1"
                  style={{ background: theme.danger, color: theme.cardBackground }}
                  variants={badgeVariants}
                  initial="initial"
                  animate={newCount > 0 ? "pulse" : "animate"}
                >
                  {newCount > 0 ? newCount : unreadCount}
                </motion.span>
              )}
            </>
          )}
        </NavLinkStyled>
      </nav>

      <div className="mt-auto">
        {!isCollapsed && (
          <div className="p-3 border-top" style={{ borderColor: `rgba(${theme.text === '#e0e0e0' ? '255, 255, 255' : '0, 0, 0'}, 0.2)` }}>
            <ButtonStyled
              onClick={handleLogout}
              isCollapsed={isCollapsed}
              whileHover={{ scale: 1.05, boxShadow: `0 0 15px ${theme.primary}50` }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div whileHover="hover" variants={iconVariants}>
                <FaSignOutAlt className="me-2" />
              </motion.div>
              {!isCollapsed && 'Logout'}
            </ButtonStyled>
          </div>
        )}
      </div>
    </SidebarContainer>
  );
};

const PrivateLayout = ({ children, theme, toggleTheme }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border" style={{ color: theme.primary }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <AppContainer>
      <style>
        {`
          @keyframes float {
            0% { transform: translateY(0); }
            50% { transform: translateY(-20vh); }
            100% { transform: translateY(0); }
          }
          .particle {
            position: absolute;
            width: 5px;
            height: 5px;
            background: ${theme.primary};
            border-radius: 50%;
            opacity: 0.3;
            animation: float ${Math.random() * 10 + 5}s infinite;
          }
        `}
      </style>
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
        />
      ))}

      <Sidebar user={user} theme={theme} toggleTheme={toggleTheme} />
      <div className="flex-grow-1 d-flex flex-column min-vh-100">
        <MainContent>
          {children}
        </MainContent>
        <Footer>
          <div className="container-fluid text-center">
            <small>
              © {new Date().getFullYear()} Kelvin Muindi. All rights reserved.
            </small>
          </div>
        </Footer>
      </div>
    </AppContainer>
  );
};

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(darkTheme);

  const toggleTheme = () => {
    if (theme === lightTheme) setTheme(darkTheme);
    else if (theme === darkTheme) setTheme(vibrantTheme);
    else setTheme(lightTheme);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  if (!authChecked) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border" style={{ color: theme.primary }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/dashboard" /> : <Login />} 
          />
          <Route 
            path="/register" 
            element={user ? <Navigate to="/login" /> : <Register />} 
          />

          <Route
            path="/"
            element={
              <PrivateLayout theme={theme} toggleTheme={toggleTheme}>
                <Navigate to="/dashboard" replace />
              </PrivateLayout>
            }
          />
          
          <Route
            path="/dashboard"
            element={
              <PrivateLayout theme={theme} toggleTheme={toggleTheme}>
                <Dashboard />
              </PrivateLayout>
            }
          />
          
          <Route
            path="/projects"
            element={
              <PrivateLayout theme={theme} toggleTheme={toggleTheme}>
                <ProjectList />
              </PrivateLayout>
            }
          />
          
          <Route
            path="/projects/new"
            element={
              <PrivateLayout theme={theme} toggleTheme={toggleTheme}>
                <ProjectForm />
              </PrivateLayout>
            }
          />
          
          <Route
            path="/projects/edit/:id"
            element={
              <PrivateLayout theme={theme} toggleTheme={toggleTheme}>
                <ProjectForm />
              </PrivateLayout>
            }
          />
          
          <Route
            path="/notifications"
            element={
              <PrivateLayout theme={theme} toggleTheme={toggleTheme}>
                <NotificationPage />
              </PrivateLayout>
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;