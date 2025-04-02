import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { FaFolder, FaChartPie, FaTasks, FaClock, FaExclamationTriangle, FaFilter, FaMoneyBillWave, FaChartLine, FaSun, FaMoon, FaPalette } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import styled, { ThemeProvider } from 'styled-components';

// Define themes (unchanged)
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

// Styled components (unchanged)
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
  top: 20px;
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

function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(darkTheme);
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

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const COLORS = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#9f7aea', '#ed64a6'];

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

  // Theme toggle logic
  const toggleTheme = () => {
    if (theme === lightTheme) setTheme(darkTheme);
    else if (theme === darkTheme) setTheme(vibrantTheme);
    else setTheme(lightTheme);
  };

  // Chart data preparation
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

  // Project Trends Data (Total Projects, Completed, Normal, Dissertation) with full month and year
  const projectTrendsData = projects.reduce((acc, project) => {
    const date = new Date(project.orderDate);
    const monthYear = `${months[date.getMonth()]} ${date.getFullYear()}`;
    if (!acc[monthYear]) {
      acc[monthYear] = {
        month: monthYear,
        totalProjects: 0,
        completed: 0,
        normal: 0,
        dissertation: 0
      };
    }
    acc[monthYear].totalProjects += 1;
    if (project.status === 'completed') acc[monthYear].completed += 1;
    if (project.orderType === 'normal') acc[monthYear].normal += 1;
    if (project.orderType === 'dissertation') acc[monthYear].dissertation += 1;
    return acc;
  }, {});

  // Ensure 6 months of data, filling in missing months with zeros
  const recentMonths = [];
  const currentDate = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthYear = `${months[date.getMonth()]} ${date.getFullYear()}`;
    recentMonths.push({
      month: monthYear,
      totalProjects: projectTrendsData[monthYear]?.totalProjects || 0,
      completed: projectTrendsData[monthYear]?.completed || 0,
      normal: projectTrendsData[monthYear]?.normal || 0,
      dissertation: projectTrendsData[monthYear]?.dissertation || 0
    });
  }

  // Project Type Trend Data with full month and year
  const typeTrendData = projects.reduce((acc, project) => {
    const date = new Date(project.orderDate);
    const monthYear = `${months[date.getMonth()]} ${date.getFullYear()}`;
    const type = project.orderType || 'Unknown';
    if (!acc[monthYear]) {
      acc[monthYear] = { month: monthYear };
    }
    acc[monthYear][type] = (acc[monthYear][type] || 0) + 1;
    return acc;
  }, {});

  // Ensure 6 months of data for project types, filling in missing months with zeros
  const uniqueTypes = [...new Set(projects.map(p => p.orderType || 'Unknown'))];
  const typeTrendArray = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthYear = `${months[date.getMonth()]} ${date.getFullYear()}`;
    const entry = { month: monthYear };
    uniqueTypes.forEach(type => {
      entry[type] = typeTrendData[monthYear]?.[type] || 0;
    });
    typeTrendArray.push(entry);
  }

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
        <ThemeToggle
          onClick={toggleTheme}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {theme === lightTheme ? <FaSun /> : theme === darkTheme ? <FaMoon /> : <FaPalette />}
        </ThemeToggle>

        <motion.h1
          className="mb-4 d-flex align-items-center"
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <FaChartPie className="me-2" /> Project Dashboard
        </motion.h1>

        {/* Filters */}
        <Card className="mb-4">
          <GradientHeader>
            <h5><FaFilter className="me-2" /> Filters & Comparison</h5>
          </GradientHeader>
          <div className="card-body">
            <div className="row">
              {[
                { label: 'Filter Month', value: filterMonth, setter: setFilterMonth, options: months },
                { label: 'Filter Year', value: filterYear, setter: setFilterYear, options: years },
                { label: 'Compare Month', value: compareMonth, setter: setCompareMonth, options: months },
                { label: 'Compare Year', value: compareYear, setter: setCompareYear, options: years },
              ].map(({ label, value, setter, options }, index) => (
                <div className="col-md-3 mb-3" key={index}>
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
          </div>
        </Card>

        {error && (
          <motion.div
            className="alert alert-danger mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.div>
        )}

        {/* Key Metrics */}
        <div className="row mb-4">
          {[
            { icon: FaFolder, title: 'Total Projects', value: stats.totalProjects, compare: compareStats?.totalProjects, color: theme.primary },
            { icon: FaTasks, title: 'Completed', value: stats.completed, compare: compareStats?.completed, color: theme.success },
            { icon: FaClock, title: 'In Progress', value: stats.inProgress, compare: compareStats?.inProgress, color: theme.warning },
            { icon: FaExclamationTriangle, title: 'Overdue', value: stats.overdue, compare: compareStats?.overdue, color: theme.danger },
            { icon: FaMoneyBillWave, title: 'Income Generated', value: `Ksh.${stats.totalAmount.toLocaleString()}`, compare: compareStats ? `Ksh.${compareStats.totalAmount.toLocaleString()}` : null, color: theme.secondary, col: 'col-md-4' },
          ].map(({ icon: Icon, title, value, compare, color, col = 'col-md-2' }, index) => (
            <div className={`${col} mb-3`} key={index}>
              <Card style={{ background: color, color: '#fff' }}>
                <div className="d-flex align-items-center">
                  <Icon size={36} className="me-3" />
                  <div>
                    <h5>{title}</h5>
                    <motion.h2
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      {value}
                    </motion.h2>
                    {compare && <small>vs {compare}</small>}
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="row">
          <div className="col-md-6 mb-4">
            <Card>
              <GradientHeader>
                <h5><FaChartPie className="me-2" /> Project Status Distribution</h5>
              </GradientHeader>
              <div className="card-body" style={{ height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1500}
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
                        innerRadius={110}
                        outerRadius={130}
                        fill="#82ca9d"
                        dataKey="value"
                        opacity={0.6}
                        label
                        animationBegin={0}
                        animationDuration={1500}
                      >
                        {compareStatusData.map((entry, index) => (
                          <Cell key={`compare-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    )}
                    <Tooltip contentStyle={{ background: theme.cardBackground, color: theme.text }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="col-md-6 mb-4">
            <Card>
              <GradientHeader>
                <h5><FaChartLine className="me-2" /> Project Trends</h5>
              </GradientHeader>
              <div className="card-body" style={{ height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={recentMonths} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                    <XAxis dataKey="month" stroke={theme.text} />
                    <YAxis stroke={theme.text} domain={[0, 8]} ticks={[0, 2, 4, 6, 8]} />
                    <Tooltip contentStyle={{ background: theme.cardBackground, color: theme.text }} />
                    <Legend verticalAlign="bottom" height={36} />
                    <Line
                      type="monotone"
                      dataKey="totalProjects"
                      name="Total Projects"
                      stroke={COLORS[0]}
                      strokeWidth={1.5}
                      dot={{ r: 4, fill: COLORS[0] }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      name="Completed"
                      stroke={COLORS[1]}
                      strokeWidth={1.5}
                      dot={{ r: 4, fill: COLORS[1] }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="normal"
                      name="Normal"
                      stroke={COLORS[2]}
                      strokeWidth={1.5}
                      dot={{ r: 4, fill: COLORS[2] }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="dissertation"
                      name="Dissertation"
                      stroke={COLORS[3]}
                      strokeWidth={1.5}
                      dot={{ r: 4, fill: COLORS[3] }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Projects and Project Type Trend */}
        <div className="row">
          <div className="col-md-8 mb-4">
            <Card>
              <GradientHeader className="d-flex justify-content-between align-items-center">
                <h5><FaFolder className="me-2" /> Recent Projects</h5>
                <motion.button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => navigate('/projects')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  View All
                </motion.button>
              </GradientHeader>
              <div className="card-body" style={{ height: '350px', overflowY: 'auto', direction: 'rtl' }}>
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
                        <motion.tr
                          key={project.id}
                          onClick={() => navigate(`/projects/edit/${project.id}`)}
                          style={{ cursor: 'pointer' }}
                          whileHover={{ backgroundColor: theme.secondary + '20' }}
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
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>

          <div className="col-md-4 mb-4">
            <Card>
              <GradientHeader>
                <h5><FaChartLine className="me-2" /> Project Type Trend</h5>
              </GradientHeader>
              <div className="card-body" style={{ height: '350px' }}>
                {typeTrendArray.length === 0 ? (
                  <p className="text-muted">No project types in this period</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={typeTrendArray} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                      <XAxis dataKey="month" stroke={theme.text} />
                      <YAxis stroke={theme.text} domain={[0, 8]} ticks={[0, 2, 4, 6, 8]} />
                      <Tooltip contentStyle={{ background: theme.cardBackground, color: theme.text }} />
                      <Legend verticalAlign="bottom" height={36} />
                      {uniqueTypes.map((type, index) => (
                        <Line
                          key={type}
                          type="monotone"
                          dataKey={type}
                          stroke={COLORS[index % COLORS.length]}
                          name={type.charAt(0).toUpperCase() + type.slice(1)}
                          strokeWidth={1.5}
                          dot={{ r: 4, fill: COLORS[index % COLORS.length] }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Floating Particles Effect */}
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
      </DashboardContainer>
    </ThemeProvider>
  );
}

export default Dashboard;