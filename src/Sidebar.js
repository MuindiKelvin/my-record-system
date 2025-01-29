import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

function Sidebar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
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
          <small className="text-muted">{currentUser?.email}</small>
        </div>

        {/* Navigation Links */}
        <nav className="nav flex-column py-3">
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => 
              `nav-link px-3 ${isActive ? 'active bg-primary' : 'text-white'}`
            }
          >
            <i className="bi bi-speedometer2 me-2"></i>
            Dashboard
          </NavLink>
          
          <NavLink 
            to="/projects" 
            className={({ isActive }) => 
              `nav-link px-3 ${isActive ? 'active bg-primary' : 'text-white'}`
            }
          >
            <i className="bi bi-folder me-2"></i>
            Projects
          </NavLink>
        </nav>

        {/* Footer with Logout */}
        <div className="mt-auto">
          <div className="p-3 border-top border-secondary">
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
    </div>
  );
}

export default Sidebar;