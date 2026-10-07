import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useNavigate } from 'react-router-dom';

// Alert type logic 

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

// Type config
const TYPE_CONFIG = {
  'overdue':          { tone: 'danger',    icon: 'bi-exclamation-triangle-fill', label: 'Overdue' },
  'urgent':           { tone: 'warning',   icon: 'bi-alarm-fill',                label: 'Urgent' },
  'due-soon':         { tone: 'info',      icon: 'bi-clock-fill',                label: 'Due Soon' },
  'pending-long':     { tone: 'secondary', icon: 'bi-hourglass-split',           label: 'Long Pending' },
  'in-progress-long': { tone: 'primary',   icon: 'bi-arrow-repeat',              label: 'Long In Progress' },
};

const getTypeConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG['due-soon'];

const STATUS_TONE = {
  completed: 'success',
  'in-progress': 'warning',
  cancelled: 'danger',
  pending: 'secondary',
};

// Sub-components
function TypeBadge({ type }) {
  const cfg = getTypeConfig(type);
  return (
    <span className={`pill pill-${cfg.tone}`}>
      <i className={`bi ${cfg.icon}`} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  return <span className={`pill pill-${STATUS_TONE[status] || 'secondary'}`}>{status}</span>;
}

// Main component

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

  // Fetch 

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

  // Filters & pagination 

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

  // Selection 

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

  //  Bulk actions 

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

  // Lifecycle 

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setCurrentPage(1); }, [filterType, filterRead]);

  // Derived counts 

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

  // Loading state
  if (isLoading) {
    return (
      <div className="page-loader">
        <div className="spinner-ring" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="small">Loading notifications…</span>
      </div>
    );
  }

  const typeFilters = [
    { key: 'all', label: 'All', icon: null, tone: 'primary' },
    { key: 'overdue', label: 'Overdue', icon: 'bi-exclamation-triangle-fill', tone: 'danger' },
    { key: 'urgent', label: 'Urgent', icon: 'bi-alarm-fill', tone: 'warning' },
    { key: 'due-soon', label: 'Due Soon', icon: 'bi-clock-fill', tone: 'info' },
    { key: 'pending-long', label: 'Long Pending', icon: 'bi-hourglass-split', tone: 'secondary' },
    { key: 'in-progress-long', label: 'Long In Progress', icon: 'bi-arrow-repeat', tone: 'primary' },
  ];

  const pagesToShow = Math.min(totalPages, 5);
  const allOnPageSelected =
    currentNotifications.length > 0 &&
    currentNotifications.every(n => selectedNotifications.includes(n.id));

  return (
    <div className="np-root">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            <span className="title-chip"><i className="bi bi-bell-fill" aria-hidden="true" /></span>
            Notifications
          </h1>
          <p className="page-sub">{unreadCount} unread / {notifications.length} total</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-outline-primary" onClick={fetchNotifications}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Refresh
          </button>
          {unreadCount > 0 && (
            <button type="button" className="btn btn-primary" onClick={markAllAsRead}>
              <i className="bi bi-check2-all" aria-hidden="true" /> Mark All Read
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-start gap-2 py-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill mt-1" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-header">
          <h2 className="card-title-sm"><i className="bi bi-funnel" aria-hidden="true" /> Filters</h2>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-lg-7">
              <div className="form-label">Filter by type</div>
              <div className="d-flex flex-wrap gap-2">
                {typeFilters.map(f => (
                  <button
                    key={f.key}
                    type="button"
                    className={`chip chip-${f.tone}${filterType === f.key ? ' active' : ''}`}
                    aria-pressed={filterType === f.key}
                    onClick={() => setFilterType(f.key)}
                  >
                    {f.icon && <i className={`bi ${f.icon}`} aria-hidden="true" />}
                    {f.label} ({typeCounts[f.key]})
                  </button>
                ))}
              </div>
            </div>
            <div className="col-12 col-sm-7 col-lg-3">
              <div className="form-label">Read status</div>
              <div className="seg" role="group" aria-label="Read status">
                {['all', 'unread', 'read'].map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`text-capitalize${filterRead === v ? ' active' : ''}`}
                    aria-pressed={filterRead === v}
                    onClick={() => setFilterRead(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-12 col-sm-5 col-lg-2">
              <label className="form-label" htmlFor="np-per-page">Per page</label>
              <select
                id="np-per-page"
                className="form-select"
                value={itemsPerPage}
                onChange={e => handleItemsPerPageChange(Number(e.target.value))}
              >
                {pageSizeOptions.map(s => <option key={s} value={s}>{s} per page</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedCount > 0 && (
        <div className="alert alert-info d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
          <span className="fw-semibold small">
            {selectedCount} notification{selectedCount > 1 ? 's' : ''} selected
          </span>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-success btn-sm" onClick={() => bulkToggleRead(true)}>
              <i className="bi bi-check2" aria-hidden="true" /> Mark Read
            </button>
            <button type="button" className="btn btn-warning btn-sm" onClick={() => bulkToggleRead(false)}>
              <i className="bi bi-eye" aria-hidden="true" /> Mark Unread
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={bulkDeleteNotifications}>
              <i className="bi bi-trash3" aria-hidden="true" /> Delete
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          {filteredNotifications.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-bell-slash" aria-hidden="true" />
              <strong>No notifications to display</strong>
              <span className="small">
                {filterType !== 'all' || filterRead !== 'all'
                  ? 'Try adjusting your filters'
                  : "You're all caught up!"}
              </span>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover table-stack align-middle">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          aria-label="Select all on this page"
                          checked={allOnPageSelected}
                          onChange={toggleAllCurrentPage}
                        />
                      </th>
                      {['#', 'Project', 'Reference', 'Submission', 'Status', 'Alert Type', 'Due', 'Actions'].map(h => (
                        <th key={h} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentNotifications.map((notif, index) => {
                      const isSelected = selectedNotifications.includes(notif.id);
                      return (
                        <tr
                          key={notif.id}
                          className={`${isSelected ? 'row-selected ' : ''}${notif.isRead ? '' : 'row-unread'}`}
                        >
                          <td data-label="Select">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              aria-label={`Select ${notif.title}`}
                              checked={isSelected}
                              onChange={() => toggleSelection(notif.id)}
                            />
                          </td>
                          <td data-label="#" className="num text-secondary">{indexOfFirstItem + index + 1}</td>
                          <td
                            data-label="Project"
                            style={{ cursor: 'pointer', maxWidth: 260 }}
                            onClick={() => navigate(`/projects/edit/${notif.projectId}`)}
                          >
                            <div className="d-flex align-items-center gap-2 justify-content-end justify-content-md-start">
                              {!notif.isRead && (
                                <span className="rounded-circle flex-shrink-0" style={{ width: 8, height: 8, background: 'var(--app-primary)' }} aria-label="Unread" />
                              )}
                              <span className="truncate">{notif.title}</span>
                            </div>
                          </td>
                          <td data-label="Reference" className="mono text-secondary">{notif.refCode}</td>
                          <td data-label="Submission" className="text-nowrap">{new Date(notif.submissionDate).toLocaleDateString()}</td>
                          <td data-label="Status"><StatusBadge status={notif.status} /></td>
                          <td data-label="Alert Type"><TypeBadge type={notif.type} /></td>
                          <td data-label="Due" className="text-nowrap">
                            {notif.status !== 'completed' && notif.daysUntilDue !== undefined ? (
                              <span className={notif.daysUntilDue < 0 ? 'text-ink-danger fw-bold' : ''}>
                                {notif.daysUntilDue < 0
                                  ? `${Math.abs(notif.daysUntilDue)}d overdue`
                                  : `${notif.daysUntilDue}d left`}
                              </span>
                            ) : '\u2014'}
                          </td>
                          <td data-label="Actions">
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className={`btn btn-sm ${notif.isRead ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
                                title={notif.isRead ? 'Mark unread' : 'Mark read'}
                                aria-label={notif.isRead ? 'Mark unread' : 'Mark read'}
                                onClick={() => {
                                  setSelectedNotifications([notif.id]);
                                  bulkToggleRead(!notif.isRead);
                                }}
                              >
                                <i className={`bi ${notif.isRead ? 'bi-eye' : 'bi-check2'}`} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                title="Delete"
                                aria-label="Delete"
                                onClick={() => {
                                  setSelectedNotifications([notif.id]);
                                  bulkDeleteNotifications();
                                }}
                              >
                                <i className="bi bi-trash3" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <hr />

              <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
                <p className="small text-secondary mb-0">
                  Showing <strong className="text-body">{indexOfFirstItem + 1}</strong>
                  {' '}&ndash;{' '}
                  <strong className="text-body">{Math.min(indexOfLastItem, filteredNotifications.length)}</strong>
                  {' '}of{' '}
                  <strong className="text-body">{filteredNotifications.length}</strong> entries
                </p>

                <nav aria-label="Notification pages">
                  <ul className="pagination mb-0 justify-content-center">
                    <li className={`page-item${currentPage === 1 ? ' disabled' : ''}`}>
                      <button type="button" className="page-link" onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">
                        <i className="bi bi-chevron-left" aria-hidden="true" />
                      </button>
                    </li>
                    {[...Array(pagesToShow)].map((_, i) => {
                      let pageNumber;
                      if (totalPages <= 5)                    pageNumber = i + 1;
                      else if (currentPage <= 3)              pageNumber = i + 1;
                      else if (currentPage >= totalPages - 2) pageNumber = totalPages - 4 + i;
                      else                                    pageNumber = currentPage - 2 + i;
                      return (
                        <li key={pageNumber} className={`page-item${currentPage === pageNumber ? ' active' : ''}`}>
                          <button type="button" className="page-link" onClick={() => paginate(pageNumber)}>
                            {pageNumber}
                          </button>
                        </li>
                      );
                    })}
                    <li className={`page-item${currentPage === totalPages ? ' disabled' : ''}`}>
                      <button type="button" className="page-link" onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page">
                        <i className="bi bi-chevron-right" aria-hidden="true" />
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationPage;
