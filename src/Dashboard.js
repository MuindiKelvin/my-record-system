import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import {
  FaFolder, FaChartPie, FaTasks, FaClock, FaExclamationTriangle,
  FaFilter, FaMoneyBillWave, FaChartLine, FaSun, FaMoon, FaPalette,
  FaArrowUp, FaArrowDown, FaMinus, FaTimes, FaFileWord,
  FaBan, FaWallet, FaPlus, FaHourglass
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, BarChart, Bar
} from 'recharts';
import { motion } from 'framer-motion';
import styled, { ThemeProvider } from 'styled-components';

//  Particles: generated once at module level to prevent re-render jitter 
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  duration: `${(Math.random() * 10 + 5).toFixed(2)}s`
}));

//  Initial stats shape (single source of truth) 
const initialStatsShape = {
  totalProjects: 0,
  completed: 0,
  inProgress: 0,
  pending: 0,
  cancelled: 0,
  overdue: 0,
  totalAmount: 0,
  totalPaid: 0,
  totalWords: 0,
  paidCount: 0,
  partialCount: 0,
  unpaidCount: 0
};

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

//  Styled Components 
const DashboardContainer = styled(motion.div)`
  background: ${props => props.theme.background};
  color: ${props => props.theme.text};
  min-height: 100vh;
  padding: 2rem;
  transition: all 0.3s ease;
`;

const Card = styled(motion.div)`
  background: ${props => props.theme.cardBackground};
  border-radius: 15px;
  padding: 1.5rem;
  box-shadow: ${props => props.theme.shadow};
  transition: transform 0.2s ease;
  &:hover {
    transform: translateY(-5px);
  }
`;

const GradientHeader = styled.div`
  background: ${props => props.theme.gradient};
  padding: 1rem;
  border-radius: 10px 10px 0 0;
  color: ${props => props.theme.text};
`;

const ThemeToggle = styled(motion.button)`
  position: fixed;
  top: 70px;
  right: 20px;
  background: ${props => props.theme.primary};
  color: white;
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

const ComparisonIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 0.9rem;
  font-weight: 600;
`;

const PercentageChange = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  background: ${props =>
    props.positive ? 'rgba(72, 187, 120, 0.2)' :
    props.negative ? 'rgba(245, 101, 101, 0.2)' :
    'rgba(160, 174, 192, 0.2)'};
  color: ${props =>
    props.positive ? '#48bb78' :
    props.negative ? '#f56565' :
    '#a0aec0'};
