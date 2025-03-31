import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBell, FaCheck, FaEye, FaTrash, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

function NotificationPage() {
  const [notifications, setNotifications] = useState([]);
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const pageSizeOptions = [5, 10, 20, 50];

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      // Fetch projects
      const projectsSnapshot = await getDocs(collection(db, 'projects'));
      const currentDate = new Date();
      const projectsData = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Fetch existing notifications
      const notificationsSnapshot = await getDocs(collection(db, 'notifications'));
      const existingNotifications = notificationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const notificationList = await Promise.all(
        projectsData.map(async project => {
          const submissionDate = new Date(project.submissionDate);
          const timeDiff = submissionDate - currentDate;
          const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));

          const isDueSoon = daysDiff <= 2 && daysDiff > 1 && project.status !== 'completed' && project.status !== 'cancelled';
          const isUrgent = daysDiff <= 1 && daysDiff >= 0 && project.status !== 'completed' && project.status !== 'cancelled';
          const isOverdue = daysDiff < 0 && project.status !== 'completed' && project.status !== 'cancelled';
          const isPendingLong = project.status === 'pending' && 
            (currentDate - new Date(project.orderDate)) / (1000 * 3600 * 24) > 7;
          const isInProgressLong = project.status === 'in-progress' && 
            (currentDate - new Date(project.lastUpdated || project.orderDate)) / (1000 * 3600 * 24) > 14;

          let existingNotif = existingNotifications.find(n => n.projectId === project.id);

          // If no existing notification, create one
          if (!existingNotif && (isDueSoon || isUrgent || isOverdue || isPendingLong || isInProgressLong)) {
            const newNotif = {
              projectId: project.id,
              title: project.topic || 'Untitled Project',
              refCode: project.orderRefCode,
              submissionDate: project.submissionDate,
              status: project.status,
              isRead: false,
              type: determineNotificationType(isDueSoon, isUrgent, isOverdue, isPendingLong, isInProgressLong),
              daysUntilDue: daysDiff,
              createdAt: new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, 'notifications'), newNotif);
            existingNotif = { id: docRef.id, ...newNotif };
          }

          return existingNotif ? {
            id: existingNotif.id,
            projectId: project.id,
            title: project.topic || 'Untitled Project',
            refCode: project.orderRefCode,
            submissionDate: project.submissionDate,
            status: project.status,
            isRead: existingNotif.isRead || false,
            type: determineNotificationType(isDueSoon, isUrgent, isOverdue, isPendingLong, isInProgressLong),
            daysUntilDue: daysDiff,
            isDue: isDueSoon || isUrgent || isOverdue,
            createdAt: existingNotif.createdAt || new Date().toISOString()
          } : null;
        })
      );

      const filteredNotifications = notificationList
        .filter(notif => notif && notif.type !== 'normal') // Only show actionable notifications with valid data
        .sort((a, b) => {
          if (a.status === 'completed' && b.status !== 'completed') return 1;
          if (b.status === 'completed' && a.status !== 'completed') return -1;
          if (a.isDue && !b.isDue && a.status !== 'completed') return -1;
          if (b.isDue && !a.isDue && b.status !== 'completed') return 1;
          return new Date(b.submissionDate) - new Date(a.submissionDate);
        });

      setNotifications(filteredNotifications);
    } catch (err) {
      setError('Error fetching or creating notifications: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentNotifications = notifications.slice(indexOfFirstItem, indexOfLastItem);

  // Calculate total pages
  const totalPages = Math.ceil(notifications.length / itemsPerPage);

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Change items per page
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const determineNotificationType = (isDueSoon, isUrgent, isOverdue, isPendingLong, isInProgressLong) => {
    if (isOverdue) return 'overdue';
    if (isUrgent) return 'urgent';
    if (isDueSoon) return 'due-soon';
    if (isPendingLong) return 'pending-long';
    if (isInProgressLong) return 'in-progress-long';
    return 'normal';
  };

  const toggleNotificationSelection = (notificationId) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const toggleAllCurrentPageSelections = () => {
    const currentPageNotificationIds = currentNotifications.map(notif => notif.id);
    const allCurrentPageSelected = currentPageNotificationIds.every(id => 
      selectedNotifications.includes(id)
    );

    if (allCurrentPageSelected) {
      setSelectedNotifications(prev => 
        prev.filter(id => !currentPageNotificationIds.includes(id))
      );
    } else {
      setSelectedNotifications(prev => {
        const newSelection = new Set([...prev, ...currentPageNotificationIds]);
        return Array.from(newSelection);
      });
    }
  };

  const bulkToggleRead = async (markAsRead) => {
    try {
      const validSelectedNotifications = selectedNotifications.filter(id => 
        notifications.some(n => n.id === id)
      );

      if (validSelectedNotifications.length === 0) {
        setError('No valid notifications selected for update.');
        return;
      }

      const updatePromises = validSelectedNotifications.map(notificationId => {
        return updateDoc(doc(db, 'notifications', notificationId), {
          isRead: markAsRead,
          lastUpdated: new Date().toISOString()
        });
      });
      
      await Promise.all(updatePromises);
      
      setNotifications(prev => 
        prev.map(notif => 
          validSelectedNotifications.includes(notif.id) 
            ? { ...notif, isRead: markAsRead } 
            : notif
        )
      );

      setSelectedNotifications([]);
    } catch (err) {
      setError(`Error bulk ${markAsRead ? 'marking' : 'unmarking'} notifications: ${err.message}`);
    }
  };

  const bulkDeleteNotifications = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedNotifications.length} notifications?`)) {
      try {
        const validSelectedNotifications = selectedNotifications.filter(id => 
          notifications.some(n => n.id === id)
        );

        if (validSelectedNotifications.length === 0) {
          setError('No valid notifications selected for deletion.');
          return;
        }

        const deletePromises = validSelectedNotifications.map(notificationId =>
          deleteDoc(doc(db, 'notifications', notificationId))
        );
        
        await Promise.all(deletePromises);
        
        setNotifications(prev => 
          prev.filter(notif => !validSelectedNotifications.includes(notif.id))
        );

        setSelectedNotifications([]);
      } catch (err) {
        setError(`Error deleting notifications: ${err.message}`);
      }
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const selectedCount = selectedNotifications.length;

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading notifications...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <motion.div
        className="card shadow"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <h2 className="h4 mb-0 me-3">
              <FaBell className="me-2" /> All Notifications ({unreadCount}/{notifications.length})
            </h2>
            <div className="d-flex align-items-center">
              <label className="me-2 text-white">Show:</label>
              <select 
                className="form-select form-select-sm w-auto"
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              >
                {pageSizeOptions.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="d-flex align-items-center">
            {selectedCount > 0 && (
              <div className="me-3 text-white">
                {selectedCount} notification(s) selected
              </div>
            )}
            {selectedCount > 0 && (
              <>
                <button
                  className="btn btn-light me-2"
                  onClick={() => bulkToggleRead(true)}
                  title="Mark selected as read"
                >
                  <FaCheck className="me-1" /> Mark Read
                </button>
                <button
                  className="btn btn-light me-2"
                  onClick={() => bulkToggleRead(false)}
                  title="Mark selected as unread"
                >
                  <FaEye className="me-1" /> Mark Unread
                </button>
                <button
                  className="btn btn-danger"
                  onClick={bulkDeleteNotifications}
                  title="Delete selected notifications"
                >
                  <FaTrash className="me-1" /> Delete
                </button>
              </>
            )}
          </div>
        </div>

        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="text-center p-3 text-muted">
              No notifications available
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead>
                    <tr>
                      <th>
                        <input 
                          type="checkbox"
                          checked={
                            currentNotifications.length > 0 && 
                            currentNotifications.every(notif => 
                              selectedNotifications.includes(notif.id)
                            )
                          }
                          onChange={toggleAllCurrentPageSelections}
                          className="form-check-input"
                        />
                      </th>
                      <th>#</th>
                      <th>Title</th>
                      <th>Reference Code</th>
                      <th>Submission Date</th>
                      <th>Status</th>
                      <th>Type</th>
                      <th>Due</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {currentNotifications.map((notif, index) => (
                        <motion.tr
                          key={notif.id}
                          className={`${!notif.isRead ? 'fw-bold' : ''} ${
                            notif.type === 'overdue' ? 'table-danger' :
                            notif.type === 'urgent' ? 'table-warning' :
                            notif.type === 'due-soon' ? 'table-info' :
                            notif.type === 'pending-long' ? 'table-secondary' :
                            notif.type === 'in-progress-long' ? 'table-primary' : ''
                          } ${selectedNotifications.includes(notif.id) ? 'table-active' : ''}`}
                          initial={{ opacity: 0, x: -50 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ 
                            opacity: 0, 
                            x: 50, 
                            transition: { duration: 0.3 } 
                          }}
                          transition={{ duration: 0.2 }}
                        >
                          <td>
                            <input 
                              type="checkbox"
                              checked={selectedNotifications.includes(notif.id)}
                              onChange={() => toggleNotificationSelection(notif.id)}
                              className="form-check-input"
                            />
                          </td>
                          <td>{indexOfFirstItem + index + 1}</td>
                          <td>{notif.title}</td>
                          <td>{notif.refCode}</td>
                          <td>{new Date(notif.submissionDate).toLocaleDateString()}</td>
                          <td>{notif.status}</td>
                          <td>{notif.type.replace('-', ' ')}</td>
                          <td>
                            {notif.status !== 'completed' && notif.daysUntilDue !== undefined ? (
                              notif.daysUntilDue < 0 
                                ? `${Math.abs(notif.daysUntilDue)} days overdue`
                                : `${notif.daysUntilDue} days remaining`
                            ) : '-'}
                          </td>
                          <td>
                            <div className="btn-group">
                              <button
                                className={`btn btn-sm ${
                                  notif.isRead ? 'btn-outline-secondary' : 'btn-outline-primary'
                                }`}
                                onClick={() => {
                                  setSelectedNotifications([notif.id]);
                                  bulkToggleRead(!notif.isRead);
                                }}
                                title={notif.isRead ? 'Mark as unread' : 'Mark as read'}
                              >
                                {notif.isRead ? <FaEye /> : <FaCheck />}
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
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
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-3">
                <div className="text-muted">
                  Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, notifications.length)} of {notifications.length} entries
                </div>
                <nav>
                  <ul className="pagination mb-0">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <FaChevronLeft />
                      </button>
                    </li>
                    {[...Array(totalPages)].map((_, index) => (
                      <li 
                        key={index} 
                        className={`page-item ${currentPage === index + 1 ? 'active' : ''}`}
                      >
                        <button 
                          className="page-link" 
                          onClick={() => paginate(index + 1)}
                        >
                          {index + 1}
                        </button>
                      </li>
                    ))}
                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        <FaChevronRight />
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default NotificationPage;