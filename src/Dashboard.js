import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { FaFolder, FaChartPie, FaTasks, FaClock, FaExclamationTriangle, FaFilter, FaMoneyBillWave, FaChartLine } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from 'recharts';

function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalProjects: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    overdue: 0,
    totalAmount: 0,
    totalWords: 0
  });
  const [compareStats, setCompareStats] = useState(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [compareMonth, setCompareMonth] = useState(null);
  const [compareYear, setCompareYear] = useState(null);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'projects'));
      const currentDate = new Date();
      const projectsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setProjects(projectsData);
      updateStats(projectsData, currentDate);
    } catch (err) {
      setError('Error fetching projects: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStats = (projectsData, currentDate) => {
    const filteredProjects = projectsData.filter(project => {
      const projectDate = new Date(project.orderDate);
      return (
        (filterMonth === null || projectDate.getMonth() === filterMonth) &&
        (filterYear === null || projectDate.getFullYear() === filterYear)
      );
    });

    const filteredStats = filteredProjects.reduce((acc, project) => {
      acc.totalProjects += 1;
      acc.totalAmount += Number(project.amount) || 0;
      acc.totalWords += Number(project.words) || 0;
      
      if (project.status === 'completed') acc.completed += 1;
      else if (project.status === 'in-progress') acc.inProgress += 1;
      else if (project.status === 'pending') acc.pending += 1;
      
      const submissionDate = new Date(project.submissionDate);
      if (submissionDate < currentDate && project.status !== 'completed' && project.status !== 'cancelled') {
        acc.overdue += 1;
      }
      
      return acc;
    }, {
      totalProjects: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      overdue: 0,
      totalAmount: 0,
      totalWords: 0
    });

    setStats(filteredStats);

    if (compareMonth !== null && compareYear !== null) {
      const compareProjects = projectsData.filter(project => {
        const projectDate = new Date(project.orderDate);
        return projectDate.getMonth() === compareMonth && projectDate.getFullYear() === compareYear;
      });

      const compareStatsResult = compareProjects.reduce((acc, project) => {
        acc.totalProjects += 1;
        acc.totalAmount += Number(project.amount) || 0;
        acc.totalWords += Number(project.words) || 0;
        
        if (project.status === 'completed') acc.completed += 1;
        else if (project.status === 'in-progress') acc.inProgress += 1;
        else if (project.status === 'pending') acc.pending += 1;
        
        const submissionDate = new Date(project.submissionDate);
        if (submissionDate < currentDate && project.status !== 'completed' && project.status !== 'cancelled') {
          acc.overdue += 1;
        }
        
        return acc;
      }, {
        totalProjects: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        overdue: 0,
        totalAmount: 0,
        totalWords: 0
      });

      setCompareStats(compareStatsResult);
    } else {
      setCompareStats(null);
    }
  };

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      updateStats(projects, new Date());
    }
  }, [filterMonth, filterYear, compareMonth, compareYear, projects]);

  const statusData = [
    { name: 'Completed', value: stats.completed },
    { name: 'In Progress', value: stats.inProgress },
    { name: 'Pending', value: stats.pending },
  ];

  const compareStatusData = compareStats ? [
    { name: 'Completed', value: compareStats.completed },
    { name: 'In Progress', value: compareStats.inProgress },
    { name: 'Pending', value: compareStats.pending },
  ] : null;

  const monthlyTrends = projects.reduce((acc, project) => {
    const date = new Date(project.orderDate);
    const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
    if (!acc[monthYear]) {
      acc[monthYear] = { month: monthYear, amount: 0, count: 0 };
    }
    acc[monthYear].amount += Number(project.amount) || 0;
    acc[monthYear].count += 1;
    return acc;
  }, {});
  const trendData = Object.values(monthlyTrends).slice(-6);

  const compareTrendData = compareMonth !== null && compareYear !== null ? [{
    month: `${months[compareMonth]} ${compareYear}`,
    amount: compareStats ? compareStats.totalAmount : 0,
    count: compareStats ? compareStats.totalProjects : 0
  }] : [];

  const typeTrendData = projects
    .filter(project => {
      const projectDate = new Date(project.orderDate);
      return (
        (filterMonth === null || projectDate.getMonth() === filterMonth) &&
        (filterYear === null || projectDate.getFullYear() === filterYear)
      );
    })
    .reduce((acc, project) => {
      const date = new Date(project.orderDate);
      const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
      const type = project.type || 'Unknown';
      if (!acc[monthYear]) {
        acc[monthYear] = { month: monthYear };
      }
      acc[monthYear][type] = (acc[monthYear][type] || 0) + 1;
      return acc;
    }, {});
  const typeTrendArray = Object.values(typeTrendData).slice(-6);
  const uniqueTypes = [...new Set(projects.map(p => p.type || 'Unknown'))];

  const COLORS = ['#28a745', '#ffc107', '#17a2b8', '#dc3545', '#6c757d', '#007bff'];

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <h1 className="mb-4 d-flex align-items-center">
        <FaChartPie className="me-2" /> Dashboard
      </h1>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <h5><FaFilter className="me-2" /> Filters & Comparison</h5>
          <div className="row">
            <div className="col-md-3">
              <label className="form-label">Filter Month</label>
              <select
                className="form-select"
                value={filterMonth === null ? '' : filterMonth}
                onChange={(e) => setFilterMonth(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">All Months</option>
                {months.map((month, index) => (
                  <option key={index} value={index}>{month}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Filter Year</label>
              <select
                className="form-select"
                value={filterYear === null ? '' : filterYear}
                onChange={(e) => setFilterYear(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">All Years</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Compare Month</label>
              <select
                className="form-select"
                value={compareMonth === null ? '' : compareMonth}
                onChange={(e) => setCompareMonth(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">None</option>
                {months.map((month, index) => (
                  <option key={index} value={index}>{month}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Compare Year</label>
              <select
                className="form-select"
                value={compareYear === null ? '' : compareYear}
                onChange={(e) => setCompareYear(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">None</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mb-4" role="alert">
          {error}
        </div>
      )}

      {/* Key Metrics */}
      <div className="row mb-4">
        <div className="col-md-2 mb-3">
          <div className="card bg-primary text-white">
            <div className="card-body d-flex align-items-center">
              <FaFolder size={36} className="me-3" />
              <div>
                <h5>Total Projects</h5>
                <h2>{stats.totalProjects}</h2>
                {compareStats && <small>vs {compareStats.totalProjects}</small>}
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-2 mb-3">
          <div className="card bg-success text-white">
            <div className="card-body d-flex align-items-center">
              <FaTasks size={36} className="me-3" />
              <div>
                <h5>Completed</h5>
                <h2>{stats.completed}</h2>
                {compareStats && <small>vs {compareStats.completed}</small>}
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-2 mb-3">
          <div className="card bg-warning text-dark">
            <div className="card-body d-flex align-items-center">
              <FaClock size={36} className="me-3" />
              <div>
                <h5>In Progress</h5>
                <h2>{stats.inProgress}</h2>
                {compareStats && <small>vs {compareStats.inProgress}</small>}
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-2 mb-3">
          <div className="card bg-danger text-white">
            <div className="card-body d-flex align-items-center">
              <FaExclamationTriangle size={36} className="me-3" />
              <div>
                <h5>Overdue</h5>
                <h2>{stats.overdue}</h2>
                {compareStats && <small>vs {compareStats.overdue}</small>}
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4 mb-3">
          <div className="card bg-info text-white">
            <div className="card-body d-flex align-items-center">
              <FaMoneyBillWave size={36} className="me-3" />
              <div>
                <h5>Income Generated</h5>
                <h2>Ksh.{stats.totalAmount.toLocaleString()}</h2>
                {compareStats && (
                  <small>vs Ksh.{compareStats.totalAmount.toLocaleString()}</small>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="row">
        <div className="col-md-6 mb-4">
          <div className="card shadow">
            <div className="card-header bg-light">
              <h5><FaChartPie className="me-2" /> Project Status Distribution</h5>
            </div>
            <div className="card-body" style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  {compareStatusData && (
                    <Pie
                      data={compareStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={90}
                      outerRadius={110}
                      fill="#82ca9d"
                      dataKey="value"
                      opacity={0.6}
                      label
                    >
                      {compareStatusData.map((entry, index) => (
                        <Cell key={`compare-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  )}
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="col-md-6 mb-4">
          <div className="card shadow">
            <div className="card-header bg-light">
              <h5><FaTasks className="me-2" /> Income & Project Trends</h5>
            </div>
            <div className="card-body" style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...trendData, ...compareTrendData]}>
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="amount" name="Amount (Ksh)" fill="#8884d8" />
                  <Bar yAxisId="right" dataKey="count" name="Project Count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects and Project Type Trend */}
      <div className="row">
        <div className="col-md-8 mb-4">
          <div className="card shadow">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
              <h5><FaFolder className="me-2" /> Recent Projects</h5>
              <button className="btn btn-outline-primary btn-xs" onClick={() => navigate('/projects')}>
                View All
              </button>
            </div>
            <div className="card-body" style={{ height: '300px', overflowY: 'auto', direction: 'rtl' }}>
              <div style={{ direction: 'ltr' }}>
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Title</th>
                      <th>Ref Code</th>
                      <th>Submission Date</th>
                      <th>Status</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.slice(0, 10).map((project, index) => (
                      <tr
                        key={project.id}
                        onClick={() => navigate(`/projects/edit/${project.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{index + 1}</td>
                        <td>{project.topic}</td>
                        <td>{project.orderRefCode}</td>
                        <td>{new Date(project.submissionDate).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge bg-${project.status === 'completed' ? 'success' : 
                            project.status === 'in-progress' ? 'warning' : 'secondary'}`}>
                            {project.status}
                          </span>
                        </td>
                        <td>Ksh.{Number(project.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-4">
          <div className="card shadow">
            <div className="card-header bg-light">
              <h5><FaChartLine className="me-2" /> Project Type Trend</h5>
            </div>
            <div className="card-body" style={{ height: '300px' }}>
              {typeTrendArray.length === 0 ? (
                <p className="text-muted">No project types in this period</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={typeTrendArray}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {uniqueTypes.map((type, index) => (
                      <Line
                        key={type}
                        type="monotone"
                        dataKey={type}
                        stroke={COLORS[index % COLORS.length]}
                        name={type}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;