`;

//  Dashboard Component 
function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(darkTheme);
  const [stats, setStats] = useState({ ...initialStatsShape });
  const [compareStats, setCompareStats] = useState(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [compareMonth, setCompareMonth] = useState(null);
  const [compareYear, setCompareYear] = useState(null);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const COLORS = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#9f7aea', '#ed64a6'];

  //  Helpers 
  const calculatePercentageChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace('KES', 'Ksh.');

  const getComparisonIndicator = (current, compare, isCurrency = false) => {
    if (compare === null || compare === undefined) return null;
    const currentVal = Number(current);
    const compareVal = Number(compare);
    const percentChange = calculatePercentageChange(currentVal, compareVal);
    const difference = currentVal - compareVal;
    const isPositive = difference > 0;
    const isNegative = difference < 0;
    return (
      <ComparisonIndicator>
        <PercentageChange positive={isPositive} negative={isNegative}>
          {isPositive && <FaArrowUp />}
          {isNegative && <FaArrowDown />}
          {!isPositive && !isNegative && <FaMinus />}
          {Math.abs(percentChange).toFixed(1)}%
        </PercentageChange>
        <small style={{ opacity: 0.8 }}>
          {isCurrency ? formatCurrency(Math.abs(difference)) : Math.abs(difference)}
          {isPositive ? ' more' : isNegative ? ' less' : ' same'}
        </small>
      </ComparisonIndicator>
    );
  };

  //  Stats calculation 
  // Extracted as a pure function so it can be reused for both main + compare periods.
  // Fixes: totalPaid now correctly includes fully-paid projects (not just partials).
  const calcStats = (projectsList, currentDate) =>
    projectsList.reduce((acc, project) => {
      acc.totalProjects += 1;
      acc.totalWords += Number(project.words) || 0;

      if (project.status === 'completed') acc.completed += 1;
      else if (project.status === 'in-progress') acc.inProgress += 1;
      else if (project.status === 'pending') acc.pending += 1;
      else if (project.status === 'cancelled') acc.cancelled += 1;

      const submissionDate = new Date(project.submissionDate);
      if (
        submissionDate < currentDate &&
        project.status !== 'completed' &&
        project.status !== 'cancelled'
      ) {
        acc.overdue += 1;
      }

      // Exclude cancelled projects from financial totals
      if (project.status !== 'cancelled') {
        acc.totalAmount += Number(project.amount) || 0;
        if (project.paymentStatus === 'paid') {
          // Fully paid: the whole amount has been received
          acc.totalPaid += Number(project.amount) || 0;
          acc.paidCount += 1;
        } else if (project.paymentStatus === 'partial') {
          acc.totalPaid += Number(project.amountPaid) || 0;
          acc.partialCount += 1;
        } else {
          acc.unpaidCount += 1;
        }
      }

      return acc;
    }, { ...initialStatsShape });

  const updateStats = (projectsData, currentDate) => {
    const filtered = projectsData.filter(project => {
      const d = new Date(project.orderDate);
      return (
        (filterMonth === null || d.getMonth() === filterMonth) &&
        (filterYear === null || d.getFullYear() === filterYear)
      );
    });
    setStats(calcStats(filtered, currentDate));

    if (compareMonth !== null && compareYear !== null) {
      const compared = projectsData.filter(project => {
        const d = new Date(project.orderDate);
        return d.getMonth() === compareMonth && d.getFullYear() === compareYear;
      });
      setCompareStats(calcStats(compared, currentDate));
    } else {
      setCompareStats(null);
    }
  };

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'projects'));
      const projectsData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setProjects(projectsData);
      updateStats(projectsData, new Date());
    } catch (err) {
      setError('Error fetching projects: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (projects.length > 0) updateStats(projects, new Date());
  }, [filterMonth, filterYear, compareMonth, compareYear, projects]);

  const toggleTheme = () => {
    if (theme === lightTheme) setTheme(darkTheme);
    else if (theme === darkTheme) setTheme(vibrantTheme);
    else setTheme(lightTheme);
  };

  //  Derived chart data 
  const currentDate = new Date();

  // Project trends (last 6 months)
  const projectTrendsMap = projects.reduce((acc, project) => {
    const date = new Date(project.orderDate);
    const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
    if (!acc[key]) acc[key] = { month: key, totalProjects: 0, completed: 0, normal: 0, dissertation: 0 };
    acc[key].totalProjects += 1;
    if (project.status === 'completed') acc[key].completed += 1;
    if (project.orderType === 'normal') acc[key].normal += 1;
    if (project.orderType === 'dissertation') acc[key].dissertation += 1;
    return acc;
  }, {});

  const recentMonths = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - i), 1);
    const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
    return {
      month: key,
      totalProjects: projectTrendsMap[key]?.totalProjects || 0,
      completed: projectTrendsMap[key]?.completed || 0,
      normal: projectTrendsMap[key]?.normal || 0,
      dissertation: projectTrendsMap[key]?.dissertation || 0
    };
  });

  // Project type trend (last 6 months)
  const typeTrendMap = projects.reduce((acc, project) => {
    const date = new Date(project.orderDate);
    const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
    const type = project.orderType || 'Unknown';
    if (!acc[key]) acc[key] = { month: key };
    acc[key][type] = (acc[key][type] || 0) + 1;
    return acc;
  }, {});

  const uniqueTypes = [...new Set(projects.map(p => p.orderType || 'Unknown'))];

  const typeTrendArray = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - i), 1);
    const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
    const entry = { month: key };
    uniqueTypes.forEach(type => { entry[type] = typeTrendMap[key]?.[type] || 0; });
    return entry;
  });

  // Monthly revenue: stacked bar (Paid + Outstanding = total Income)
  const revenueChartData = recentMonths.map(({ month }) => {
    const monthProjects = projects.filter(p => {
      if (p.status === 'cancelled') return false;
      const d = new Date(p.orderDate);
      return `${months[d.getMonth()]} ${d.getFullYear()}` === month;
    });
    const income = monthProjects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const paid = monthProjects.reduce((sum, p) => {
      if (p.paymentStatus === 'paid') return sum + (Number(p.amount) || 0);
      if (p.paymentStatus === 'partial') return sum + (Number(p.amountPaid) || 0);
      return sum;
    }, 0);
    return {
      month,
      Paid: Math.round(paid),
      Outstanding: Math.round(Math.max(0, income - paid))
    };
  });

  // Payment status breakdown (respects current filter via stats)
  const paymentStatusData = [
    { name: 'Paid', value: stats.paidCount, color: '#48bb78' },
    { name: 'Partial', value: stats.partialCount, color: '#ecc94b' },
    { name: 'Unpaid', value: stats.unpaidCount, color: '#a0aec0' }
  ].filter(d => d.value > 0);

  // Status distribution for pie/comparison bar
  const statusData = [
    { name: 'Completed', value: stats.completed, compareValue: compareStats?.completed || 0 },
    { name: 'In Progress', value: stats.inProgress, compareValue: compareStats?.inProgress || 0 },
    { name: 'Pending', value: stats.pending, compareValue: compareStats?.pending || 0 }
  ];

  // Recent projects respecting the active filter (not all projects)
  const recentProjects = projects
    .filter(project => {
      const d = new Date(project.orderDate);
      return (
        (filterMonth === null || d.getMonth() === filterMonth) &&
        (filterYear === null || d.getFullYear() === filterYear)
      );
    })
    .sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate))
    .slice(0, 10);

  // Custom tooltip for pie charts
  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: theme.cardBackground,
          color: theme.text,
          padding: '10px',
          border: `1px solid ${theme.primary}`,
          borderRadius: '5px',
          boxShadow: theme.shadow
        }}>
          <p style={{ margin: 0 }}>{`${payload[0].name}: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <motion.div
          className="spinner-border text-primary"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <span className="visually-hidden">Loading...</span>
        </motion.div>
      </div>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <DashboardContainer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Theme toggle — offset from top to avoid navbar overlap */}
        <ThemeToggle
          onClick={toggleTheme}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {theme === lightTheme ? <FaSun /> : theme === darkTheme ? <FaMoon /> : <FaPalette />}
        </ThemeToggle>

        {/*  Header  */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <motion.h1
            className="d-flex align-items-center mb-0"
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <FaChartPie className="me-2" /> Project Dashboard
          </motion.h1>
          <motion.button
            className="btn btn-primary d-flex align-items-center gap-2"
            onClick={() => navigate('/projects/new')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FaPlus /> Add Project
          </motion.button>
        </div>

        {/*  Filters  */}
        <Card className="mb-4">
          <GradientHeader>
            <h5 className="mb-0"><FaFilter className="me-2" /> Filters &amp; Comparison</h5>
          </GradientHeader>
          <div className="card-body">
            <div className="row">
              {[
                { label: 'Filter Month', value: filterMonth, setter: setFilterMonth, options: months },
                { label: 'Filter Year', value: filterYear, setter: setFilterYear, options: years },
                { label: 'Compare Month', value: compareMonth, setter: setCompareMonth, options: months },
                { label: 'Compare Year', value: compareYear, setter: setCompareYear, options: years },
              ].map(({ label, value, setter, options }, index) => (
                <div className="col-md-3 mb-2" key={index}>
                  <label className="form-label">{label}</label>
                  <motion.select
                    className="form-select"
                    value={value === null ? '' : value}
                    onChange={(e) => setter(e.target.value === '' ? null : Number(e.target.value))}
                    whileHover={{ scale: 1.02 }}
                  >
                    <option value="">{label.includes('Compare') ? 'None' : 'All'}</option>
                    {options.map((opt, idx) => (
                      <option key={idx} value={label.includes('Year') ? opt : idx}>{opt}</option>
                    ))}
                  </motion.select>
                </div>
              ))}
            </div>

            {/* Comparison active banner */}
            {compareStats && (
              <div className="d-flex justify-content-between align-items-center mt-3 p-2 rounded"
                style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)' }}
              >
                <small>
                  <strong>Comparing:</strong>{' '}
                  {filterMonth !== null ? months[filterMonth] : 'All'} {filterYear}
                  {' '}<span style={{ opacity: 0.6 }}>vs</span>{' '}
                  {compareMonth !== null ? months[compareMonth] : 'All'} {compareYear}
                </small>
                <motion.button
                  className="btn btn-outline-warning btn-sm"
                  onClick={() => { setCompareMonth(null); setCompareYear(null); }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaTimes className="me-1" /> Clear
                </motion.button>
              </div>
            )}
          </div>
        </Card>

        {error && (
          <motion.div className="alert alert-danger mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {error}
          </motion.div>
        )}

        {/*  Row 1: Status Metric Cards (6)  */}
        <div className="row mb-3">
          {[
            { icon: FaFolder,            title: 'Total Projects', value: stats.totalProjects, compare: compareStats?.totalProjects, color: theme.primary },
            { icon: FaTasks,             title: 'Completed',      value: stats.completed,     compare: compareStats?.completed,     color: theme.success },
            { icon: FaClock,             title: 'In Progress',    value: stats.inProgress,    compare: compareStats?.inProgress,    color: theme.warning },
            { icon: FaHourglass,         title: 'Pending',        value: stats.pending,       compare: compareStats?.pending,       color: '#6c8fbd' },
            { icon: FaExclamationTriangle, title: 'Overdue',      value: stats.overdue,       compare: compareStats?.overdue,       color: theme.danger },
            { icon: FaBan,               title: 'Cancelled',      value: stats.cancelled,     compare: compareStats?.cancelled,     color: theme.secondary },
          ].map(({ icon: Icon, title, value, compare, color }, index) => (
            <div className="col-xl-2 col-md-4 col-sm-6 mb-3" key={index}>
              <Card style={{ background: color, color: '#fff', height: '100%' }}>
                <div className="d-flex align-items-center">
                  <Icon size={30} className="me-3" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h6 style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '4px' }}>{title}</h6>
                    <motion.h2
                      style={{ fontSize: '1.75rem', marginBottom: 0 }}
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      {value}
                    </motion.h2>
                    {getComparisonIndicator(value, compare, false)}
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>

        {/*  Row 2: Financial Metric Cards (4)  */}
        <div className="row mb-4">
          {[
            {
              icon: FaMoneyBillWave,
              title: 'Income Generated',
              display: formatCurrency(stats.totalAmount),
              rawValue: stats.totalAmount,
              compare: compareStats?.totalAmount,
              color: '#5a7fa8',
              isCurrency: true
            },
            {
              icon: FaWallet,
              title: 'Total Paid',
              display: formatCurrency(stats.totalPaid),
              rawValue: stats.totalPaid,
              compare: compareStats?.totalPaid,
              color: theme.success,
              isCurrency: true
            },
            {
              icon: FaExclamationTriangle,
              title: 'Outstanding',
              display: formatCurrency(Math.max(0, stats.totalAmount - stats.totalPaid)),
              rawValue: Math.max(0, stats.totalAmount - stats.totalPaid),
              compare: compareStats ? Math.max(0, compareStats.totalAmount - compareStats.totalPaid) : null,
              color: '#c0713e',
              isCurrency: true
            },
            {
              icon: FaFileWord,
              title: 'Total Words Written',
              display: stats.totalWords.toLocaleString(),
              rawValue: stats.totalWords,
              compare: compareStats?.totalWords,
              color: '#7b5ea7',
              isCurrency: false
            },
          ].map(({ icon: Icon, title, display, rawValue, compare, color, isCurrency }, index) => (
            <div className="col-md-3 col-sm-6 mb-3" key={index}>
              <Card style={{ background: color, color: '#fff', height: '100%' }}>
                <div className="d-flex align-items-center">
                  <Icon size={30} className="me-3" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h6 style={{ fontSize: '0.8rem', opacity: 0.9, marginBottom: '4px' }}>{title}</h6>
                    <motion.div
                      style={{ fontSize: isCurrency ? '1.05rem' : '1.5rem', fontWeight: 'bold', marginBottom: 0 }}
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      {display}
                    </motion.div>
                    {getComparisonIndicator(rawValue, compare, isCurrency)}
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>

        {/*  Row 3: Status Distribution + Monthly Revenue  */}
        <div className="row">
          {/* Status Distribution */}
          <div className="col-md-6 mb-4">
            <Card>
              <GradientHeader>
                <h5 className="mb-0">
                  <FaChartPie className="me-2" /> Project Status Distribution
                </h5>
                {compareStats && (
                  <small>
                    {filterMonth !== null ? months[filterMonth] : 'All'} {filterYear}
                    {' vs '}
                    {compareMonth !== null ? months[compareMonth] : 'All'} {compareYear}
                  </small>
                )}
              </GradientHeader>
              <div className="card-body" style={{ height: '350px' }}>
                {stats.totalProjects === 0 ? (
                  <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                    No projects for the selected period
                  </div>
                ) : compareStats ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Completed', Current: stats.completed, Compare: compareStats.completed },
                        { name: 'In Progress', Current: stats.inProgress, Compare: compareStats.inProgress },
                        { name: 'Pending', Current: stats.pending, Compare: compareStats.pending },
                      ]}
                      margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis dataKey="name" stroke={theme.text} />
                      <YAxis stroke={theme.text} />
                      <Tooltip contentStyle={{ background: theme.cardBackground, color: theme.text, border: `1px solid ${theme.primary}`, borderRadius: '8px' }} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        formatter={(value) => value === 'Current'
                          ? `${months[filterMonth] || 'All'} ${filterYear}`
                          : `${months[compareMonth]} ${compareYear}`
                        }
                      />
                      <Bar dataKey="Current" fill="#00d4ff" radius={[8, 8, 0, 0]} label={{ position: 'top', fill: theme.text }} />
                      <Bar dataKey="Compare" fill="#48bb78" radius={[8, 8, 0, 0]} label={{ position: 'top', fill: theme.text }} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) =>
                          value > 0 ? `${name}: ${value} (${(percent * 100).toFixed(0)}%)` : ''
                        }
                        outerRadius={110}
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={1500}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          {/* Monthly Revenue — stacked bar: Paid (green) + Outstanding (red) = total income */}
          <div className="col-md-6 mb-4">
            <Card>
              <GradientHeader>
                <h5 className="mb-0">
                  <FaMoneyBillWave className="me-2" /> Monthly Revenue (Last 6 Months)
                </h5>
              </GradientHeader>
              <div className="card-body" style={{ height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                    <XAxis dataKey="month" stroke={theme.text} tick={{ fontSize: 11 }} />
                    <YAxis
                      stroke={theme.text}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                    />
                    <Tooltip
                      formatter={(value, name) => [`Ksh.${Number(value).toLocaleString()}`, name]}
                      contentStyle={{ background: theme.cardBackground, color: theme.text, borderRadius: '8px' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                    <Bar dataKey="Paid" stackId="revenue" fill="#48bb78" name="Paid" />
                    <Bar dataKey="Outstanding" stackId="revenue" fill="#f56565" name="Outstanding" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>

        {/*  Row 4: Recent Projects + Payment Breakdown  */}
        <div className="row">
          {/* Recent Projects — now respects active filter */}
          <div className="col-md-8 mb-4">
            <Card>
              <GradientHeader className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <FaFolder className="me-2" />
                  Recent Projects
                  <small className="ms-2" style={{ fontWeight: 'normal', opacity: 0.8 }}>
                    ({filterMonth !== null ? months[filterMonth] : 'All'} {filterYear})
                  </small>
                </h5>
                <motion.button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => navigate('/projects')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  View All
                </motion.button>
              </GradientHeader>
              <div className="card-body" style={{ height: '370px', overflowY: 'auto' }}>
                {recentProjects.length === 0 ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                    <FaFolder size={32} className="mb-2" style={{ opacity: 0.3 }} />
                    <span>No projects found for the selected period</span>
                  </div>
                ) : (
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Topic</th>
                        <th>Ref Code</th>
                        <th>Submission</th>
                        <th>Status</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentProjects.map((project, index) => (
                        <motion.tr
                          key={project.id}
                          onClick={() => navigate(`/projects/edit/${project.id}`)}
                          style={{ cursor: 'pointer' }}
                          whileHover={{ backgroundColor: theme.secondary + '20' }}
                        >
                          <td>{index + 1}</td>
                          <td>{project.topic || '—'}</td>
                          <td>{project.orderRefCode}</td>
                          <td>{new Date(project.submissionDate).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge bg-${
                              project.status === 'completed' ? 'success' :
                              project.status === 'in-progress' ? 'warning' :
                              project.status === 'cancelled' ? 'danger' : 'secondary'
                            }`}>
                              {project.status}
                            </span>
                          </td>
                          <td>{formatCurrency(Number(project.amount))}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </div>

          {/* Payment Status Breakdown — donut chart */}
          <div className="col-md-4 mb-4">
            <Card>
              <GradientHeader>
                <h5 className="mb-0"><FaWallet className="me-2" /> Payment Breakdown</h5>
              </GradientHeader>
              <div className="card-body" style={{ height: '370px' }}>
                {paymentStatusData.length === 0 ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                    <FaWallet size={32} className="mb-2" style={{ opacity: 0.3 }} />
                    <span>No payment data for the selected period</span>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="72%">
                      <PieChart>
                        <Pie
                          data={paymentStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          animationBegin={0}
                          animationDuration={1200}
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {paymentStatusData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-1">
                      {paymentStatusData.map((entry) => (
                        <div key={entry.name} className="d-flex justify-content-between align-items-center mb-2">
                          <div className="d-flex align-items-center gap-2">
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                            <span style={{ fontSize: '0.85rem' }}>{entry.name}</span>
                          </div>
                          <strong style={{ fontSize: '0.85rem' }}>
                            {entry.value} project{entry.value !== 1 ? 's' : ''}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/*  Row 5: Project Trends + Type Trend  */}
        <div className="row">
          <div className="col-md-8 mb-4">
            <Card>
              <GradientHeader>
                <h5 className="mb-0"><FaChartLine className="me-2" /> Project Trends (Last 6 Months)</h5>
              </GradientHeader>
              <div className="card-body" style={{ height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={recentMonths} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                    <XAxis dataKey="month" stroke={theme.text} />
                    <YAxis stroke={theme.text} domain={[0, 'auto']} />
                    <Tooltip contentStyle={{ background: theme.cardBackground, color: theme.text }} />
                    <Legend verticalAlign="bottom" height={36} />
                    <Line type="monotone" dataKey="totalProjects" name="Total" stroke="#00d4ff" strokeWidth={2.5} dot={{ r: 5, fill: '#00d4ff' }} activeDot={{ r: 7 }} />
                    <Line type="monotone" dataKey="completed" name="Completed" stroke="#48bb78" strokeWidth={2.5} dot={{ r: 5, fill: '#48bb78' }} activeDot={{ r: 7 }} />
                    <Line type="monotone" dataKey="normal" name="Normal" stroke="#ecc94b" strokeWidth={2.5} dot={{ r: 5, fill: '#ecc94b' }} activeDot={{ r: 7 }} />
                    <Line type="monotone" dataKey="dissertation" name="Dissertation" stroke="#f56565" strokeWidth={2.5} dot={{ r: 5, fill: '#f56565' }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="col-md-4 mb-4">
            <Card>
              <GradientHeader>
                <h5 className="mb-0"><FaChartLine className="me-2" /> Project Type Trend</h5>
              </GradientHeader>
              <div className="card-body" style={{ height: '350px' }}>
                {typeTrendArray.length === 0 ? (
                  <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                    No data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={typeTrendArray} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                      <XAxis dataKey="month" stroke={theme.text} />
                      <YAxis stroke={theme.text} domain={[0, 'auto']} />
                      <Tooltip contentStyle={{ background: theme.cardBackground, color: theme.text }} />
                      <Legend verticalAlign="bottom" height={36} />
                      {uniqueTypes.map((type, index) => {
                        const colorMap = { normal: '#00d4ff', dissertation: '#f56565' };
                        return (
                          <Line
                            key={type}
                            type="monotone"
                            dataKey={type}
                            stroke={colorMap[type] || COLORS[index % COLORS.length]}
                            name={type.charAt(0).toUpperCase() + type.slice(1)}
                            strokeWidth={2.5}
                            dot={{ r: 5, fill: colorMap[type] || COLORS[index % COLORS.length] }}
                            activeDot={{ r: 7 }}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/*  Particles  */}
        <style>{`
          @keyframes float {
            0%   { transform: translateY(0); }
            50%  { transform: translateY(-20vh); }
            100% { transform: translateY(0); }
          }
          .particle {
            position: absolute;
            width: 5px;
            height: 5px;
            background: ${theme.primary};
            border-radius: 50%;
            opacity: 0.3;
            pointer-events: none;
          }
        `}</style>
        {PARTICLES.map(({ id, left, top, duration }) => (
          <div
            key={id}
            className="particle"
            style={{ left, top, animation: `float ${duration} infinite` }}
          />
        ))}

      </DashboardContainer>
    </ThemeProvider>
  );
}

export default Dashboard;