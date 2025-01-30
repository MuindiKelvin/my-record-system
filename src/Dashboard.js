import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Activity, CheckCircle, Clock, AlertCircle, Banknote,  XCircle } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');

  // Fetch projects from Firebase
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const projectsCollection = collection(db, 'projects');
        const projectSnapshot = await getDocs(projectsCollection);
        const projectList = projectSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProjects(projectList);
        setFilteredProjects(projectList);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError('Failed to load projects');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Filter projects when year or month changes
  useEffect(() => {
    let filtered = [...projects];

    if (selectedYear !== 'all') {
      filtered = filtered.filter(project => {
        const date = new Date(project.orderDate);
        return date.getFullYear().toString() === selectedYear;
      });
    }

    if (selectedMonth !== 'all') {
      filtered = filtered.filter(project => {
        const date = new Date(project.orderDate);
        return date.getMonth().toString() === selectedMonth;
      });
    }

    setFilteredProjects(filtered);
  }, [selectedYear, selectedMonth, projects]);

  // Get unique years from projects
  const getYears = () => {
    const years = new Set(projects.map(project => new Date(project.orderDate).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  };

  // Calculate statistics
  const getProjectStats = () => {
    const stats = {
      total: filteredProjects.length,
      completed: 0,
      pending: 0,
      inProgress: 0,
      cancelled: 0,
      totalRevenue: 0,
    };

    filteredProjects.forEach(project => {
      // Status counts
      switch (project.status) {
        case 'completed':
          stats.completed++;
          break;
        case 'pending':
          stats.pending++;
          break;
        case 'in-progress':
          stats.inProgress++;
          break;
        case 'cancelled':
          stats.cancelled++;
          break;
        default:
          break;
      }

      // Revenue calculation
      stats.totalRevenue += parseFloat(project.amount || 0);
    });

    return stats;
  };

  // Prepare monthly data for graphs
  const prepareMonthlyData = () => {
    const monthlyData = {};
    
    filteredProjects.forEach(project => {
      const date = new Date(project.orderDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          total: 0,
          completed: 0,
          pending: 0,
          inProgress: 0,
          cancelled: 0,
          revenue: 0
        };
      }
      
      monthlyData[monthKey].total++;
      monthlyData[monthKey][project.status === 'in-progress' ? 'inProgress' : project.status]++;
      monthlyData[monthKey].revenue += parseFloat(project.amount || 0);
    });

    return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
  };

  const stats = getProjectStats();
  const monthlyData = prepareMonthlyData();

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger m-4" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      {/* Filter Controls */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Year</label>
              <select 
                className="form-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="all">All Years</option>
                {getYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Month</label>
              <select 
                className="form-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">All Months</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i} value={i}>
                    {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-lg">
          <div className="card h-100 shadow-sm">
            <div className="card-body d-flex align-items-center">
              <Activity size={32} className="text-primary me-3" />
              <div>
                <h6 className="card-subtitle mb-1 text-muted">Total Projects</h6>
                <h2 className="card-title mb-0">{stats.total}</h2>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg">
          <div className="card h-100 shadow-sm">
            <div className="card-body d-flex align-items-center">
              <Banknote size={32} className="text-success me-3" />
              <div>
                <h6 className="card-subtitle mb-1 text-muted">Total Revenue</h6>
                <h2 className="card-title mb-0">Ksh.{stats.totalRevenue.toLocaleString()}</h2>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg">
          <div className="card h-100 shadow-sm">
            <div className="card-body d-flex align-items-center">
              <CheckCircle size={32} className="text-success me-3" />
              <div>
                <h6 className="card-subtitle mb-1 text-muted">Completed</h6>
                <h2 className="card-title mb-0">{stats.completed}</h2>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg">
          <div className="card h-100 shadow-sm">
            <div className="card-body d-flex align-items-center">
              <Clock size={32} className="text-warning me-3" />
              <div>
                <h6 className="card-subtitle mb-1 text-muted">Pending</h6>
                <h2 className="card-title mb-0">{stats.pending}</h2>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg">
          <div className="card h-100 shadow-sm">
            <div className="card-body d-flex align-items-center">
              <AlertCircle size={32} className="text-info me-3" />
              <div>
                <h6 className="card-subtitle mb-1 text-muted">In Progress</h6>
                <h2 className="card-title mb-0">{stats.inProgress}</h2>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg">
          <div className="card h-100 shadow-sm">
            <div className="card-body d-flex align-items-center">
              <XCircle size={32} className="text-danger me-3" />
              <div>
                <h6 className="card-subtitle mb-1 text-muted">Cancelled</h6>
                <h2 className="card-title mb-0">{stats.cancelled}</h2>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project Status Trends */}
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-white">
          <h5 className="card-title mb-0">Project Status Trends</h5>
        </div>
        <div className="card-body">
          <div style={{ height: '400px', width: '100%' }}>
            <ResponsiveContainer>
              <LineChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#0d6efd" name="Total Projects" />
                <Line type="monotone" dataKey="completed" stroke="#198754" name="Completed" />
                <Line type="monotone" dataKey="pending" stroke="#ffc107" name="Pending" />
                <Line type="monotone" dataKey="inProgress" stroke="#0dcaf0" name="In Progress" />
                <Line type="monotone" dataKey="cancelled" stroke="#dc3545" name="Cancelled" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      <div className="card shadow-sm">
        <div className="card-header bg-white">
          <h5 className="card-title mb-0">Monthly Revenue</h5>
        </div>
        <div className="card-body">
          <div style={{ height: '400px', width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `Ksh.${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" fill="#198754" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;