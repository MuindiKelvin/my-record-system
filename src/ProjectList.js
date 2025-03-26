import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import * as XLSX from 'xlsx';
import { CSVLink } from 'react-csv';
import { motion } from 'framer-motion';
import { 
  FaListAlt, FaFileExcel, FaFileCsv, 
  FaFilter, FaSort, FaSearch, FaCalendarAlt,
  FaFileImport
} from 'react-icons/fa';

function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'orderDate', direction: 'desc' });
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  const [selectedColumns, setSelectedColumns] = useState({
    number: true,
    orderDate: true,
    submissionDate: true,
    orderRefCode: true,
    orderType: true,
    topic: true,
    words: true,
    cpp: true,
    hasCode: true,
    codeAmount: true,
    status: true,
    priority: true,
    amount: true,
    notes: true,
    due: true
  });
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const toastRef = useRef(null);

  const columns = [
    { id: 'number', label: '#' },
    { id: 'orderDate', label: 'Order Date' },
    { id: 'submissionDate', label: 'Submission Date' },
    { id: 'orderRefCode', label: 'Reference Code' },
    { id: 'orderType', label: 'Order Type' },
    { id: 'topic', label: 'Topic' },
    { id: 'words', label: 'Words' },
    { id: 'cpp', label: 'CPP' },
    { id: 'hasCode', label: 'Has Code' },
    { id: 'codeAmount', label: 'Code Amount' },
    { id: 'status', label: 'Status' },
    { id: 'priority', label: 'Priority' },
    { id: 'amount', label: 'Amount' },
    { id: 'notes', label: 'Notes' },
    { id: 'due', label: 'Due' }
  ];

  const showNotification = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const getMonthYearString = (date) => {
    return new Date(date).toLocaleString('default', { month: 'short', year: 'numeric' });
  };

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'projects'));
      const currentDate = new Date();
      const projectsData = querySnapshot.docs.map((doc, index) => {
        const project = {
          id: doc.id,
          number: index + 1,
          ...doc.data()
        };
        const submissionDate = new Date(project.submissionDate);
        const timeDiff = submissionDate - currentDate;
        const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));
        
        return {
          ...project,
          daysUntilDue: daysDiff,
          isDue: daysDiff <= 2 && daysDiff >= 0 && project.status !== 'completed' && project.status !== 'cancelled',
          isOverdue: daysDiff < 0 && project.status !== 'completed' && project.status !== 'cancelled'
        };
      })
      .sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (b.status === 'completed' && a.status !== 'completed') return -1;
        if ((a.isDue || a.isOverdue) && !b.isDue && !b.isOverdue) return -1;
        if ((b.isDue || b.isOverdue) && !a.isDue && !a.isOverdue) return 1;
        return new Date(b.orderDate) - new Date(a.orderDate);
      });

      setProjects(projectsData);
      setFilteredProjects(projectsData);
    } catch (err) {
      setError('Error fetching projects: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    let results = [...projects];

    if (startDate && endDate) {
      if (new Date(startDate) > new Date(endDate)) {
        setError('Start date cannot be after end date');
        return;
      }
      results = results.filter(project => {
        const projectDate = new Date(project.orderDate);
        return projectDate >= new Date(startDate) && projectDate <= new Date(endDate);
      });
    }

    if (searchTerm) {
      results = results.filter(project =>
        Object.values(project).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (selectedCategory !== 'all') {
      results = results.filter(project => project.orderType === selectedCategory);
    }

    setFilteredProjects(results);
    setCurrentPage(1);
    setError('');
  }, [searchTerm, startDate, endDate, selectedCategory, projects]);

  const resetFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSelectedCategory('all');
    setFilteredProjects(projects);
    setCurrentPage(1);
    setError('');
  };

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });

    const sorted = [...filteredProjects].sort((a, b) => {
      if (key === 'due') {
        const aValue = a.daysUntilDue !== undefined ? a.daysUntilDue : Infinity;
        const bValue = b.daysUntilDue !== undefined ? b.daysUntilDue : Infinity;
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      if (key === 'number') {
        return direction === 'asc' ? a.number - b.number : b.number - a.number;
      }
      const aValue = a[key] || '';
      const bValue = b[key] || '';
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      return direction === 'asc' 
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
    setFilteredProjects(sorted);
  };

  const calculateTotals = () => {
    return filteredProjects.reduce(
      (acc, project) => {
        acc.totalWords += Number(project.words) || 0;
        acc.totalAmount += Number(project.amount) || 0;
        acc.totalCodeAmount += Number(project.codeAmount) || 0;
        return acc;
      },
      { totalWords: 0, totalAmount: 0, totalCodeAmount: 0 }
    );
  };

  const toggleColumn = (columnId) => {
    setSelectedColumns(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  };

  const toggleAllColumns = (value) => {
    const updatedColumns = {};
    columns.forEach(column => {
      updatedColumns[column.id] = value;
    });
    setSelectedColumns(updatedColumns);
  };

  const prepareExportData = () => {
    const data = filteredProjects.map((project, index) => {
      const rowData = {};
      if (selectedColumns.number) rowData['#'] = startIndex + index + 1;
      if (selectedColumns.orderDate) rowData['Order Date'] = new Date(project.orderDate).toLocaleDateString();
      if (selectedColumns.submissionDate) rowData['Submission Date'] = new Date(project.submissionDate).toLocaleDateString();
      if (selectedColumns.orderRefCode) rowData['Reference Code'] = project.orderRefCode;
      if (selectedColumns.orderType) rowData['Order Type'] = project.orderType;
      if (selectedColumns.topic) rowData['Topic'] = project.topic;
      if (selectedColumns.words) rowData['Words'] = project.words;
      if (selectedColumns.cpp) rowData['CPP'] = project.cpp;
      if (selectedColumns.hasCode) rowData['Has Code'] = project.hasCode ? 'Yes' : 'No';
      if (selectedColumns.codeAmount) rowData['Code Amount'] = project.codeAmount || 0;
      if (selectedColumns.status) rowData['Status'] = project.status;
      if (selectedColumns.priority) rowData['Priority'] = project.priority;
      if (selectedColumns.amount) rowData['Amount'] = project.amount;
      if (selectedColumns.notes) rowData['Notes'] = project.notes;
      if (selectedColumns.due) rowData['Due'] = project.daysUntilDue !== undefined 
        ? project.daysUntilDue < 0 
          ? `${Math.abs(project.daysUntilDue)} days overdue`
          : `${project.daysUntilDue} days remaining`
        : '-';
      return rowData;
    });

    const totals = calculateTotals();
    const totalRow = {};
    if (selectedColumns.number) totalRow['#'] = 'TOTALS';
    if (selectedColumns.words) totalRow['Words'] = totals.totalWords;
    if (selectedColumns.codeAmount) totalRow['Code Amount'] = totals.totalCodeAmount;
    if (selectedColumns.amount) totalRow['Amount'] = totals.totalAmount;
    
    return [...data, totalRow];
  };

  const exportData = () => {
    if (!Object.values(selectedColumns).some(Boolean)) {
      setError('Please select at least one column to export');
      return;
    }

    const dataToExport = prepareExportData();
    const monthYear = startDate ? getMonthYearString(startDate) : getMonthYearString(new Date());
    const categoryMap = {
      'normal': 'Kevz_Normal_Invoice',
      'dissertation': 'Kevz_Dissertations_Invoice',
      'all': 'Kevz_All_Invoice'
    };
    const filenameBase = `${categoryMap[selectedCategory] || 'Kevz_Projects'}_${monthYear}`;

    if (exportFormat === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
      XLSX.writeFile(workbook, `${filenameBase}.xlsx`);
      showNotification('Projects exported successfully', 'success');
    }
    setError('');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteDoc(doc(db, 'projects', id));
        fetchProjects();
        showNotification('Project deleted successfully', 'success');
      } catch (err) {
        setError('Error deleting project: ' + err.message);
        showNotification('Failed to delete project', 'danger');
      }
    }
  };

  const importFromExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          setError('Imported file is empty');
          showNotification('Imported file is empty', 'warning');
          return;
        }

        for (const row of jsonData) {
          const projectData = {
            orderDate: row['Order Date'] || new Date().toISOString(),
            submissionDate: row['Submission Date'] || new Date().toISOString(),
            orderRefCode: row['Reference Code'] || '',
            orderType: row['Order Type'] || 'normal',
            topic: row['Topic'] || '',
            words: parseInt(row['Words']) || 0,
            cpp: parseFloat(row['CPP']) || 0,
            hasCode: row['Has Code'] === 'Yes',
            codeAmount: parseFloat(row['Code Amount']) || 0,
            status: row['Status'] || 'pending',
            priority: row['Priority'] || 'medium',
            amount: parseFloat(row['Amount']) || 0,
            notes: row['Notes'] || '',
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          };
          await addDoc(collection(db, 'projects'), projectData);
        }
        fetchProjects();
        showNotification(`Imported ${jsonData.length} projects successfully`, 'success');
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError('Error importing data: ' + err.message);
      showNotification('Failed to import projects', 'danger');
    }
  };

  const handleAddProject = () => {
    navigate('/projects/new');
  };

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProjects = filteredProjects.slice(startIndex, startIndex + itemsPerPage);

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <motion.div
          className="spinner-border text-primary"
          role="status"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <span className="visually-hidden">Loading...</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1050 }}>
        <motion.div
          ref={toastRef}
          className={`toast ${toast.show ? 'show' : ''} bg-${toast.type}`}
          role="alert"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: toast.show ? 1 : 0, y: toast.show ? 0 : -50 }}
          transition={{ duration: 0.3 }}
        >
          <div className="toast-header">
            <strong className="me-auto text-white">
              {toast.type === 'success' ? 'Success' : 
               toast.type === 'danger' ? 'Error' : 'Warning'}
            </strong>
            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={() => setToast({ show: false, message: '', type: '' })}
            ></button>
          </div>
          <div className="toast-body text-white">
            {toast.message}
          </div>
        </motion.div>
      </div>

      <div className="card shadow">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h2 className="h4 mb-0">
            <FaListAlt className="me-2" /> Projects Management
          </h2>
          <div>
            <button
              className="btn btn-light"
              onClick={handleAddProject}
            >
              + Add Project
            </button>
          </div>
        </div>

        <div className="card-body">
          <div className="row mb-3">
            <div className="col-md-3">
              <div className="input-group">
                <span className="input-group-text">
                  <FaSearch />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-2">
              <div className="input-group">
                <span className="input-group-text">
                  <FaCalendarAlt />
                </span>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Start Date"
                />
              </div>
            </div>
            <div className="col-md-2">
              <div className="input-group">
                <span className="input-group-text">
                  <FaCalendarAlt />
                </span>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="End Date"
                />
              </div>
            </div>
            <div className="col-md-2">
              <div className="input-group">
                <span className="input-group-text">
                  <FaFilter />
                </span>
                <select
                  className="form-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  <option value="normal">Normal</option>
                  <option value="dissertation">Dissertation</option>
                </select>
              </div>
            </div>
            <div className="col-md-3 text-end">
              <div className="btn-group me-2">
                <button 
                  className="btn btn-outline-primary"
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                >
                  <FaSort className="me-1" /> Columns
                </button>
                <select
                  className="form-select"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  style={{ maxWidth: '100px' }}
                >
                  <option value="xlsx">XLSX</option>
                  <option value="csv">CSV</option>
                </select>
                {exportFormat === 'xlsx' ? (
                  <button className="btn btn-success" onClick={exportData}>
                    <FaFileExcel className="me-1" /> Export
                  </button>
                ) : (
                  <CSVLink
                    data={prepareExportData()}
                    filename={`${selectedCategory === 'all' ? 'Kevz_All_Invoice' : 
                      selectedCategory === 'normal' ? 'Kevz_Normal_Invoice' : 
                      'Kevz_Dissertations_Invoice'}_${getMonthYearString(startDate || new Date())}.csv`}
                    className="btn btn-success"
                    onClick={() => {
                      if (!Object.values(selectedColumns).some(Boolean)) {
                        setError('Please select at least one column to export');
                        showNotification('Please select at least one column', 'warning');
                        return false;
                      }
                      showNotification('Projects exported successfully', 'success');
                      setError('');
                    }}
                  >
                    <FaFileCsv className="me-1" /> Export
                  </CSVLink>
                )}
              </div>
              <button className="btn btn-secondary me-2" onClick={resetFilters}>
                Reset
              </button>
              <input
                type="file"
                id="importExcel"
                className="d-none"
                accept=".xlsx, .xls"
                onChange={importFromExcel}
              />
              <button
                className="btn btn-info"
                onClick={() => document.getElementById('importExcel').click()}
              >
                <FaFileImport className="me-1" /> Import
              </button>
            </div>
          </div>

          {showColumnSelector && (
            <motion.div 
              className="card mb-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h5 className="mb-0">Select Columns for Export</h5>
                  <div>
                    <button 
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => toggleAllColumns(true)}
                    >
                      Select All
                    </button>
                    <button 
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => toggleAllColumns(false)}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="row">
                  {columns.map(column => (
                    <div key={column.id} className="col-md-3 mb-2">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`column-${column.id}`}
                          checked={selectedColumns[column.id] || false}
                          onChange={() => toggleColumn(column.id)}
                        />
                        <label className="form-check-label" htmlFor={`column-${column.id}`}>
                          {column.label}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div
              className="alert alert-danger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {error}
            </motion.div>
          )}

          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  {[
                    'number', 'orderDate', 'submissionDate', 'orderRefCode', 'orderType', 
                    'topic', 'words', 'amount', 'status', 'priority', 'due'
                  ].map(key => (
                    <th 
                      key={key}
                      onClick={() => handleSort(key)} 
                      style={{ cursor: 'pointer' }}
                    >
                      {columns.find(col => col.id === key)?.label}
                      {sortConfig.key === key && (
                        sortConfig.direction === 'asc' ? ' ↑' : ' ↓'
                      )}
                    </th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.map((project, index) => (
                  <motion.tr 
                    key={project.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`${project.isOverdue ? 'table-danger' : 
                              project.isDue ? 'table-warning' : ''}`}
                  >
                    <td>{startIndex + index + 1}</td>
                    <td>{new Date(project.orderDate).toLocaleDateString()}</td>
                    <td>{new Date(project.submissionDate).toLocaleDateString()}</td>
                    <td>{project.orderRefCode}</td>
                    <td className="text-capitalize">{project.orderType}</td>
                    <td>{project.topic}</td>
                    <td>{project.words}</td>
                    <td>Ksh.{Number(project.amount).toFixed(2)}</td>
                    <td>
                      <span className={`badge bg-${
                        project.status === 'completed' ? 'success' :
                        project.status === 'in-progress' ? 'warning' :
                        project.status === 'cancelled' ? 'danger' : 'secondary'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge bg-${
                        project.priority === 'urgent' ? 'danger' :
                        project.priority === 'high' ? 'warning' :
                        project.priority === 'medium' ? 'info' : 'secondary'
                      }`}>
                        {project.priority}
                      </span>
                    </td>
                    <td>
                      {project.daysUntilDue !== undefined && project.status !== 'completed' ? (
                        project.daysUntilDue < 0 
                          ? `${Math.abs(project.daysUntilDue)} days overdue`
                          : `${project.daysUntilDue} days remaining`
                      ) : '-'}
                    </td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => navigate(`/projects/edit/${project.id}`)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(project.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between align-items-center mt-3">
            <div>
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredProjects.length)} of {filteredProjects.length} entries
              <select
                className="form-select d-inline-block ms-2"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ width: 'auto', display: 'inline-block' }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <nav>
              <ul className="pagination mb-0">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  >
                    Previous
                  </button>
                </li>
                {[...Array(totalPages)].map((_, index) => (
                  <li
                    key={index + 1}
                    className={`page-item ${currentPage === index + 1 ? 'active' : ''}`}
                  >
                    <button
                      className="page-link"
                      onClick={() => setCurrentPage(index + 1)}
                    >
                      {index + 1}
                    </button>
                  </li>
                ))}
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  >
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectList;