import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { collection, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTachometerAlt, FaFolder, FaBell, FaMoon, FaSun, FaSignOutAlt, FaTrash, FaPalette, FaBars, FaTimes } from 'react-icons/fa';
import { TypeAnimation } from 'react-type-animation';
import styled, { ThemeProvider, css } from 'styled-components';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import ProjectList from './ProjectList';
import ProjectForm from './ProjectForm';
import NotificationPage from './NotificationPage';
import logo from './logo/logo.png';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

// Responsive breakpoints
const breakpoints = {
  xs: '0px',
  sm: '576px',
  md: '768px',
  lg: '992px',
  xl: '1200px',
  xxl: '1400px'
};

// Media queries helper
const media = {
  xs: (...args) => css`@media (min-width: ${breakpoints.xs}) { ${css(...args)} }`,
  sm: (...args) => css`@media (min-width: ${breakpoints.sm}) { ${css(...args)} }`,
  md: (...args) => css`@media (min-width: ${breakpoints.md}) { ${css(...args)} }`,
  lg: (...args) => css`@media (min-width: ${breakpoints.lg}) { ${css(...args)} }`,
  xl: (...args) => css`@media (min-width: ${breakpoints.xl}) { ${css(...args)} }`,
  xxl: (...args) => css`@media (min-width: ${breakpoints.xxl}) { ${css(...args)} }`,
  
  maxXs: (...args) => css`@media (max-width: ${breakpoints.sm}) { ${css(...args)} }`,
  maxSm: (...args) => css`@media (max-width: ${breakpoints.md}) { ${css(...args)} }`,
  maxMd: (...args) => css`@media (max-width: ${breakpoints.lg}) { ${css(...args)} }`,
  maxLg: (...args) => css`@media (max-width: ${breakpoints.xl}) { ${css(...args)} }`,
};

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
  overflow-x: hidden;
  
  ${media.maxMd`
    flex-direction: column;
  `}
`;

const MainContent = styled.main`
  flex-grow: 1;
  padding: 1rem;
  background: ${props => props.theme.background};
  color: ${props => props.theme.text};
  min-height: 100vh;
  
  ${media.sm`
    padding: 1.5rem;
  `}
  
  ${media.md`
    padding: 2rem;
  `}
  
  ${media.lg`
    padding: 3rem;
  `}
  
  ${media.maxMd`
    margin-top: ${props => props.isMobileMenuOpen ? '0' : '70px'};
    transition: margin-top 0.3s ease;
  `}
`;

const Footer = styled.footer`
  padding: 1rem 0;
  background: ${props => props.theme.cardBackground};
  color: ${props => props.theme.text};
  border-top: 1px solid ${props => props.theme.secondary}33;
  text-align: center;
  
  ${media.maxMd`
    position: relative;
    z-index: 10;
  `}
`;

const SidebarContainer = styled.div`
  width: ${props => (props.isCollapsed ? '80px' : '280px')};
  min-height: 100vh;
  transition: all 0.3s ease;
  color: ${props => props.theme.text};
  position: relative;
  overflow: hidden;
  background: ${props => props.theme.gradient};
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1000;
  
  ${media.maxMd`
    position: fixed;
    top: 0;
    left: ${props => props.isMobileMenuOpen ? '0' : '-100%'};
    width: 280px;
    z-index: 1050;
    box-shadow: ${props => props.isMobileMenuOpen ? '2px 0 10px rgba(0,0,0,0.3)' : 'none'};
    transition: left 0.3s ease;
  `}
  
  ${media.sm`
    width: ${props => props.isCollapsed ? '80px' : '300px'};
  `}
`;

// Mobile header for navigation
const MobileHeader = styled.div`
  display: none;
  
  ${media.maxMd`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: ${props => props.theme.cardBackground};
    color: ${props => props.theme.text};
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1040;
    box-shadow: ${props => props.theme.shadow};
    height: 70px;
  `}
