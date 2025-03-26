import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import ProjectList from './ProjectList';
import ProjectForm from './ProjectForm';
import NotificationPage from './NotificationPage';
import logo from './logo/logo.png';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const Sidebar = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [gradientStyle, setGradientStyle] = useState({});
  const [isProfileFlipped, setIsProfileFlipped] = useState(false);
  const [notificationsPreview, setNotificationsPreview] = useState([]);

  // Dynamic gradient based on time of day
  const updateGradient = () => {
    const hour = new Date().getHours();
    let gradient;
    if (hour < 6) gradient = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'; // Night
    else if (hour < 12) gradient = 'linear-gradient(135deg, #ff9e2c 0%, #ff6b6b 100%)'; // Morning
    else if (hour < 18) gradient = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'; // Afternoon
    else gradient = 'linear-gradient(135deg, #8a2387 0%, #e94057 100%)'; // Evening
    setGradientStyle({ background: gradient });
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.body.classList.toggle('dark-mode');
  };

  // Fetch new notifications count and preview
  const fetchNotificationsData = () => {
    try {
      const unsubscribe = onSnapshot(collection(db, 'notifications'), async (snapshot) => {
        const notificationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const newNotifications = notificationsData.filter(notif => !notif.isRead && !notif.isViewed);
        setNewCount(newNotifications.length);
        setNotificationsPreview(newNotifications.slice(0, 3)); // Show up to 3 in preview

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
    }
  };

  useEffect(() => {
    updateGradient();
    const gradientInterval = setInterval(updateGradient, 60 * 60 * 1000); // Update hourly
    const unsubscribe = fetchNotificationsData();
    return () => {
      clearInterval(gradientInterval);
      if (unsubscribe) unsubscribe();
    };
  }, [location.pathname]);

  const sidebarStyle = {
    width: isCollapsed ? '80px' : '250px',
    minHeight: '100vh',
    transition: 'width 0.3s ease',
    color: '#ffffff',
    position: 'relative',
    overflow: 'hidden',
    ...gradientStyle,
  };

  const navLinkStyle = ({ isActive }) => `
    nav-link px-3 py-2 mb-1 rounded position-relative
    ${isActive ? 'active bg-gradient-primary shadow-glow' : 'bg-transparent'}
    text-white
    ${isCollapsed ? 'text-center' : ''}
    d-flex align-items-center
  `;

  const iconVariants = {
    hover: { scale: 1.2, rotate: 10, transition: { duration: 0.2 } },
    initial: { scale: 1, rotate: 0 }
  };

  const glowEffect = {
    boxShadow: '0 0 10px rgba(255, 255, 255, 0.5), 0 0 20px rgba(255, 255, 255, 0.3)'
  };

  return (
    <div className="shadow" style={sidebarStyle}>
      <div className="d-flex flex-column h-100">
        <motion.div
          className="p-3 border-bottom"
          style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}
          onClick={() => !isCollapsed && setIsProfileFlipped(!isProfileFlipped)}
        >
          {!isCollapsed && (
            <motion.div
              animate={{ rotateY: isProfileFlipped ? 180 : 0 }}
              transition={{ duration: 0.5 }}
              style={{ perspective: '1000px' }}
            >
              {!isProfileFlipped ? (
                <div className="text-center">
                  <motion.img
                    src={logo}
                    alt="Company Logo"
                    className="rounded-circle mb-2"
                    style={{ width: '60px', height: '60px', border: '2px solid white', objectFit: 'cover' }}
                    whileHover={{ scale: 1.1 }}
                  />
                  <h5 className="mb-1">Project Manager</h5>
                  <small className="text-light">{user?.email}</small>
                </div>
              ) : (
                <div className="text-center text-light" style={{ transform: 'rotateY(180deg)' }}>
                  <p className="mb-1">Active Projects: 42</p>
                  <p className="mb-1">Pending Tasks: 15</p>
                  <p>Completed: 87%</p>
                </div>
              )}
            </motion.div>
          )}
          <motion.button
            onClick={toggleSidebar}
            className="btn btn-outline-light mt-2 w-100"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <i className={`bi ${isCollapsed ? 'bi-arrow-right' : 'bi-arrow-left'}`}></i>
          </motion.button>
        </motion.div>

        <nav className="nav flex-column py-3">
          <NavLink to="/dashboard" className={navLinkStyle}>
            <motion.i
              className="bi bi-speedometer2 me-2"
              variants={iconVariants}
              whileHover="hover"
            />
            {!isCollapsed && 'Dashboard'}
          </NavLink>

          <NavLink to="/projects" className={navLinkStyle}>
            <motion.i
              className="bi bi-folder me-2"
              variants={iconVariants}
              whileHover="hover"
            />
            {!isCollapsed && 'Projects'}
          </NavLink>

          <NavLink to="/notifications" className={navLinkStyle}>
            <motion.i
              className="bi bi-bell me-2"
              variants={iconVariants}
              whileHover="hover"
            />
            {!isCollapsed && (
              <>
                Notifications
                {newCount > 0 && (
                  <motion.span
                    className="badge bg-danger ms-2"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    {newCount} New
                  </motion.span>
                )}
                {newCount > 0 && (
                  <motion.div
                    className="position-absolute bg-dark text-white p-2 rounded shadow-lg"
                    style={{ top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, minWidth: '200px' }}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <h6 className="mb-1">New Notifications</h6>
                    {notificationsPreview.map(notif => (
                      <small key={notif.id} className="d-block mb-1">
                        {notif.title.slice(0, 20)}...
                      </small>
                    ))}
                  </motion.div>
                )}
              </>
            )}
            {isCollapsed && newCount > 0 && (
              <motion.span
                className="badge bg-danger position-absolute top-0 end-0 mt-1 me-1"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                {newCount}
              </motion.span>
            )}
          </NavLink>
        </nav>

        <div className="mt-auto">
          {!isCollapsed && (
            <div className="p-3 border-top" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
              <motion.button
                onClick={toggleDarkMode}
                className="btn btn-outline-light w-100 mb-3"
                whileHover={{ scale: 1.05, boxShadow: '0 0 10px rgba(255, 255, 255, 0.5), 0 0 20px rgba(255, 255, 255, 0.3)' }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.i
                  className={`bi ${isDarkMode ? 'bi-moon' : 'bi-sun'} me-2`}
                  variants={iconVariants}
                  whileHover="hover"
                />
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </motion.button>
              <motion.button
                onClick={handleLogout}
                className="btn btn-outline-light w-100"
                whileHover={{ scale: 1.05, boxShadow: '0 0 10px rgba(255, 255, 255, 0.5), 0 0 20px rgba(255, 255, 255, 0.3)' }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.i
                  className="bi bi-box-arrow-right me-2"
                  variants={iconVariants}
                  whileHover="hover"
                />
                Logout
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PrivateLayout = ({ children }) => {
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
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="d-flex">
      <Sidebar user={user} />
      <div className="flex-grow-1 d-flex flex-column min-vh-100">
        <main className="flex-grow-1 p-3 bg-light">
          {children}
        </main>
        <footer className="py-3 bg-light border-top">
          <div className="container-fluid text-center">
            <small className="text-muted">
              © {new Date().getFullYear()} Kelvin Muindi. All rights reserved.
            </small>
          </div>
        </footer>
      </div>
    </div>
  );
};

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

  if (!authChecked) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" /> : <Login />} 
        />
        <Route 
          path="/register" 
          element={user ? <Navigate to="/dashboard" /> : <Register />} 
        />

        <Route
          path="/"
          element={
            <PrivateLayout>
              <Navigate to="/dashboard" replace />
            </PrivateLayout>
          }
        />
        
        <Route
          path="/dashboard"
          element={
            <PrivateLayout>
              <Dashboard />
            </PrivateLayout>
          }
        />
        
        <Route
          path="/projects"
          element={
            <PrivateLayout>
              <ProjectList />
            </PrivateLayout>
          }
        />
        
        <Route
          path="/projects/new"
          element={
            <PrivateLayout>
              <ProjectForm />
            </PrivateLayout>
          }
        />
        
        <Route
          path="/projects/edit/:id"
          element={
            <PrivateLayout>
              <ProjectForm />
            </PrivateLayout>
          }
        />
        
        <Route
          path="/notifications"
          element={
            <PrivateLayout>
              <NotificationPage />
            </PrivateLayout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;