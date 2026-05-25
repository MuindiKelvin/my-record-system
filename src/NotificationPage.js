import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaBell, FaCheck, FaEye, FaTrash, FaChevronLeft, FaChevronRight,
  FaFilter, FaCheckDouble, FaExclamationTriangle, FaClock,
  FaHourglassHalf, FaSync
} from 'react-icons/fa';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

const StyledCard = styled(motion.div)`
  border-radius: 15px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const FilterBadge = styled.button`
  padding: 6px 14px;
  border-radius: 20px;
  border: 2px solid ${props => props.active ? props.color : '#dee2e6'};
  background: ${props => props.active ? props.color : 'transparent'};
  color: ${props => props.active ? '#fff' : '#6c757d'};
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-right: 8px;
  margin-bottom: 8px;

  &:hover {
    background: ${props => props.color};
    color: #fff;
    border-color: ${props => props.color};
    transform: translateY(-2px);
  }
`;

const NotificationBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  gap: 4px;
`;

const ActionButton = styled(motion.button)`
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

// A project is "settled" when it no longer needs any alert.
// This is the single source of truth used for both creation and deletion decisions.
const computeAlertType = (project, currentDate) => {
  const submissionDate = new Date(project.submissionDate);
  const timeDiff = submissionDate - currentDate;
  const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));

  const settled =
    project.status === 'completed' ||
    project.status === 'cancelled';

  if (settled) return null;

  const isOverdue       = daysDiff < 0;
  const isUrgent        = daysDiff <= 1 && daysDiff >= 0;
  const isDueSoon       = daysDiff <= 2 && daysDiff > 1;
  const isPendingLong   = project.status === 'pending' &&
    (currentDate - new Date(project.orderDate)) / (1000 * 3600 * 24) > 7;
  const isInProgressLong = project.status === 'in-progress' &&
    (currentDate - new Date(project.lastUpdated || project.orderDate)) / (1000 * 3600 * 24) > 14;

  if (isOverdue)        return 'overdue';
  if (isUrgent)         return 'urgent';
  if (isDueSoon)        return 'due-soon';
  if (isPendingLong)    return 'pending-long';
  if (isInProgressLong) return 'in-progress-long';

  return null; // no alert needed
};

function NotificationPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications]           = useState([]);
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [isLoading, setIsLoading]                   = useState(true);
  const [error, setError]                           = useState('');
  const [filterType, setFilterType]                 = useState('all');
  const [filterRead, setFilterRead]                 = useState('all');

  const [currentPage, setCurrentPage]   = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const pageSizeOptions = [5, 10, 20, 50];

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const currentDate = new Date();

      // Load projects and existing notification documents in parallel
      const [projectsSnapshot, notificationsSnapshot] = await Promise.all([
        getDocs(collection(db, 'projects')),
        getDocs(collection(db, 'notifications'))
      ]);

      const projectsData = projectsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Build a map of projectId -> notification doc for O(1) lookup
      const existingMap = {};
      notificationsSnapshot.docs.forEach(d => {
        const data = d.data();
        if (data.projectId) existingMap[data.projectId] = { id: d.id, ...data };
      });

      // Track which notification doc IDs are still valid after this pass
      const validNotifIds = new Set();

      const notificationList = await Promise.all(
        projectsData.map(async project => {
          const alertType = computeAlertType(project, currentDate);
          const existing  = existingMap[project.id];

          // Project is settled or needs no alert: delete its notification if one exists
          if (!alertType) {
            if (existing) {
              await deleteDoc(doc(db, 'notifications', existing.id));
            }
            return null;
          }

          // Project needs an alert
          if (!existing) {
            // Create a fresh notification document
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
              createdAt:      new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, 'notifications'), newNotif);
            const created = { id: docRef.id, ...newNotif };
            validNotifIds.add(docRef.id);
            return created;
          }

          // Existing notification — keep it, update type if it has changed
          validNotifIds.add(existing.id);
          const submissionDate = new Date(project.submissionDate);
          const daysDiff = Math.round((submissionDate - currentDate) / (1000 * 3600 * 24));

          if (existing.type !== alertType || existing.status !== project.status) {
            await updateDoc(doc(db, 'notifications', existing.id), {
              type:         alertType,
              status:       project.status,
              daysUntilDue: daysDiff,
              lastUpdated:  new Date().toISOString()
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
            createdAt:      existing.createdAt || new Date().toISOString()
          };
        })
      );

      // Also delete any notification docs whose projectId no longer maps to any project
      // (handles the case where a project was deleted from Firestore entirely)
      const orphanDeletions = notificationsSnapshot.docs
        .filter(d => {
          const data = d.data();
          // It has a projectId but it's not in our valid set and wasn't already deleted above
          return data.projectId && !validNotifIds.has(d.id);
        })
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

  //  Filters 

  const filteredNotifications = notifications.filter(notif => {
    const typeMatch = filterType === 'all' || notif.type === filterType;
    const readMatch =
      filterRead === 'all' ||
      (filterRead === 'read'   &&  notif.isRead) ||
      (filterRead === 'unread' && !notif.isRead);
    return typeMatch && readMatch;
  });

  const indexOfLastItem  = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentNotifications = filteredNotifications.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleItemsPerPageChange = (newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  //  Selection helpers 

  const toggleNotificationSelection = (id) => {
    setSelectedNotifications(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAllCurrentPageSelections = () => {
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
      if (valid.length === 0) return;

      await Promise.all(valid.map(id =>
        updateDoc(doc(db, 'notifications', id), {
          isRead: markAsRead,
          lastUpdated: new Date().toISOString()
        })
      ));

      setNotifications(prev =>
        prev.map(n => valid.includes(n.id) ? { ...n, isRead: markAsRead } : n)
      );
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
      if (valid.length === 0) return;

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
      if (unread.length === 0) return;

      await Promise.all(unread.map(n =>
        updateDoc(doc(db, 'notifications', n.id), {
          isRead: true,
          lastUpdated: new Date().toISOString()
        })
      ));

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      setError(`Error marking all read: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  //  Type config 

  const getNotificationTypeConfig = (type) => {
    const configs = {
      'overdue':          { color: '#dc3545', icon: FaExclamationTriangle, label: 'Overdue',           bgClass: 'table-danger'    },
      'urgent':           { color: '#ffc107', icon: FaClock,               label: 'Urgent',            bgClass: 'table-warning'   },
      'due-soon':         { color: '#0dcaf0', icon: FaClock,               label: 'Due Soon',          bgClass: 'table-info'      },
      'pending-long':     { color: '#6c757d', icon: FaHourglassHalf,       label: 'Long Pending',      bgClass: 'table-secondary' },
      'in-progress-long': { color: '#0d6efd', icon: FaSync,                label: 'Long In Progress',  bgClass: 'table-primary'   },
    };
    return configs[type] || configs['due-soon'];
  };

  // Lifecycle 

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setCurrentPage(1); }, [filterType, filterRead]);

  //  Derived counts 

  const unreadCount   = notifications.filter(n => !n.isRead).length;
  const selectedCount = selectedNotifications.length;
  const typeCounts    = {
    all:              notifications.length,
    overdue:          notifications.filter(n => n.type === 'overdue').length,
    urgent:           notifications.filter(n => n.type === 'urgent').length,
    'due-soon':       notifications.filter(n => n.type === 'due-soon').length,
    'pending-long':   notifications.filter(n => n.type === 'pending-long').length,
    'in-progress-long': notifications.filter(n => n.type === 'in-progress-long').length,
  };

  // Render 

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <motion.div
          className="spinner-border text-primary"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <span className="visually-hidden">Loading notifications...</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <StyledCard
        className="card shadow-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="card-header bg-gradient bg-primary text-white">
          <div className="d-flex justify-content-between align-items-center flex-wrap">
            <div className="d-flex align-items-center mb-2 mb-md-0">
              <h2 className="h4 mb-0 me-3">
                <FaBell className="me-2" /> Notifications
              </h2>
              <span className="badge bg-light text-primary" style={{ fontSize: '0.9rem' }}>
                {unreadCount} Unread / {notifications.length} Total
              </span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                className="btn btn-light btn-sm"
                onClick={fetchNotifications}
                title="Refresh notifications"
              >
                <FaSync className="me-1" /> Refresh
              </button>
              {unreadCount > 0 && (
                <button
                  className="btn btn-light btn-sm"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  <FaCheckDouble className="me-1" /> Mark All Read
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card-body">
          {/* Filters */}
          <div className="mb-4 p-3 bg-light rounded">
            <div className="row">
              <div className="col-md-8 mb-3 mb-md-0">
                <h6 className="mb-2"><FaFilter className="me-2" />Filter by Type:</h6>
                <div className="d-flex flex-wrap">
                  <FilterBadge active={filterType === 'all'}              color="#0d6efd" onClick={() => setFilterType('all')}>All ({typeCounts.all})</FilterBadge>
                  <FilterBadge active={filterType === 'overdue'}          color="#dc3545" onClick={() => setFilterType('overdue')}><FaExclamationTriangle className="me-1" />Overdue ({typeCounts.overdue})</FilterBadge>
                  <FilterBadge active={filterType === 'urgent'}           color="#ffc107" onClick={() => setFilterType('urgent')}><FaClock className="me-1" />Urgent ({typeCounts.urgent})</FilterBadge>
                  <FilterBadge active={filterType === 'due-soon'}         color="#0dcaf0" onClick={() => setFilterType('due-soon')}><FaClock className="me-1" />Due Soon ({typeCounts['due-soon']})</FilterBadge>
                  <FilterBadge active={filterType === 'pending-long'}     color="#6c757d" onClick={() => setFilterType('pending-long')}><FaHourglassHalf className="me-1" />Long Pending ({typeCounts['pending-long']})</FilterBadge>
                  <FilterBadge active={filterType === 'in-progress-long'} color="#0d6efd" onClick={() => setFilterType('in-progress-long')}><FaSync className="me-1" />Long In Progress ({typeCounts['in-progress-long']})</FilterBadge>
                </div>
              </div>
              <div className="col-md-4">
                <h6 className="mb-2">Filter by Status:</h6>
                <div className="d-flex gap-2">
                  <button className={`btn btn-sm ${filterRead === 'all'    ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setFilterRead('all')}>All</button>
                  <button className={`btn btn-sm ${filterRead === 'unread' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setFilterRead('unread')}>Unread</button>
                  <button className={`btn btn-sm ${filterRead === 'read'   ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setFilterRead('read')}>Read</button>
                </div>
                <div className="mt-2">
                  <label className="text-muted small me-2">Show:</label>
                  <select
                    className="form-select form-select-sm d-inline-block w-auto"
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  >
                    {pageSizeOptions.map(size => (
                      <option key={size} value={size}>{size} per page</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Bulk actions bar */}
          {selectedCount > 0 && (
            <motion.div
              className="alert alert-info d-flex justify-content-between align-items-center"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span><strong>{selectedCount}</strong> notification{selectedCount > 1 ? 's' : ''} selected</span>
              <div className="d-flex gap-2">
                <ActionButton className="btn btn-sm btn-success" onClick={() => bulkToggleRead(true)}  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><FaCheck /> Mark Read</ActionButton>
                <ActionButton className="btn btn-sm btn-warning" onClick={() => bulkToggleRead(false)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><FaEye /> Mark Unread</ActionButton>
                <ActionButton className="btn btn-sm btn-danger"  onClick={bulkDeleteNotifications}     whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><FaTrash /> Delete</ActionButton>
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div className="alert alert-danger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {error}
            </motion.div>
          )}

          {filteredNotifications.length === 0 ? (
            <motion.div className="text-center p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <FaBell size={64} className="text-muted mb-3" />
              <h5 className="text-muted">No notifications to display</h5>
              <p className="text-muted">
                {filterType !== 'all' || filterRead !== 'all'
                  ? 'Try adjusting your filters'
                  : "You're all caught up!"}
              </p>
            </motion.div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={
                            currentNotifications.length > 0 &&
                            currentNotifications.every(n => selectedNotifications.includes(n.id))
                          }
                          onChange={toggleAllCurrentPageSelections}
                        />
                      </th>
                      <th style={{ width: '50px' }}>#</th>
                      <th>Project</th>
                      <th>Reference</th>
                      <th>Submission Date</th>
                      <th>Status</th>
                      <th>Type</th>
                      <th>Due</th>
                      <th style={{ width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {currentNotifications.map((notif, index) => {
                        const typeConfig = getNotificationTypeConfig(notif.type);
                        const Icon = typeConfig.icon;

                        return (
                          <motion.tr
                            key={notif.id}
                            className={`${!notif.isRead ? 'fw-semibold' : ''} ${typeConfig.bgClass} ${
                              selectedNotifications.includes(notif.id) ? 'table-active' : ''
                            }`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.3, delay: index * 0.02 }}
                            style={{ cursor: 'pointer' }}
                          >
                            <td onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={selectedNotifications.includes(notif.id)}
                                onChange={() => toggleNotificationSelection(notif.id)}
                              />
                            </td>
                            <td>{indexOfFirstItem + index + 1}</td>
                            <td
                              onClick={() => navigate(`/projects/edit/${notif.projectId}`)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="d-flex align-items-center">
                                {!notif.isRead && (
                                  <span
                                    className="badge bg-primary me-2"
                                    style={{ width: '8px', height: '8px', padding: 0 }}
                                  />
                                )}
                                {notif.title}
                              </div>
                            </td>
                            <td>{notif.refCode}</td>
                            <td>{new Date(notif.submissionDate).toLocaleDateString()}</td>
                            <td>
                              <span className={`badge bg-${
                                notif.status === 'completed'  ? 'success' :
                                notif.status === 'in-progress'? 'warning' :
                                notif.status === 'cancelled'  ? 'danger'  : 'secondary'
                              }`}>
                                {notif.status}
                              </span>
                            </td>
                            <td>
                              <NotificationBadge style={{
                                background: typeConfig.color + '20',
                                color: typeConfig.color,
                                border: `1px solid ${typeConfig.color}`
                              }}>
                                <Icon size={12} />
                                {typeConfig.label}
                              </NotificationBadge>
                            </td>
                            <td>
                              {notif.status !== 'completed' && notif.daysUntilDue !== undefined ? (
                                <span className={notif.daysUntilDue < 0 ? 'text-danger fw-bold' : ''}>
                                  {notif.daysUntilDue < 0
                                    ? `${Math.abs(notif.daysUntilDue)}d overdue`
                                    : `${notif.daysUntilDue}d left`}
                                </span>
                              ) : '-'}
                            </td>
                            <td onClick={e => e.stopPropagation()}>
                              <div className="btn-group btn-group-sm">
                                <button
                                  className={`btn ${notif.isRead ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
                                  onClick={() => {
                                    setSelectedNotifications([notif.id]);
                                    bulkToggleRead(!notif.isRead);
                                  }}
                                  title={notif.isRead ? 'Mark as unread' : 'Mark as read'}
                                >
                                  {notif.isRead ? <FaEye /> : <FaCheck />}
                                </button>
                                <button
                                  className="btn btn-outline-danger"
                                  onClick={() => {
                                    setSelectedNotifications([notif.id]);
                                    bulkDeleteNotifications();
                                  }}
                                  title="Delete notification"
                                >
                                  <FaTrash />
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

              {/* Pagination */}
              <div className="d-flex justify-content-between align-items-center mt-4 flex-wrap gap-3">
                <div className="text-muted">
                  Showing <strong>{indexOfFirstItem + 1}</strong> to{' '}
                  <strong>{Math.min(indexOfLastItem, filteredNotifications.length)}</strong> of{' '}
                  <strong>{filteredNotifications.length}</strong> entries
                </div>
                <nav>
                  <ul className="pagination mb-0">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
                        <FaChevronLeft />
                      </button>
                    </li>
                    {[...Array(Math.min(totalPages, 5))].map((_, index) => {
                      let pageNumber;
                      if (totalPages <= 5)            pageNumber = index + 1;
                      else if (currentPage <= 3)      pageNumber = index + 1;
                      else if (currentPage >= totalPages - 2) pageNumber = totalPages - 4 + index;
                      else                            pageNumber = currentPage - 2 + index;

                      return (
                        <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                          <button className="page-link" onClick={() => paginate(pageNumber)}>{pageNumber}</button>
                        </li>
                      );
                    })}
                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>
                        <FaChevronRight />
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </>
          )}
        </div>
      </StyledCard>
    </div>
  );
}

export default NotificationPage;