`;

const MobileMenuButton = styled(motion.button)`
  background: ${props => props.theme.primary};
  color: ${props => props.theme.cardBackground};
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const MobileOverlay = styled.div`
  display: none;
  
  ${media.maxMd`
    display: ${props => props.isOpen ? 'block' : 'none'};
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1049;
  `}
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
  text-decoration: none;
  
  &:hover {
    background: ${props => `${props.theme.primary}22`};
    color: ${props => props.theme.text};
    text-decoration: none;
  }
  
  ${media.maxSm`
    padding: 12px 15px;
    margin: 8px 10px;
    font-size: 1.1rem;
  `}
`;

const ButtonStyled = styled(motion.button)`
  background: ${props => props.theme.primary};
  color: ${props => props.theme.cardBackground};
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: ${props => (props.isCollapsed ? 'center' : 'flex-start')};
  margin: 5px 0;
  transition: all 0.3s ease;
  cursor: pointer;
  
  ${media.maxSm`
    padding: 10px 12px;
    font-size: 1rem;
  `}
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
  
  ${media.maxMd`
    position: relative;
    top: auto;
    right: auto;
    margin-left: auto;
  `}
  
  ${media.maxSm`
    width: 45px;
    height: 45px;
    font-size: 1.2rem;
  `}
`;

const ProfileSection = styled(motion.div)`
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  ${media.maxSm`
    padding: 1.5rem 1rem;
  `}
`;

const ProfileImage = styled(motion.img)`
  width: 60px;
  height: 60px;
  border: 2px solid ${props => props.theme.primary};
  box-shadow: 0 0 15px ${props => props.theme.primary}66;
  object-fit: cover;
  
  ${media.maxSm`
    width: 70px;
    height: 70px;
  `}
`;

const ProfileName = styled.h5`
  color: ${props => props.theme.text};
  font-size: 1.2rem;
  text-shadow: 0 0 10px ${props => props.theme.primary}50;
  margin: 0.5rem 0;
  
  ${media.maxSm`
    font-size: 1.4rem;
  `}
`;

const ProfileEmail = styled.small`
  color: ${props => props.theme.text};
  text-shadow: 0 0 5px ${props => props.theme.primary}30;
  display: block;
  word-break: break-all;
  
  ${media.maxSm`
    font-size: 0.9rem;
  `}
`;

const NotificationToast = styled(motion.div)`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1050;
  min-width: 200px;
  max-width: 90vw;
  
  ${media.maxSm`
    top: 80px;
    min-width: 280px;
  `}
  
  .toast {
    background: ${props => props.theme.cardBackground};
    color: ${props => props.theme.text};
    border: 1px solid ${props => props.theme.danger};
    box-shadow: ${props => props.theme.shadow};
  }
`;

const NotificationPreview = styled(motion.div)`
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  min-width: 220px;
  max-width: 300px;
  max-height: 200px;
  overflow-y: auto;
  background: ${props => props.theme.cardBackground};
  color: ${props => props.theme.text};
  padding: 1rem;
  border-radius: 8px;
  box-shadow: ${props => props.theme.shadow};
  
  ${media.maxMd`
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: 90vw;
    max-height: 60vh;
  `}
`;

