import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'; // <-- Added useNavigate
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import ProjectList from './ProjectList';
import ProjectForm from './ProjectForm';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

// Layout component to wrap authenticated routes
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
      <main className="flex-grow-1 p-3 min-vh-100 bg-light">
        {children}
      </main>
    </div>
  );
};

// Updated Sidebar component to work without AuthContext
const Sidebar = ({ user }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <div className="bg-dark text-white" style={{ width: '250px', minHeight: '100vh' }}>
      <div className="d-flex flex-column h-100">
        {/* Header */}
        <div className="p-3 border-bottom border-secondary">
          <h5 className="mb-0">Project Manager</h5>
          <small className="text-muted">{user?.email}</small>
        </div>

        {/* Navigation Links */}
        <nav className="nav flex-column py-3">
          <a 
            href="/dashboard" 
            className="nav-link text-white"
            onClick={(e) => {
              e.preventDefault();
              navigate('/dashboard');
            }}
          >
            <i className="bi bi-speedometer2 me-2"></i>
            Dashboard
          </a>
          
          <a 
            href="/projects" 
            className="nav-link text-white"
            onClick={(e) => {
              e.preventDefault();
              navigate('/projects');
            }}
          >
            <i className="bi bi-folder me-2"></i>
            Projects
          </a>
        </nav>

        {/* Footer with Logout */}
        <div className="mt-auto p-3 border-top border-secondary">
          <button 
            onClick={handleLogout}
            className="btn btn-outline-light w-100"
          >
            <i className="bi bi-box-arrow-right me-2"></i>
            Logout
          </button>
        </div>
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
        {/* Public Routes */}
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" /> : <Login />} 
        />
        <Route 
          path="/register" 
          element={user ? <Navigate to="/dashboard" /> : <Register />} 
        />

        {/* Private Routes */}
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
      </Routes>
    </Router>
  );
}

export default App;