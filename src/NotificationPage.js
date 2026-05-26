import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaBell, FaCheck, FaEye, FaTrash, FaChevronLeft, FaChevronRight,
  FaFilter, FaCheckDouble, FaExclamationTriangle, FaClock,
  FaHourglassHalf, FaSync
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const MONO = "'IBM Plex Mono', 'Fira Code', 'Cascadia Code', monospace";

// ── Primitives ────────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: '0.68rem', fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6c757d',
      borderBottom: '1px solid #dee2e6', paddingBottom: '0.4rem', marginBottom: '0.85rem',
    }}>{children}</div>
  );
}

function Divider() {
  return <div style={{ height: '1px', background: '#dee2e6', margin: '0.85rem 0' }} />;
}

function FL({ children }) {
  return (
    <label style={{
      display: 'block', fontFamily: MONO, fontSize: '0.68rem', fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase', color: '#495057',
      marginBottom: '0.35rem',
    }}>{children}</label>
  );
}

const inputBase = {
  fontFamily: MONO, fontSize: '0.82rem',
  background: '#fff', border: '1px solid #ced4da', borderRadius: '4px',
  color: '#212529', padding: '0.42rem 0.75rem', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

function FS({ style, children, ...p }) {
  return (
    <select
      style={{
        ...inputBase,
        appearance: 'none', cursor: 'pointer', paddingRight: '2rem',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236c757d' stroke-width='1.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', ...style,
      }}
      onFocus={e => { e.target.style.borderColor = '#86b7fe'; e.target.style.boxShadow = '0 0 0 3px rgba(13,110,253,0.15)'; }}
      onBlur={e => { e.target.style.borderColor = '#ced4da'; e.target.style.boxShadow = 'none'; }}
      {...p}
    >{children}</select>
  );
}

// ── Alert type logic ───────────────────────────────────────────────────────────

const computeAlertType = (project, currentDate) => {
  const submissionDate = new Date(project.submissionDate);
  const timeDiff = submissionDate - currentDate;
  const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));

  const settled = project.status === 'completed' || project.status === 'cancelled';
  if (settled) return null;

  const isOverdue        = daysDiff < 0;
  const isUrgent         = daysDiff <= 1 && daysDiff >= 0;
  const isDueSoon        = daysDiff <= 2 && daysDiff > 1;
  const isPendingLong    = project.status === 'pending' &&
    (currentDate - new Date(project.orderDate)) / (1000 * 3600 * 24) > 7;
  const isInProgressLong = project.status === 'in-progress' &&
    (currentDate - new Date(project.lastUpdated || project.orderDate)) / (1000 * 3600 * 24) > 14;

  if (isOverdue)         return 'overdue';
  if (isUrgent)          return 'urgent';
  if (isDueSoon)         return 'due-soon';
  if (isPendingLong)     return 'pending-long';
  if (isInProgressLong)  return 'in-progress-long';
  return null;
};

// ── Type config ────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  'overdue':          { color: '#dc3545', bg: '#f8d7da', border: '#f5c2c7', icon: FaExclamationTriangle, label: 'Overdue'          },
  'urgent':           { color: '#856404', bg: '#fff3cd', border: '#ffda6a', icon: FaClock,               label: 'Urgent'           },
  'due-soon':         { color: '#055160', bg: '#cff4fc', border: '#9eeaf9', icon: FaClock,               label: 'Due Soon'         },
  'pending-long':     { color: '#495057', bg: '#e9ecef', border: '#ced4da', icon: FaHourglassHalf,       label: 'Long Pending'     },
  'in-progress-long': { color: '#084298', bg: '#cfe2ff', border: '#9ec5fe', icon: FaSync,                label: 'Long In Progress' },
};

const getTypeConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG['due-soon'];