const Sidebar = ({ user, theme, toggleTheme, isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isProfileHovered, setIsProfileHovered] = useState(false);
  const [notificationsPreview, setNotificationsPreview] = useState([]);
  const [newNotificationToast, setNewNotificationToast] = useState(null);
  const [showNotificationPreview, setShowNotificationPreview] = useState(false);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
      setIsMobileMenuOpen(false);
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };

  const handleNavClick = () => {
    // Close mobile menu when navigation item is clicked
    if (window.innerWidth < 768) {
      setIsMobileMenuOpen(false);
    }
  };

  // Fetch new and unread notifications count and preview
  const fetchNotificationsData = () => {
    try {
      const unsubscribe = onSnapshot(collection(db, 'notifications'), async (snapshot) => {
        const notificationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

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
      setShowNotificationPreview(false);
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
    <>
      <SidebarContainer isCollapsed={isCollapsed} isMobileMenuOpen={isMobileMenuOpen}>
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
            <NotificationToast
              variants={toastVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              theme={theme}
            >
              <div className="toast show">
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
            </NotificationToast>
          )}
        </AnimatePresence>

        <ProfileSection
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
              <ProfileImage
                src={logo}
                alt="Company Logo"
                className="rounded-circle mb-2"
                theme={theme}
                whileHover={{ scale: 1.1 }}
              />
              <TypeAnimation
                sequence={[`Kelvin Muindi`, 1000]}
                wrapper="div"
                speed={50}
                repeat={0}
              >
                {(displayText) => <ProfileName theme={theme}>{displayText}</ProfileName>}
              </TypeAnimation>
              <ProfileEmail theme={theme}>
                {user?.email || 'No email'}
              </ProfileEmail>
            </motion.div>
          ) : (
            <ProfileImage
              src={logo}
              alt="Company Logo"
              className="rounded-circle"
              theme={theme}
              whileHover={{ scale: 1.1 }}
              style={{ width: '40px', height: '40px' }}
            />
          )}
          <ButtonStyled
            onClick={toggleSidebar}
            isCollapsed={isCollapsed}
            whileHover={{ scale: 1.05, boxShadow: `0 0 15px ${theme.primary}50` }}
            whileTap={{ scale: 0.95 }}
            style={{ display: window.innerWidth >= 768 ? 'flex' : 'none' }}
          >
            <i className={`bi ${isCollapsed ? 'bi-arrow-right' : 'bi-arrow-left'}`}></i>
            {!isCollapsed && <span className="ms-2">Collapse</span>}
          </ButtonStyled>
        </ProfileSection>

        <nav className="nav flex-column py-3">
          <NavLinkStyled 
            to="/dashboard" 
            isCollapsed={isCollapsed}
            onClick={handleNavClick}
          >
            {({ isActive }) => (
              <>
                <motion.div whileHover="hover" variants={iconVariants}>
                  <FaTachometerAlt className="me-2" />
                </motion.div>
                {!isCollapsed && 'Dashboard'}
                {isCollapsed && window.innerWidth >= 768 && (
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

          <NavLinkStyled 
            to="/projects" 
            isCollapsed={isCollapsed}
            onClick={handleNavClick}
          >
            {({ isActive }) => (
              <>
                <motion.div whileHover="hover" variants={iconVariants}>
                  <FaFolder className="me-2" />
                </motion.div>
                {!isCollapsed && 'Projects'}
                {isCollapsed && window.innerWidth >= 768 && (
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

          <NavLinkStyled 
            to="/notifications" 
            isCollapsed={isCollapsed}
            onClick={handleNavClick}
            onMouseEnter={() => setShowNotificationPreview(true)}
            onMouseLeave={() => setShowNotificationPreview(false)}
          >
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
                    {unreadCount > 0 && showNotificationPreview && (
                      <NotificationPreview
                        theme={theme}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        whileHover={{ scale: 1.02 }}
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
                              <div className="me-2" style={{ width: '5px', height: '5px', background: theme.primary, borderRadius: '50%', marginTop: '8px' }}></div>
                              <small>
                                <strong>{notif.title || 'Untitled'}</strong>: {notif.message?.slice(0, 30) || 'No message'}...
                              </small>
                            </div>
                          ))
                        ) : (
                          <small>No unread notifications</small>
                        )}
                      </NotificationPreview>
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
        </div>
      </SidebarContainer>

      <MobileOverlay 
        isOpen={isMobileMenuOpen} 
        onClick={() => setIsMobileMenuOpen(false)} 
      />
    </>
  );
};

const PrivateLayout = ({ children, theme, toggleTheme }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Close mobile menu when screen size changes to desktop
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100" style={{ background: theme.background }}>
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
    <>
      <MobileHeader theme={theme}>
        <div className="d-flex align-items-center">
          <img
            src={logo}
            alt="Company Logo"
            className="rounded-circle me-2"
            style={{
              width: '40px',
              height: '40px',
              border: `2px solid ${theme.primary}`,
              objectFit: 'cover'
            }}
          />
          <div>
            <h6 className="mb-0" style={{ color: theme.text }}>Kelvin Muindi</h6>
            <small style={{ color: theme.secondary }}>{user?.email}</small>
          </div>
        </div>
        
        <div className="d-flex align-items-center gap-2">
          <ThemeToggle
            onClick={toggleTheme}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{ position: 'relative', top: 'auto', right: 'auto' }}
          >
            {theme === lightTheme ? <FaSun /> : theme === darkTheme ? <FaMoon /> : <FaPalette />}
          </ThemeToggle>
          
          <MobileMenuButton
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
          </MobileMenuButton>
        </div>
      </MobileHeader>

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
            
            /* Custom scrollbar styles */
            ::-webkit-scrollbar {
              width: 8px;
              height: 8px;
            }
            ::-webkit-scrollbar-track {
              background: ${theme.background};
            }
            ::-webkit-scrollbar-thumb {
              background: ${theme.primary};
              border-radius: 10px;
            }
            ::-webkit-scrollbar-thumb:hover {
              background: ${theme.secondary};
            }
            
            /* Responsive text sizes */
            @media (max-width: 576px) {
              body {
                font-size: 14px;
              }
              h1 { font-size: 1.8rem; }
              h2 { font-size: 1.6rem; }
              h3 { font-size: 1.4rem; }
              h4 { font-size: 1.2rem; }
              h5 { font-size: 1.1rem; }
              h6 { font-size: 1rem; }
            }
            
            /* Touch-friendly interactive elements */
            @media (max-width: 768px) {
              button, .btn, a {
                min-height: 44px;
                min-width: 44px;
              }
            }
          `}
        </style>
        
        {/* Background particles - fewer on mobile for performance */}
        {Array.from({ length: window.innerWidth < 768 ? 10 : 20 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}

        <Sidebar 
          user={user} 
          theme={theme} 
          toggleTheme={toggleTheme}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        
        <div className="flex-grow-1 d-flex flex-column min-vh-100">
          <MainContent isMobileMenuOpen={isMobileMenuOpen}>
            {children}
          </MainContent>
          <Footer theme={theme}>
            <div className="container-fluid text-center">
              <small>
                © {new Date().getFullYear()} Kelvin Muindi. All rights reserved.
              </small>
            </div>
          </Footer>
        </div>
      </AppContainer>
    </>
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

  // Add global styles for responsive design
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box;
      }
      
      body {
        margin: 0;
        padding: 0;
        overflow-x: hidden;
      }
      
      /* Ensure images are responsive */
      img {
        max-width: 100%;
        height: auto;
      }
      
      /* Responsive tables */
      .table-responsive {
        overflow-x: auto;
      }
      
      /* Better button spacing on mobile */
      @media (max-width: 576px) {
        .btn {
          margin-bottom: 0.5rem;
        }
        
        .btn-group .btn {
          margin-bottom: 0;
        }
      }
      
      /* Responsive form controls */
      @media (max-width: 576px) {
        .form-control, .form-select {
          font-size: 16px; /* Prevents zoom on iOS */
        }
      }
      
      /* Improve touch targets */
      @media (max-width: 768px) {
        .nav-link {
          padding: 0.75rem 1rem;
        }
        
        .list-group-item {
          padding: 1rem;
        }
      }
      
      /* Responsive modals */
      @media (max-width: 576px) {
        .modal-dialog {
          margin: 0.5rem;
          max-width: calc(100% - 1rem);
        }
      }
      
      /* Hide scrollbar but keep functionality */
      .hide-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      .hide-scrollbar::-webkit-scrollbar {
        display: none;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (!authChecked) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100" style={{ background: theme.background }}>
        <div className="text-center">
          <div className="spinner-border mb-3" style={{ color: theme.primary }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p style={{ color: theme.text }}>Loading your experience...</p>
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