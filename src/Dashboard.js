import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { Activity, CheckCircle, Clock, AlertCircle, Banknote, XCircle, TrendingUp, Award, Calendar, RefreshCw, Filter, ChevronDown, Search, Download } from 'lucide-react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { CSVLink } from 'react-csv';

const Dashboard = () => {
  // State management
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    year: 'all',
    month: 'all',
    status: 'all',
    orderRefCode: 'all', // Changed from 'client' to 'orderRefCode'
    minAmount: '',
    maxAmount: '',
  });
  const [viewMode, setViewMode] = useState('default');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('yearly');
  const [selectedTheme, setSelectedTheme] = useState('light');
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Color schemes
  const themes = {
    light: {
      background: '#ffffff',
      cardBg: '#ffffff',
      text: '#333333',
      border: '#e0e0e0',
      colors: ['#0d6efd', '#198754', '#ffc107', '#0dcaf0', '#dc3545', '#6f42c1'],
    },
    dark: {
      background: '#121212',
      cardBg: '#1e1e1e',
      text: '#e0e0e0',
      border: '#333333',
      colors: ['#4dabf7', '#69db7c', '#ffd43b', '#4dd4fa', '#ff6b6b', '#cc5de8'],
    },
    pastel: {
      background: '#f8f9fa',
      cardBg: '#ffffff',
      text: '#495057',
      border: '#dee2e6',
      colors: ['#8ab4f8', '#8cd19e', '#ffe066', '#99e9f2', '#ffa8a8', '#d0bfff'],
    }
  };

  const currentTheme = themes[selectedTheme];

  // Configure auto-refresh
  useEffect(() => {
    if (refreshInterval) {
      const interval = setInterval(fetchProjects, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  // Fetch projects from Firebase
  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const projectsCollection = collection(db, 'projects');
      let projectQuery = query(projectsCollection, orderBy('orderDate', 'desc'));

      if (filters.status !== 'all') projectQuery = query(projectQuery, where('status', '==', filters.status));
      if (filters.orderRefCode !== 'all') projectQuery = query(projectQuery, where('orderRefCode', '==', filters.orderRefCode)); // Changed from 'client' to 'orderRefCode'

      const projectSnapshot = await getDocs(projectQuery);
      const projectList = projectSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderDate: doc.data().orderDate ? new Date(doc.data().orderDate).toISOString() : new Date().toISOString(),
        amount: parseFloat(doc.data().amount || 0),
        status: doc.data().status || 'pending',
        orderRefCode: doc.data().orderRefCode || 'Unknown', // Changed from 'client' to 'orderRefCode'
        cost: parseFloat(doc.data().cost || 0),
        name: doc.data().name || 'Unnamed Project',
        orderType: doc.data().orderType || 'Unknown'
      }));

      setProjects(projectList);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [filters.status, filters.orderRefCode]); // Updated dependency from 'client' to 'orderRefCode'

  // Apply filters
  useEffect(() => {
    let filtered = [...projects];

    if (filters.year !== 'all') {
      filtered = filtered.filter(project => new Date(project.orderDate).getFullYear().toString() === filters.year);
    }
    if (filters.month !== 'all') {
      filtered = filtered.filter(project => new Date(project.orderDate).getMonth().toString() === filters.month);
    }
    if (filters.minAmount) {
      filtered = filtered.filter(project => project.amount >= parseFloat(filters.minAmount));
    }
    if (filters.maxAmount) {
      filtered = filtered.filter(project => project.amount <= parseFloat(filters.maxAmount));
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(project => 
        (project.name?.toLowerCase().includes(term) || 
         project.orderRefCode?.toLowerCase().includes(term) || // Changed from 'client' to 'orderRefCode'
         project.description?.toLowerCase().includes(term))
      );
    }

    setFilteredProjects(filtered);
  }, [projects, filters, searchTerm]);

  // Helper functions
  const getYears = () => Array.from(new Set(projects.map(p => new Date(p.orderDate).getFullYear()))).sort((a, b) => b - a);
  const getOrderRefCodes = () => Array.from(new Set(projects.map(p => p.orderRefCode).filter(Boolean))).sort(); // Changed from 'getClients' to 'getOrderRefCodes'

  // Calculate statistics
  const getProjectStats = () => {
    const stats = {
      total: filteredProjects.length,
      completed: 0,
      pending: 0,
      inProgress: 0,
      cancelled: 0,
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      averageProjectValue: 0,
      completionRate: 0,
      growthRate: 0,
      revenueGrowthRate: 0,
    };

    filteredProjects.forEach(project => {
      switch (project.status) {
        case 'completed': stats.completed++; break;
        case 'pending': stats.pending++; break;
        case 'in-progress': stats.inProgress++; break;
        case 'cancelled': stats.cancelled++; break;
      }
      stats.totalRevenue += project.amount;
      stats.totalCost += project.cost;
      stats.totalProfit += (project.amount - project.cost);
    });

    stats.averageProjectValue = stats.total ? stats.totalRevenue / stats.total : 0;
    stats.completionRate = stats.total ? (stats.completed / stats.total) * 100 : 0;

    if (filteredProjects.length > 1) {
      const sorted = [...filteredProjects].sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));
      const midpoint = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, midpoint);
      const secondHalf = sorted.slice(midpoint);

      const firstCount = firstHalf.length;
      const secondCount = secondHalf.length;
      stats.growthRate = firstCount ? ((secondCount - firstCount) / firstCount * 100) : 0;

      const firstRevenue = firstHalf.reduce((sum, p) => sum + p.amount, 0);
      const secondRevenue = secondHalf.reduce((sum, p) => sum + p.amount, 0);
      stats.revenueGrowthRate = firstRevenue ? ((secondRevenue - firstRevenue) / firstRevenue * 100) : 0;
    }

    return stats;
  };

  // Chart data preparation
  const prepareMonthlyData = () => {
    const timeData = {};
    const getGroupKey = (date) => {
      if (dateRange === 'yearly') return date.getFullYear().toString();
      if (dateRange === 'monthly') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const start = new Date(date.getFullYear(), 0, 1);
      const days = Math.floor((date - start) / (24 * 60 * 60 * 1000));
      const week = Math.ceil(days / 7);
      return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
    };

    filteredProjects.forEach(project => {
      const date = new Date(project.orderDate);
      const key = getGroupKey(date);
      if (!timeData[key]) {
        timeData[key] = { period: key, revenue: 0, profit: 0, projects: 0 };
      }
      timeData[key].revenue += project.amount;
      timeData[key].profit += (project.amount - project.cost);
      timeData[key].projects++;
    });

    return Object.values(timeData).sort((a, b) => a.period.localeCompare(b.period));
  };

  const prepareStatusDistribution = () => {
    const stats = getProjectStats();
    return [
      { name: 'Completed', value: stats.completed, color: currentTheme.colors[1] },
      { name: 'Pending', value: stats.pending, color: currentTheme.colors[2] },
      { name: 'In Progress', value: stats.inProgress, color: currentTheme.colors[3] },
      { name: 'Cancelled', value: stats.cancelled, color: currentTheme.colors[4] }
    ].filter(item => item.value > 0);
  };

  const prepareOrderTypeDistribution = () => {
    const orderTypeCount = {};
    filteredProjects.forEach(project => {
      const type = project.orderType || 'Unknown';
      orderTypeCount[type] = (orderTypeCount[type] || 0) + 1;
    });

    return Object.entries(orderTypeCount)
      .map(([name, value], index) => ({
        name,
        value,
        color: currentTheme.colors[index % currentTheme.colors.length]
      }))
      .filter(item => item.value > 0);
  };

  const preparePerformanceData = () => filteredProjects.map(p => ({
    name: p.name,
    value: p.amount,
    size: p.amount / 5000,
    orderRefCode: p.orderRefCode, // Changed from 'client' to 'orderRefCode'
    status: p.status
  }));

  const stats = useMemo(() => getProjectStats(), [filteredProjects]);
  const monthlyData = useMemo(() => prepareMonthlyData(), [filteredProjects, dateRange]);
  const statusDistribution = useMemo(() => prepareStatusDistribution(), [stats]);
  const orderTypeDistribution = useMemo(() => prepareOrderTypeDistribution(), [filteredProjects]);
  const performanceData = useMemo(() => preparePerformanceData(), [filteredProjects]);

  const exportData = useMemo(() => filteredProjects.map(p => ({
    Name: p.name,
    OrderRefCode: p.orderRefCode, // Changed from 'Client' to 'OrderRefCode'
    Status: p.status,
    OrderType: p.orderType || 'Unknown',
    Amount: p.amount,
    Cost: p.cost,
    Profit: p.amount - p.cost,
    OrderDate: new Date(p.orderDate).toLocaleDateString()
  })), [filteredProjects]);

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 rounded shadow" style={{ background: currentTheme.cardBg, color: currentTheme.text }}>
          <p className="fw-bold">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.name.toLowerCase().includes('revenue') || entry.name.toLowerCase().includes('profit') 
                ? `Ksh.${entry.value.toLocaleString()}`
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading && projects.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh', background: currentTheme.background }}>
        <div className="spinner-border" style={{ color: currentTheme.colors[0] }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error && projects.length === 0) {
    return (
      <div className="alert alert-danger m-4" style={{ background: currentTheme.colors[4], color: '#fff' }}>
        {error}
        <button className="btn btn-light ms-2" onClick={fetchProjects}>Retry</button>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4" style={{ background: currentTheme.background, color: currentTheme.text, minHeight: '100vh' }}>
      {/* Header */}
      <div className="row mb-4 align-items-center">
        <div className="col-md-6">
          <h2>Project Analytics Dashboard</h2>
          <p style={{ opacity: 0.7 }}>
            Last updated: {lastRefreshed.toLocaleString()}
            <button className="btn btn-link p-0 ms-2" onClick={fetchProjects}>
              <RefreshCw size={16} />
            </button>
          </p>
        </div>
        <div className="col-md-6 d-flex justify-content-end gap-2">
          <div className="input-group" style={{ maxWidth: '300px' }}>
            <span className="input-group-text" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
              <Search size={18} />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: currentTheme.cardBg, color: currentTheme.text, borderColor: currentTheme.border }}
            />
          </div>
          <button
            className="btn btn-outline-primary"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            style={{ borderColor: currentTheme.colors[0], color: currentTheme.colors[0] }}
          >
            <Filter size={16} className="me-1" />
            Filters
          </button>
          <select
            className="form-select"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            style={{ maxWidth: '150px', background: currentTheme.cardBg, color: currentTheme.text, borderColor: currentTheme.border }}
          >
            <option value="default">Overview</option>
            <option value="analytics">Analytics</option>
            <option value="revenue">Revenue</option>
            <option value="performance">Performance</option>
          </select>
          <select
            className="form-select"
            value={selectedTheme}
            onChange={(e) => setSelectedTheme(e.target.value)}
            style={{ maxWidth: '120px', background: currentTheme.cardBg, color: currentTheme.text, borderColor: currentTheme.border }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="pastel">Pastel</option>
          </select>
          <CSVLink
            data={exportData}
            filename={`projects-${new Date().toISOString().split('T')[0]}.csv`}
            className="btn btn-outline-success"
            style={{ borderColor: currentTheme.colors[1], color: currentTheme.colors[1] }}
          >
            <Download size={16} className="me-1" />
            Export
          </CSVLink>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="card mb-4 shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-2">
                <label className="form-label">Year</label>
                <select
                  className="form-select"
                  value={filters.year}
                  onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                  style={{ background: currentTheme.cardBg, color: currentTheme.text, borderColor: currentTheme.border }}
                >
                  <option value="all">All Years</option>
                  {getYears().map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Month</label>
                <select
                  className="form-select"
                  value={filters.month}
                  onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                  style={{ background: currentTheme.cardBg, color: currentTheme.text, borderColor: currentTheme.border }}
                >
                  <option value="all">All Months</option>
                  {[...Array(12)].map((_, i) => (
                    <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  style={{ background: currentTheme.cardBg, color: currentTheme.text, borderColor: currentTheme.border }}
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Order Ref Code</label> {/* Changed label from 'Client' to 'Order Ref Code' */}
                <select
                  className="form-select"
                  value={filters.orderRefCode} // Changed from 'client' to 'orderRefCode'
                  onChange={(e) => setFilters({ ...filters, orderRefCode: e.target.value })} // Changed from 'client' to 'orderRefCode'
                  style={{ background: currentTheme.cardBg, color: currentTheme.text, borderColor: currentTheme.border }}
                >
                  <option value="all">All Order Refs</option> {/* Changed label */}
                  {getOrderRefCodes().map(refCode => <option key={refCode} value={refCode}>{refCode}</option>)} {/* Changed from 'client' to 'refCode' */}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Min Amount</label>
                <input
                  type="number"
                  className="form-control"
                  value={filters.minAmount}
                  onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                  style={{ background: currentTheme.cardBg, color: currentTheme.text, borderColor: currentTheme.border }}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Max Amount</label>
                <input
                  type="number"
                  className="form-control"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                  style={{ background: currentTheme.cardBg, color: currentTheme.text, borderColor: currentTheme.border }}
                />
              </div>
            </div>
            <div className="mt-3 d-flex justify-content-between">
              <select
                className="form-select"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                style={{ maxWidth: '150px', background: currentTheme.cardBg, color: currentTheme.text, borderColor: currentTheme.border }}
              >
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
              <div>
                <button
                  className="btn btn-outline-secondary me-2"
                  onClick={() => setFilters({ year: 'all', month: 'all', status: 'all', orderRefCode: 'all', minAmount: '', maxAmount: '' })} // Changed 'client' to 'orderRefCode'
                  style={{ borderColor: currentTheme.border, color: currentTheme.text }}
                >
                  Reset
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowFilterPanel(false)}
                  style={{ background: currentTheme.colors[0], borderColor: currentTheme.colors[0] }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-lg-3">
          <div className="card shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
            <div className="card-body d-flex align-items-center">
              <Activity size={32} style={{ color: currentTheme.colors[0] }} className="me-3" />
              <div>
                <h6 style={{ color: `${currentTheme.text}80` }}>Total Projects</h6>
                <h3 style={{ color: currentTheme.text }}>{stats.total}</h3>
                <small style={{ color: stats.growthRate >= 0 ? currentTheme.colors[1] : currentTheme.colors[4] }}>
                  {stats.growthRate.toFixed(1)}% {stats.growthRate >= 0 ? <TrendingUp size={12} /> : <ChevronDown size={12} />}
                </small>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-lg-3">
          <div className="card shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
            <div className="card-body d-flex align-items-center">
              <Banknote size={32} style={{ color: currentTheme.colors[1] }} className="me-3" />
              <div>
                <h6 style={{ color: `${currentTheme.text}80` }}>Total Revenue</h6>
                <h3 style={{ color: currentTheme.text }}>Ksh.{stats.totalRevenue.toLocaleString()}</h3>
                <small style={{ color: stats.revenueGrowthRate >= 0 ? currentTheme.colors[1] : currentTheme.colors[4] }}>
                  {stats.revenueGrowthRate.toFixed(1)}% {stats.revenueGrowthRate >= 0 ? <TrendingUp size={12} /> : <ChevronDown size={12} />}
                </small>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-lg-3">
          <div className="card shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
            <div className="card-body d-flex align-items-center">
              <Award size={32} style={{ color: currentTheme.colors[2] }} className="me-3" />
              <div>
                <h6 style={{ color: `${currentTheme.text}80` }}>Completion Rate</h6>
                <h3 style={{ color: currentTheme.text }}>{stats.completionRate.toFixed(1)}%</h3>
                <small style={{ color: currentTheme.text }}>{stats.completed}/{stats.total}</small>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-lg-3">
          <div className="card shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
            <div className="card-body d-flex align-items-center">
              <Banknote size={32} style={{ color: currentTheme.colors[3] }} className="me-3" />
              <div>
                <h6 style={{ color: `${currentTheme.text}80` }}>Avg. Value</h6>
                <h3 style={{ color: currentTheme.text }}>Ksh.{stats.averageProjectValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                <small style={{ color: currentTheme.text }}>Per project</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-lg-3">
          <div className="card shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
            <div className="card-body d-flex align-items-center">
              <CheckCircle size={32} style={{ color: currentTheme.colors[1] }} className="me-3" />
              <div>
                <h6 style={{ color: `${currentTheme.text}80` }}>Completed</h6>
                <h3 style={{ color: currentTheme.text }}>{stats.completed}</h3>
                <small style={{ color: currentTheme.text }}>{stats.total ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}%</small>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-lg-3">
          <div className="card shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
            <div className="card-body d-flex align-items-center">
              <Clock size={32} style={{ color: currentTheme.colors[2] }} className="me-3" />
              <div>
                <h6 style={{ color: `${currentTheme.text}80` }}>Pending</h6>
                <h3 style={{ color: currentTheme.text }}>{stats.pending}</h3>
                <small style={{ color: currentTheme.text }}>{stats.total ? ((stats.pending / stats.total) * 100).toFixed(1) : 0}%</small>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-lg-3">
          <div className="card shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
            <div className="card-body d-flex align-items-center">
              <AlertCircle size={32} style={{ color: currentTheme.colors[3] }} className="me-3" />
              <div>
                <h6 style={{ color: `${currentTheme.text}80` }}>In Progress</h6>
                <h3 style={{ color: currentTheme.text }}>{stats.inProgress}</h3>
                <small style={{ color: currentTheme.text }}>{stats.total ? ((stats.inProgress / stats.total) * 100).toFixed(1) : 0}%</small>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-lg-3">
          <div className="card shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
            <div className="card-body d-flex align-items-center">
              <XCircle size={32} style={{ color: currentTheme.colors[4] }} className="me-3" />
              <div>
                <h6 style={{ color: `${currentTheme.text}80` }}>Cancelled</h6>
                <h3 style={{ color: currentTheme.text }}>{stats.cancelled}</h3>
                <small style={{ color: currentTheme.text }}>{stats.total ? ((stats.cancelled / stats.total) * 100).toFixed(1) : 0}%</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Content */}
      {viewMode === 'default' && (
        <div className="row g-4">
          <div className="col-lg-6">
            <div className="card shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
              <div className="card-body">
                <h5>Status Distribution</h5>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
              <div className="card-body">
                <h5>Order Type Distribution</h5>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={orderTypeDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {orderTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'analytics' && (
        <div className="row g-4">
          <div className="col-12">
            <div className="card shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
              <div className="card-body">
                <h5>Project Trends ({dateRange.charAt(0).toUpperCase() + dateRange.slice(1)})</h5>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={`${currentTheme.border}80`} />
                    <XAxis dataKey="period" stroke={currentTheme.text} />
                    <YAxis stroke={currentTheme.text} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke={currentTheme.colors[1]} />
                    <Line type="monotone" dataKey="projects" name="Projects" stroke={currentTheme.colors[0]} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'revenue' && (
        <div className="row g-4">
          <div className="col-12">
            <div className="card shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
              <div className="card-body">
                <h5>Revenue & Profit Analysis ({dateRange.charAt(0).toUpperCase() + dateRange.slice(1)})</h5>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={`${currentTheme.border}80`} />
                    <XAxis dataKey="period" stroke={currentTheme.text} />
                    <YAxis stroke={currentTheme.text} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="revenue" fill={currentTheme.colors[1]} name="Revenue" />
                    <Bar dataKey="profit" fill={currentTheme.colors[3]} name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'performance' && (
        <div className="row g-4">
          <div className="col-12">
            <div className="card shadow-sm" style={{ background: currentTheme.cardBg, borderColor: currentTheme.border }}>
              <div className="card-body">
                <h5>Project Performance</h5>
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke={`${currentTheme.border}80`} />
                    <XAxis dataKey="value" name="Revenue" unit="Ksh" stroke={currentTheme.text} />
                    <YAxis dataKey="size" name="Size" stroke={currentTheme.text} />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter name="Projects" data={performanceData} fill={currentTheme.colors[0]}>
                      {performanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={currentTheme.colors[entry.status === 'completed' ? 1 : entry.status === 'pending' ? 2 : entry.status === 'in-progress' ? 3 : 4]} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;