// ── Sub-components ─────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const cfg = getTypeConfig(type);
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      fontFamily: MONO, fontSize: '0.65rem', fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: '4px', padding: '0.22rem 0.55rem',
    }}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    completed:    { color: '#0f5132', bg: '#d1e7dd', border: '#a3cfbb' },
    'in-progress':{ color: '#664d03', bg: '#fff3cd', border: '#ffda6a' },
    cancelled:    { color: '#842029', bg: '#f8d7da', border: '#f5c2c7' },
    pending:      { color: '#495057', bg: '#e9ecef', border: '#ced4da' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: MONO, fontSize: '0.65rem', fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: '4px', padding: '0.22rem 0.55rem',
    }}>
      {status}
    </span>
  );
}

function FilterPill({ active, color, onClick, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: MONO, fontSize: '0.72rem', fontWeight: active ? 700 : 500,
        letterSpacing: '0.04em',
        padding: '0.3rem 0.85rem', borderRadius: '20px',
        border: `2px solid ${active || hovered ? color : '#dee2e6'}`,
        background: active ? color : hovered ? color + '18' : 'transparent',
        color: active ? '#fff' : hovered ? color : '#6c757d',
        cursor: 'pointer', transition: 'all 0.2s',
        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
        marginRight: '0.4rem', marginBottom: '0.4rem',
      }}
    >
      {children}
    </button>
  );
}

