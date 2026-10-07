import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, BarChart, Bar
} from 'recharts';
import { useAppTheme } from './ThemeContext';

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function useIsCompact(breakpoint = 576) {
  const [compact, setCompact] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return compact;
}

function Dashboard() {
  const navigate = useNavigate();
  const { theme } = useAppTheme();
  const compact = useIsCompact();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ ...initialStatsShape });
  const [compareStats, setCompareStats] = useState(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [compareMonth, setCompareMonth] = useState(null);
  const [compareYear, setCompareYear] = useState(null);

  const months = MONTHS;
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const COLORS = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#9f7aea', '#ed64a6'];

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

  // Formats "Jul 2025" -> "Jul '25"
  const fmtMonthLabel = (label) => {
    const parts = label.split(' ');
    return parts.length === 2 ? `${parts[0]} '${parts[1].slice(2)}` : label;
  };

  const getComparisonIndicator = (current, compare, isCurrency = false) => {
    if (compare === null || compare === undefined) return null;
    const currentVal = Number(current);
    const compareVal = Number(compare);
    const percentChange = calculatePercentageChange(currentVal, compareVal);
    const difference = currentVal - compareVal;
    const isPositive = difference > 0;
    const isNegative = difference < 0;
    return (
      <div className="delta">
        <span className={`delta-chip ${isPositive ? 'delta-up' : isNegative ? 'delta-down' : 'delta-flat'}`}>
          <i
            className={`bi ${isPositive ? 'bi-arrow-up' : isNegative ? 'bi-arrow-down' : 'bi-dash'}`}
            aria-hidden="true"
          />
          {Math.abs(percentChange).toFixed(1)}%
        </span>
        <span>
          {isCurrency ? formatCurrency(Math.abs(difference)) : Math.abs(difference)}
          {isPositive ? ' more' : isNegative ? ' less' : ' same'}
        </span>
      </div>
    );
  };

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

      if (project.status !== 'cancelled') {
        acc.totalAmount += Number(project.amount) || 0;
        if (project.paymentStatus === 'paid') {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (projects.length > 0) updateStats(projects, new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth, filterYear, compareMonth, compareYear, projects]);

  const currentDate = new Date();

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

  const recentMonths = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - (11 - i), 1);
    const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
    return {
      month: key,
      totalProjects: projectTrendsMap[key]?.totalProjects || 0,
      completed: projectTrendsMap[key]?.completed || 0,
      normal: projectTrendsMap[key]?.normal || 0,
      dissertation: projectTrendsMap[key]?.dissertation || 0
    };
  });

  const typeTrendMap = projects.reduce((acc, project) => {
    const date = new Date(project.orderDate);
    const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
    const type = project.orderType || 'Unknown';
    if (!acc[key]) acc[key] = { month: key };
    acc[key][type] = (acc[key][type] || 0) + 1;
    return acc;
  }, {});

  const uniqueTypes = [...new Set(projects.map(p => p.orderType || 'Unknown'))];

  const typeTrendArray = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - (11 - i), 1);
    const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
    const entry = { month: key };
    uniqueTypes.forEach(type => { entry[type] = typeTrendMap[key]?.[type] || 0; });
    return entry;
  });

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

  const paymentStatusData = [
    { name: 'Paid', value: stats.paidCount, color: '#48bb78' },
    { name: 'Partial', value: stats.partialCount, color: '#ecc94b' },
    { name: 'Unpaid', value: stats.unpaidCount, color: '#a0aec0' }
  ].filter(d => d.value > 0);

  const statusData = [
    { name: 'Completed', value: stats.completed, compareValue: compareStats?.completed || 0 },
    { name: 'In Progress', value: stats.inProgress, compareValue: compareStats?.inProgress || 0 },
    { name: 'Pending', value: stats.pending, compareValue: compareStats?.pending || 0 }
  ];

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

  /* Chart styling comes from the active theme so charts follow the global switch */
  const tooltipStyle = {
    background: theme.card,
    color: theme.text,
    border: `1px solid ${theme.primary}`,
    borderRadius: '10px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
    fontSize: '0.8rem',
  };
  const axisStyle = { fontSize: compact ? 10 : 11, fill: theme.muted };
  const legendStyle = { fontSize: compact ? '0.7rem' : '0.78rem', color: theme.text };

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={tooltipStyle}>
          <p style={{ margin: 0, padding: '8px 10px' }}>{`${payload[0].name}: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  // Angled X-axis tick: -45deg, anchored at the end, no overlap
  const AngledMonthTick = ({ x, y, payload }) => (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        transform="rotate(-45)"
        style={{ fontSize: compact ? '0.55rem' : '0.62rem', fill: theme.muted }}
      >
        {fmtMonthLabel(payload.value)}
      </text>
    </g>
  );

  const periodLabel = (m, y) => `${m !== null ? months[m] : 'All'} ${y}`;

  if (isLoading) {
    return (
      <div className="page-loader">
        <div className="spinner-ring" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="small">Loading dashboard...</span>
      </div>
    );
  }

  const statusTiles = [
    { icon: 'bi-folder2-open', title: 'Total Projects', value: stats.totalProjects, compare: compareStats?.totalProjects, tone: 'primary' },
    { icon: 'bi-check2-circle', title: 'Completed', value: stats.completed, compare: compareStats?.completed, tone: 'success' },
    { icon: 'bi-hourglass-split', title: 'In Progress', value: stats.inProgress, compare: compareStats?.inProgress, tone: 'warning' },
    { icon: 'bi-clock-history', title: 'Pending', value: stats.pending, compare: compareStats?.pending, tone: 'info' },
    { icon: 'bi-exclamation-triangle', title: 'Overdue', value: stats.overdue, compare: compareStats?.overdue, tone: 'danger' },
    { icon: 'bi-slash-circle', title: 'Cancelled', value: stats.cancelled, compare: compareStats?.cancelled, tone: 'secondary' },
  ];

  const outstanding = Math.max(0, stats.totalAmount - stats.totalPaid);
  const financeTiles = [
    { icon: 'bi-cash-stack', title: 'Income Generated', display: formatCurrency(stats.totalAmount), rawValue: stats.totalAmount, compare: compareStats?.totalAmount, tone: 'primary', isCurrency: true },
    { icon: 'bi-wallet2', title: 'Total Paid', display: formatCurrency(stats.totalPaid), rawValue: stats.totalPaid, compare: compareStats?.totalPaid, tone: 'success', isCurrency: true },
    { icon: 'bi-exclamation-octagon', title: 'Outstanding', display: formatCurrency(outstanding), rawValue: outstanding, compare: compareStats ? Math.max(0, compareStats.totalAmount - compareStats.totalPaid) : null, tone: 'warning', isCurrency: true },
    { icon: 'bi-file-earmark-word', title: 'Total Words Written', display: stats.totalWords.toLocaleString(), rawValue: stats.totalWords, compare: compareStats?.totalWords, tone: 'accent', isCurrency: false },
  ];

  const statusBadge = (status) =>
    status === 'completed' ? 'pill-success'
      : status === 'in-progress' ? 'pill-warning'
      : status === 'cancelled' ? 'pill-danger'
      : 'pill-secondary';

  const xAxisProps = {
    dataKey: 'month',
    stroke: theme.grid,
    tick: <AngledMonthTick />,
    interval: compact ? 1 : 0,
    height: 60,
  };

  return (
    <div className="dash-root">
      {/* Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">
            <span className="title-chip"><i className="bi bi-pie-chart-fill" aria-hidden="true" /></span>
            Project Dashboard
          </h1>
          <p className="page-sub">Your orders, income and deadlines at a glance.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate('/projects/new')}>
            <i className="bi bi-plus-lg" aria-hidden="true" /> Add Project
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title-sm"><i className="bi bi-funnel" aria-hidden="true" /> Filters &amp; Comparison</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            {[
              { label: 'Filter Month', value: filterMonth, setter: setFilterMonth, options: months },
              { label: 'Filter Year', value: filterYear, setter: setFilterYear, options: years },
              { label: 'Compare Month', value: compareMonth, setter: setCompareMonth, options: months },
              { label: 'Compare Year', value: compareYear, setter: setCompareYear, options: years },
            ].map(({ label, value, setter, options }, index) => (
              <div className="col-6 col-lg-3" key={index}>
                <label className="form-label" htmlFor={`dash-filter-${index}`}>{label}</label>
                <select
                  id={`dash-filter-${index}`}
                  className="form-select"
                  value={value === null ? '' : value}
                  onChange={(e) => setter(e.target.value === '' ? null : Number(e.target.value))}
                >
                  <option value="">{label.includes('Compare') ? 'None' : 'All'}</option>
                  {options.map((opt, idx) => (
                    <option key={idx} value={label.includes('Year') ? opt : idx}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {compareStats && (
            <div className="alert alert-info d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 mb-0 py-2">
              <span className="small">
                <strong>Comparing:</strong> {periodLabel(filterMonth, filterYear)}
                <span className="opacity-75"> vs </span>
                {periodLabel(compareMonth, compareYear)}
              </span>
              <button
                type="button"
                className="btn btn-outline-warning btn-sm"
                onClick={() => { setCompareMonth(null); setCompareYear(null); }}
              >
                <i className="bi bi-x-lg" aria-hidden="true" /> Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />{error}
        </div>
      )}

      {/* Status tiles */}
      <div className="row g-3 mb-3">
        {statusTiles.map(({ icon, title, value, compare, tone }) => (
          <div className="col-6 col-md-4 col-xl-4 col-xxl-2" key={title}>
            <div className={`stat-tile tile-${tone}`}>
              <span className="stat-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span>
              <div className="min-w-0">
                <div className="stat-label">{title}</div>
                <div className="stat-value">{value}</div>
                {getComparisonIndicator(value, compare, false)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Finance tiles */}
      <div className="row g-3 mb-4">
        {financeTiles.map(({ icon, title, display, rawValue, compare, tone, isCurrency }) => (
          <div className="col-12 col-sm-6 col-xl-3" key={title}>
            <div className={`stat-tile tile-${tone}`}>
              <span className="stat-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span>
              <div className="min-w-0">
                <div className="stat-label">{title}</div>
                <div className="stat-value">{display}</div>
                {getComparisonIndicator(rawValue, compare, isCurrency)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status distribution + monthly revenue */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title-sm"><i className="bi bi-pie-chart" aria-hidden="true" /> Project Status Distribution</h5>
              {compareStats && (
                <small className="text-secondary ms-sm-auto">
                  {periodLabel(filterMonth, filterYear)} vs {periodLabel(compareMonth, compareYear)}
                </small>
              )}
            </div>
            <div className="card-body">
              <div className="chart-box">
                {stats.totalProjects === 0 ? (
                  <div className="empty-state">
                    <i className="bi bi-pie-chart" aria-hidden="true" />
                    <span>No projects for the selected period</span>
                  </div>
                ) : compareStats ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Completed', Current: stats.completed, Compare: compareStats.completed },
                        { name: 'In Progress', Current: stats.inProgress, Compare: compareStats.inProgress },
                        { name: 'Pending', Current: stats.pending, Compare: compareStats.pending },
                      ]}
                      margin={{ top: 20, right: 10, left: -10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                      <XAxis dataKey="name" stroke={theme.grid} tick={axisStyle} />
                      <YAxis stroke={theme.grid} tick={axisStyle} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.1)' }} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        wrapperStyle={legendStyle}
                        formatter={(value) => value === 'Current'
                          ? `${months[filterMonth] || 'All'} ${filterYear}`
                          : `${months[compareMonth]} ${compareYear}`
                        }
                      />
                      <Bar dataKey="Current" fill="#00d4ff" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: theme.text, fontSize: 11 }} />
                      <Bar dataKey="Compare" fill="#48bb78" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: theme.text, fontSize: 11 }} />
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
                        label={compact ? false : ({ name, value, percent }) =>
                          value > 0 ? `${name}: ${value} (${(percent * 100).toFixed(0)}%)` : ''
                        }
                        outerRadius={compact ? 80 : 105}
                        dataKey="value"
                        stroke="none"
                        animationBegin={0}
                        animationDuration={1500}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                      {compact && <Legend verticalAlign="bottom" wrapperStyle={legendStyle} />}
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title-sm"><i className="bi bi-cash-coin" aria-hidden="true" /> Monthly Revenue (Last 12 Months)</h5>
            </div>
            <div className="card-body">
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                    <XAxis {...xAxisProps} />
                    <YAxis
                      stroke={theme.grid}
                      tick={axisStyle}
                      width={compact ? 36 : 48}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                    />
                    <Tooltip
                      formatter={(value, name) => [`Ksh.${Number(value).toLocaleString()}`, name]}
                      contentStyle={tooltipStyle}
                      cursor={{ fill: 'rgba(128,128,128,0.1)' }}
                    />
                    <Legend verticalAlign="top" height={30} wrapperStyle={legendStyle} />
                    <Bar dataKey="Paid" stackId="revenue" fill="#48bb78" name="Paid" />
                    <Bar dataKey="Outstanding" stackId="revenue" fill="#f56565" name="Outstanding" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent projects + payment breakdown */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-8">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title-sm">
                <i className="bi bi-folder2-open" aria-hidden="true" /> Recent Projects
                <span className="text-secondary fw-normal text-lowercase small">
                  ({periodLabel(filterMonth, filterYear)})
                </span>
              </h5>
              <button type="button" className="btn btn-outline-primary btn-sm ms-auto" onClick={() => navigate('/projects')}>
                View All <i className="bi bi-arrow-right" aria-hidden="true" />
              </button>
            </div>
            <div className="card-body p-0">
              {recentProjects.length === 0 ? (
                <div className="empty-state" style={{ minHeight: 260 }}>
                  <i className="bi bi-folder2-open" aria-hidden="true" />
                  <span>No projects found for the selected period</span>
                </div>
              ) : (
                <div className="table-responsive scroll-box">
                  <table className="table table-hover table-stack mb-0">
                    <thead>
                      <tr>
                        {['#', 'Topic', 'Ref Code', 'Submission', 'Status', 'Amount'].map((h) => (
                          <th key={h} scope="col">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentProjects.map((project, index) => (
                        <tr
                          key={project.id}
                          onClick={() => navigate(`/projects/edit/${project.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td data-label="#" className="num text-secondary">{index + 1}</td>
                          <td data-label="Topic">{project.topic || '\u2014'}</td>
                          <td data-label="Ref Code" className="mono">{project.orderRefCode}</td>
                          <td data-label="Submission" className="text-nowrap">{new Date(project.submissionDate).toLocaleDateString()}</td>
                          <td data-label="Status">
                            <span className={`pill ${statusBadge(project.status)}`}>{project.status}</span>
                          </td>
                          <td data-label="Amount" className="num text-nowrap">{formatCurrency(Number(project.amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title-sm"><i className="bi bi-wallet2" aria-hidden="true" /> Payment Breakdown</h5>
            </div>
            <div className="card-body">
              {paymentStatusData.length === 0 ? (
                <div className="empty-state" style={{ minHeight: 260 }}>
                  <i className="bi bi-wallet2" aria-hidden="true" />
                  <span>No payment data for the selected period</span>
                </div>
              ) : (
                <>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
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
                  </div>
                  <div className="mt-2">
                    {paymentStatusData.map((entry) => (
                      <div key={entry.name} className="d-flex justify-content-between align-items-center mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: entry.color, flexShrink: 0 }} />
                          <span className="small">{entry.name}</span>
                        </div>
                        <strong className="small">
                          {entry.value} project{entry.value !== 1 ? 's' : ''}
                        </strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trends */}
      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title-sm"><i className="bi bi-graph-up" aria-hidden="true" /> Project Trends (Last 12 Months)</h5>
            </div>
            <div className="card-body">
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={recentMonths} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                    <XAxis {...xAxisProps} />
                    <YAxis stroke={theme.grid} tick={axisStyle} domain={[0, 'auto']} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend verticalAlign="top" height={30} wrapperStyle={legendStyle} />
                    <Line type="monotone" dataKey="totalProjects" name="Total" stroke="#00d4ff" strokeWidth={2.5} dot={{ r: compact ? 3 : 5, fill: '#00d4ff' }} activeDot={{ r: 7 }} />
                    <Line type="monotone" dataKey="completed" name="Completed" stroke="#48bb78" strokeWidth={2.5} dot={{ r: compact ? 3 : 5, fill: '#48bb78' }} activeDot={{ r: 7 }} />
                    <Line type="monotone" dataKey="normal" name="Normal" stroke="#ecc94b" strokeWidth={2.5} dot={{ r: compact ? 3 : 5, fill: '#ecc94b' }} activeDot={{ r: 7 }} />
                    <Line type="monotone" dataKey="dissertation" name="Dissertation" stroke="#f56565" strokeWidth={2.5} dot={{ r: compact ? 3 : 5, fill: '#f56565' }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title-sm"><i className="bi bi-activity" aria-hidden="true" /> Project Type Trend</h5>
            </div>
            <div className="card-body">
              <div className="chart-box">
                {typeTrendArray.length === 0 ? (
                  <div className="empty-state">
                    <i className="bi bi-activity" aria-hidden="true" />
                    <span>No data available</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={typeTrendArray} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                      <XAxis {...xAxisProps} />
                      <YAxis stroke={theme.grid} tick={axisStyle} domain={[0, 'auto']} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend verticalAlign="top" height={30} wrapperStyle={legendStyle} />
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
                            dot={{ r: compact ? 3 : 5, fill: colorMap[type] || COLORS[index % COLORS.length] }}
                            activeDot={{ r: 7 }}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