function IconBtn({ onClick, title, variant = 'secondary', children }) {
  const colors = {
    primary:   { bg: '#0d6efd', hover: '#0b5ed7', text: '#fff' },
    success:   { bg: '#198754', hover: '#157347', text: '#fff' },
    danger:    { bg: '#dc3545', hover: '#bb2d3b', text: '#fff' },
    secondary: { bg: '#6c757d', hover: '#5c636a', text: '#fff' },
    warning:   { bg: '#ffc107', hover: '#ffca2c', text: '#212529' },
    light:     { bg: '#f8f9fa', hover: '#e9ecef', text: '#212529' },
  };
  const c = colors[variant] || colors.secondary;
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: MONO, fontSize: '0.75rem', fontWeight: 600,
        letterSpacing: '0.03em',
        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
        padding: '0.38rem 0.75rem', borderRadius: '4px', border: 'none',
        background: hovered ? c.hover : c.bg, color: c.text,
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

function NotificationPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications]               = useState([]);
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [isLoading, setIsLoading]                       = useState(true);
  const [error, setError]                               = useState('');
  const [filterType, setFilterType]                     = useState('all');
  const [filterRead, setFilterRead]                     = useState('all');
  const [currentPage, setCurrentPage]                   = useState(1);
  const [itemsPerPage, setItemsPerPage]                 = useState(10);
  const pageSizeOptions = [5, 10, 20, 50];

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const currentDate = new Date();
      const [projectsSnapshot, notificationsSnapshot] = await Promise.all([
        getDocs(collection(db, 'projects')),
        getDocs(collection(db, 'notifications')),
      ]);

      const projectsData = projectsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const existingMap  = {};
      notificationsSnapshot.docs.forEach(d => {
        const data = d.data();
        if (data.projectId) existingMap[data.projectId] = { id: d.id, ...data };
      });

      const validNotifIds = new Set();

      const notificationList = await Promise.all(
        projectsData.map(async project => {
          const alertType = computeAlertType(project, currentDate);
          const existing  = existingMap[project.id];

          if (!alertType) {
            if (existing) await deleteDoc(doc(db, 'notifications', existing.id));
            return null;
          }

          if (!existing) {
            const submissionDate = new Date(project.submissionDate);
            const daysDiff = Math.round((submissionDate - currentDate) / (1000 * 3600 * 24));
            const newNotif = {
              projectId:      project.id,
              title:          project.topic || 'Untitled Project',
              refCode:        project.orderRefCode,
              submissionDate: project.submissionDate,
              status:         project.status,
              isRead:         false,
              isViewed:       false,
              type:           alertType,
              daysUntilDue:   daysDiff,
              createdAt:      new Date().toISOString(),
            };
            const docRef = await addDoc(collection(db, 'notifications'), newNotif);
            const created = { id: docRef.id, ...newNotif };
            validNotifIds.add(docRef.id);
            return created;
          }

          validNotifIds.add(existing.id);
          const submissionDate = new Date(project.submissionDate);
          const daysDiff = Math.round((submissionDate - currentDate) / (1000 * 3600 * 24));

          if (existing.type !== alertType || existing.status !== project.status) {
            await updateDoc(doc(db, 'notifications', existing.id), {
              type: alertType, status: project.status,
              daysUntilDue: daysDiff, lastUpdated: new Date().toISOString(),
            });
          }

          return {
            id:             existing.id,
            projectId:      project.id,
            title:          project.topic || 'Untitled Project',
            refCode:        project.orderRefCode,
            submissionDate: project.submissionDate,
            status:         project.status,
            isRead:         existing.isRead || false,
            isViewed:       existing.isViewed || false,
            type:           alertType,
            daysUntilDue:   daysDiff,
            isDue:          ['overdue', 'urgent', 'due-soon'].includes(alertType),
            createdAt:      existing.createdAt || new Date().toISOString(),
          };
        })
      );

      const orphanDeletions = notificationsSnapshot.docs
        .filter(d => d.data().projectId && !validNotifIds.has(d.id))
        .map(d => deleteDoc(doc(db, 'notifications', d.id)));
      await Promise.all(orphanDeletions);

      const result = notificationList
        .filter(Boolean)
        .sort((a, b) => {
          if (a.isDue && !b.isDue) return -1;
          if (b.isDue && !a.isDue) return 1;
          return new Date(b.submissionDate) - new Date(a.submissionDate);
        });

      setNotifications(result);
    } catch (err) {
      setError('Error fetching notifications: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Filters & pagination ───────────────────────────────────────────────────

  const filteredNotifications = notifications.filter(notif => {
    const typeMatch = filterType === 'all' || notif.type === filterType;
    const readMatch =
      filterRead === 'all' ||
      (filterRead === 'read'   &&  notif.isRead) ||
      (filterRead === 'unread' && !notif.isRead);
    return typeMatch && readMatch;
  });

  const indexOfLastItem       = currentPage * itemsPerPage;
  const indexOfFirstItem      = indexOfLastItem - itemsPerPage;
  const currentNotifications  = filteredNotifications.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages            = Math.ceil(filteredNotifications.length / itemsPerPage);

  const paginate = (page) => setCurrentPage(page);

  const handleItemsPerPageChange = (newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleSelection = (id) => {
    setSelectedNotifications(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAllCurrentPage = () => {
    const ids = currentNotifications.map(n => n.id);
    const allSelected = ids.every(id => selectedNotifications.includes(id));
    if (allSelected) {
      setSelectedNotifications(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedNotifications(prev => Array.from(new Set([...prev, ...ids])));
    }
  };

  // ── Bulk actions ───────────────────────────────────────────────────────────

  const bulkToggleRead = async (markAsRead) => {
    try {
      const valid = selectedNotifications.filter(id => notifications.some(n => n.id === id));
      if (!valid.length) return;
      await Promise.all(valid.map(id =>
        updateDoc(doc(db, 'notifications', id), { isRead: markAsRead, lastUpdated: new Date().toISOString() })
      ));
      setNotifications(prev => prev.map(n => valid.includes(n.id) ? { ...n, isRead: markAsRead } : n));
      setSelectedNotifications([]);
    } catch (err) {
      setError(`Error updating notifications: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const bulkDeleteNotifications = async () => {
    if (!window.confirm(`Delete ${selectedNotifications.length} notification(s)?`)) return;
    try {
      const valid = selectedNotifications.filter(id => notifications.some(n => n.id === id));
      if (!valid.length) return;
      await Promise.all(valid.map(id => deleteDoc(doc(db, 'notifications', id))));
      setNotifications(prev => prev.filter(n => !valid.includes(n.id)));
      setSelectedNotifications([]);
    } catch (err) {
      setError(`Error deleting notifications: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = filteredNotifications.filter(n => !n.isRead);
      if (!unread.length) return;
      await Promise.all(unread.map(n =>
        updateDoc(doc(db, 'notifications', n.id), { isRead: true, lastUpdated: new Date().toISOString() })
      ));
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      setError(`Error marking all read: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setCurrentPage(1); }, [filterType, filterRead]);

  // ── Derived counts ─────────────────────────────────────────────────────────

  const unreadCount   = notifications.filter(n => !n.isRead).length;
  const selectedCount = selectedNotifications.length;
  const typeCounts    = {
    all:               notifications.length,
    overdue:           notifications.filter(n => n.type === 'overdue').length,
    urgent:            notifications.filter(n => n.type === 'urgent').length,
    'due-soon':        notifications.filter(n => n.type === 'due-soon').length,
    'pending-long':    notifications.filter(n => n.type === 'pending-long').length,
    'in-progress-long':notifications.filter(n => n.type === 'in-progress-long').length,
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#1a1f2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '0.75rem',
      }}>
        <div style={{
          width: '2rem', height: '2rem', border: '3px solid rgba(13,110,253,0.25)',
          borderTopColor: '#0d6efd', borderRadius: '50%', animation: 'spin 0.7s linear infinite',
        }} />
        <p style={{ fontFamily: MONO, fontSize: '0.75rem', color: '#6c757d', margin: 0 }}>
          Loading notifications…
        </p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        .notif-row:hover { background: #f0f4ff !important; }
        .notif-row-selected { background: #e7f0ff !important; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#1a1f2e', padding: '1.25rem 1.5rem', fontFamily: MONO }}>
        <div style={{ animation: 'fadeIn 0.3s ease' }}>

          {/* ── Main Card ── */}
          <div style={{ background: '#fff', borderRadius: '6px', boxShadow: '0 2px 12px rgba(0,0,0,0.3)', overflow: 'hidden' }}>

            {/* Card Header */}
            <div style={{ background: '#0d6efd', padding: '0.85rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h2 style={{ fontFamily: MONO, fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaBell size={16} /> Notifications
                  </h2>
                  <span style={{
                    fontFamily: MONO, fontSize: '0.72rem', fontWeight: 600,
                    background: 'rgba(255,255,255,0.2)', color: '#fff',
                    borderRadius: '4px', padding: '0.2rem 0.55rem', letterSpacing: '0.04em',
                  }}>
                    {unreadCount} unread / {notifications.length} total
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={fetchNotifications}
                    style={{
                      fontFamily: MONO, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.03em',
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.38rem 0.75rem', borderRadius: '4px', border: 'none',
                      background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                  >
                    <FaSync size={12} /> Refresh
                  </button>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      style={{
                        fontFamily: MONO, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.03em',
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.38rem 0.75rem', borderRadius: '4px', border: 'none',
                        background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                    >
                      <FaCheckDouble size={12} /> Mark All Read
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div style={{ padding: '1.25rem' }}>

              {/* Error */}
              {error && (
                <div style={{
                  fontFamily: MONO, fontSize: '0.8rem',
                  background: '#f8d7da', border: '1px solid #f5c2c7',
                  borderRadius: '4px', color: '#842029',
                  padding: '0.6rem 0.85rem', marginBottom: '1rem',
                  display: 'flex', gap: '0.45rem', animation: 'slideIn 0.2s ease',
                }}>
                  <span>⚠</span><span>{error}</span>
                </div>
              )}

              {/* ── Filters ── */}
              <SectionLabel><FaFilter style={{ marginRight: '0.4rem' }} />Filters</SectionLabel>
              <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '6px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'start' }}>

                  {/* Type filters */}
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6c757d', marginBottom: '0.5rem' }}>Filter by Type</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                      <FilterPill active={filterType === 'all'}               color="#0d6efd" onClick={() => setFilterType('all')}>All ({typeCounts.all})</FilterPill>
                      <FilterPill active={filterType === 'overdue'}           color="#dc3545" onClick={() => setFilterType('overdue')}><FaExclamationTriangle size={10} />Overdue ({typeCounts.overdue})</FilterPill>
                      <FilterPill active={filterType === 'urgent'}            color="#856404" onClick={() => setFilterType('urgent')}><FaClock size={10} />Urgent ({typeCounts.urgent})</FilterPill>
                      <FilterPill active={filterType === 'due-soon'}          color="#055160" onClick={() => setFilterType('due-soon')}><FaClock size={10} />Due Soon ({typeCounts['due-soon']})</FilterPill>
                      <FilterPill active={filterType === 'pending-long'}      color="#495057" onClick={() => setFilterType('pending-long')}><FaHourglassHalf size={10} />Long Pending ({typeCounts['pending-long']})</FilterPill>
                      <FilterPill active={filterType === 'in-progress-long'}  color="#084298" onClick={() => setFilterType('in-progress-long')}><FaSync size={10} />Long In Progress ({typeCounts['in-progress-long']})</FilterPill>
                    </div>
                  </div>

                  {/* Read status + page size */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: '160px' }}>
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6c757d', marginBottom: '0.4rem' }}>Read Status</div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {['all', 'unread', 'read'].map(v => (
                          <button key={v} onClick={() => setFilterRead(v)}
                            style={{
                              fontFamily: MONO, fontSize: '0.72rem', fontWeight: filterRead === v ? 700 : 500,
                              padding: '0.28rem 0.65rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                              background: filterRead === v ? '#0d6efd' : '#e9ecef',
                              color: filterRead === v ? '#fff' : '#495057',
                              transition: 'all 0.15s', textTransform: 'capitalize',
                            }}
                          >{v}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <FL>Per Page</FL>
                      <FS
                        value={itemsPerPage}
                        onChange={e => handleItemsPerPageChange(Number(e.target.value))}
                        style={{ width: '100%' }}
                      >
                        {pageSizeOptions.map(s => <option key={s} value={s}>{s} per page</option>)}
                      </FS>
                    </div>
                  </div>

                </div>
              </div>

              {/* ── Bulk Actions Bar ── */}
              {selectedCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: '#cfe2ff', border: '1px solid #9ec5fe', borderRadius: '4px',
                    padding: '0.6rem 0.85rem', marginBottom: '0.85rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
                    animation: 'slideIn 0.2s ease',
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: '0.78rem', color: '#084298', fontWeight: 600 }}>
                    {selectedCount} notification{selectedCount > 1 ? 's' : ''} selected
                  </span>
                  <div style={{ display: 'flex', gap: '0.45rem' }}>
                    <IconBtn variant="success" onClick={() => bulkToggleRead(true)}><FaCheck size={11} /> Mark Read</IconBtn>
                    <IconBtn variant="warning" onClick={() => bulkToggleRead(false)}><FaEye size={11} /> Mark Unread</IconBtn>
                    <IconBtn variant="danger" onClick={bulkDeleteNotifications}><FaTrash size={11} /> Delete</IconBtn>
                  </div>
                </motion.div>
              )}

              {/* ── Empty State ── */}
              {filteredNotifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <FaBell size={48} style={{ color: '#dee2e6', marginBottom: '0.85rem' }} />
                  <p style={{ fontFamily: MONO, fontSize: '0.9rem', fontWeight: 700, color: '#495057', margin: '0 0 0.3rem' }}>
                    No notifications to display
                  </p>
                  <p style={{ fontFamily: MONO, fontSize: '0.75rem', color: '#adb5bd', margin: 0 }}>
                    {filterType !== 'all' || filterRead !== 'all'
                      ? 'Try adjusting your filters'
                      : "You're all caught up!"}
                  </p>
                </div>
              ) : (
                <>
                  {/* ── Table ── */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                          <th style={{ padding: '0.55rem 0.5rem', width: '36px' }}>
                            <input
                              type="checkbox"
                              checked={
                                currentNotifications.length > 0 &&
                                currentNotifications.every(n => selectedNotifications.includes(n.id))
                              }
                              onChange={toggleAllCurrentPage}
                              style={{ cursor: 'pointer', accentColor: '#0d6efd' }}
                            />
                          </th>
                          {['#', 'Project', 'Reference', 'Submission', 'Status', 'Alert Type', 'Due', 'Actions'].map(h => (
                            <th key={h} style={{
                              padding: '0.55rem 0.65rem', textAlign: 'left',
                              fontFamily: MONO, fontSize: '0.65rem', fontWeight: 700,
                              letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6c757d',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence>
                          {currentNotifications.map((notif, index) => {
                            const isSelected = selectedNotifications.includes(notif.id);
                            return (
                              <motion.tr
                                key={notif.id}
                                className={`notif-row${isSelected ? ' notif-row-selected' : ''}`}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 12, transition: { duration: 0.18 } }}
                                transition={{ duration: 0.25, delay: index * 0.02 }}
                                style={{
                                  borderBottom: '1px solid #f0f0f0',
                                  fontWeight: notif.isRead ? 400 : 600,
                                  background: isSelected ? '#e7f0ff' : 'transparent',
                                }}
                              >
                                {/* Checkbox */}
                                <td style={{ padding: '0.55rem 0.5rem' }} onClick={e => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelection(notif.id)}
                                    style={{ cursor: 'pointer', accentColor: '#0d6efd' }}
                                  />
                                </td>

                                {/* # */}
                                <td style={{ padding: '0.55rem 0.65rem', color: '#adb5bd', fontSize: '0.72rem' }}>
                                  {indexOfFirstItem + index + 1}
                                </td>

                                {/* Project title */}
                                <td
                                  style={{ padding: '0.55rem 0.65rem', cursor: 'pointer', maxWidth: '220px' }}
                                  onClick={() => navigate(`/projects/edit/${notif.projectId}`)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    {!notif.isRead && (
                                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0d6efd', flexShrink: 0, display: 'inline-block' }} />
                                    )}
                                    <span style={{
                                      color: '#212529', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                      fontWeight: notif.isRead ? 400 : 700,
                                    }}>
                                      {notif.title}
                                    </span>
                                  </div>
                                </td>

                                {/* Ref code */}
                                <td style={{ padding: '0.55rem 0.65rem', color: '#6c757d', fontSize: '0.75rem' }}>
                                  {notif.refCode}
                                </td>

                                {/* Submission date */}
                                <td style={{ padding: '0.55rem 0.65rem', color: '#495057', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                                  {new Date(notif.submissionDate).toLocaleDateString()}
                                </td>

                                {/* Status */}
                                <td style={{ padding: '0.55rem 0.65rem' }}>
                                  <StatusBadge status={notif.status} />
                                </td>

                                {/* Alert type */}
                                <td style={{ padding: '0.55rem 0.65rem' }}>
                                  <TypeBadge type={notif.type} />
                                </td>

                                {/* Days until due */}
                                <td style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                                  {notif.status !== 'completed' && notif.daysUntilDue !== undefined ? (
                                    <span style={{
                                      color: notif.daysUntilDue < 0 ? '#dc3545' : '#495057',
                                      fontWeight: notif.daysUntilDue < 0 ? 700 : 400,
                                    }}>
                                      {notif.daysUntilDue < 0
                                        ? `${Math.abs(notif.daysUntilDue)}d overdue`
                                        : `${notif.daysUntilDue}d left`}
                                    </span>
                                  ) : '—'}
                                </td>

                                {/* Actions */}
                                <td style={{ padding: '0.55rem 0.65rem' }} onClick={e => e.stopPropagation()}>
                                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                                    <button
                                      title={notif.isRead ? 'Mark unread' : 'Mark read'}
                                      onClick={() => {
                                        setSelectedNotifications([notif.id]);
                                        bulkToggleRead(!notif.isRead);
                                      }}
                                      style={{
                                        fontFamily: MONO, fontSize: '0.72rem', fontWeight: 600,
                                        padding: '0.28rem 0.55rem', borderRadius: '4px', cursor: 'pointer',
                                        border: `1px solid ${notif.isRead ? '#ced4da' : '#0d6efd'}`,
                                        background: 'transparent',
                                        color: notif.isRead ? '#6c757d' : '#0d6efd',
                                        transition: 'all 0.15s',
                                        display: 'inline-flex', alignItems: 'center',
                                      }}
                                    >
                                      {notif.isRead ? <FaEye size={11} /> : <FaCheck size={11} />}
                                    </button>
                                    <button
                                      title="Delete"
                                      onClick={() => {
                                        setSelectedNotifications([notif.id]);
                                        bulkDeleteNotifications();
                                      }}
                                      style={{
                                        fontFamily: MONO, fontSize: '0.72rem', fontWeight: 600,
                                        padding: '0.28rem 0.55rem', borderRadius: '4px', cursor: 'pointer',
                                        border: '1px solid #f5c2c7',
                                        background: 'transparent', color: '#dc3545',
                                        transition: 'all 0.15s',
                                        display: 'inline-flex', alignItems: 'center',
                                      }}
                                    >
                                      <FaTrash size={11} />
                                    </button>
                                  </div>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>

                  <Divider />

                  {/* ── Pagination ── */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <p style={{ fontFamily: MONO, fontSize: '0.72rem', color: '#6c757d', margin: 0 }}>
                      Showing{' '}
                      <span style={{ fontWeight: 700, color: '#212529' }}>{indexOfFirstItem + 1}</span>
                      {' '}–{' '}
                      <span style={{ fontWeight: 700, color: '#212529' }}>{Math.min(indexOfLastItem, filteredNotifications.length)}</span>
                      {' '}of{' '}
                      <span style={{ fontWeight: 700, color: '#212529' }}>{filteredNotifications.length}</span>
                      {' '}entries
                    </p>

                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <button
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        style={{
                          fontFamily: MONO, fontSize: '0.75rem', fontWeight: 600,
                          padding: '0.32rem 0.6rem', borderRadius: '4px', border: '1px solid #dee2e6',
                          background: currentPage === 1 ? '#f8f9fa' : '#fff',
                          color: currentPage === 1 ? '#adb5bd' : '#495057',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          display: 'inline-flex', alignItems: 'center',
                        }}
                      >
                        <FaChevronLeft size={11} />
                      </button>

                      {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                        let pageNumber;
                        if (totalPages <= 5)                    pageNumber = i + 1;
                        else if (currentPage <= 3)              pageNumber = i + 1;
                        else if (currentPage >= totalPages - 2) pageNumber = totalPages - 4 + i;
                        else                                    pageNumber = currentPage - 2 + i;

                        return (
                          <button
                            key={pageNumber}
                            onClick={() => paginate(pageNumber)}
                            style={{
                              fontFamily: MONO, fontSize: '0.75rem', fontWeight: currentPage === pageNumber ? 700 : 500,
                              padding: '0.32rem 0.65rem', borderRadius: '4px',
                              border: `1px solid ${currentPage === pageNumber ? '#0d6efd' : '#dee2e6'}`,
                              background: currentPage === pageNumber ? '#0d6efd' : '#fff',
                              color: currentPage === pageNumber ? '#fff' : '#495057',
                              cursor: 'pointer', transition: 'all 0.15s', minWidth: '34px',
                            }}
                          >
                            {pageNumber}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        style={{
                          fontFamily: MONO, fontSize: '0.75rem', fontWeight: 600,
                          padding: '0.32rem 0.6rem', borderRadius: '4px', border: '1px solid #dee2e6',
                          background: currentPage === totalPages ? '#f8f9fa' : '#fff',
                          color: currentPage === totalPages ? '#adb5bd' : '#495057',
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          display: 'inline-flex', alignItems: 'center',
                        }}
                      >
                        <FaChevronRight size={11} />
                      </button>
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default NotificationPage;