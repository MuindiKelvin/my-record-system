import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import * as XLSX from 'xlsx';

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

  // Fetch projects from Firebase
  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'projects'));
      const projectsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
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

  // Enhanced search functionality with date range
  useEffect(() => {
    let results = [...projects];

    // Date range filtering
    if (startDate && endDate) {
      results = results.filter(project => {
        const projectDate = new Date(project.orderDate);
        return projectDate >= new Date(startDate) && projectDate <= new Date(endDate);
      });
    }

    // Text search filtering
    if (searchTerm) {
      results = results.filter(project =>
        Object.values(project).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    setFilteredProjects(results);
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, projects]);

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setFilteredProjects(projects);
    setCurrentPage(1);
  };

  // Sorting functionality
  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });

    const sorted = [...filteredProjects].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setFilteredProjects(sorted);
  };

  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProjects = filteredProjects.slice(startIndex, startIndex + itemsPerPage);

  // Delete project
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteDoc(doc(db, 'projects', id));
        fetchProjects();
      } catch (err) {
        setError('Error deleting project: ' + err.message);
      }
    }
  };

  // Export to Excel (now with filtered data)
  const exportToExcel = () => {
    const dataToExport = filteredProjects.map(project => ({
      'Order Date': new Date(project.orderDate).toLocaleDateString(),
      'Reference Code': project.orderRefCode,
      'Order Type': project.orderType,
      'Topic': project.topic,
      'Words': project.words,
      'CPP': project.cpp,
      'Has Code': project.hasCode ? 'Yes' : 'No',
      'Code Amount': project.codeAmount || 0,
      'Status': project.status,
      'Priority': project.priority,
      'Amount': project.amount,
      'Notes': project.notes
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
    
    // Generate filename with date range if filters are applied
    let filename = 'projects';
    if (startDate && endDate) {
      filename += `_${startDate}_to_${endDate}`;
    }
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  // Import from Excel (unchanged)
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

        for (const row of jsonData) {
          const projectData = {
            orderDate: row['Order Date'],
            orderRefCode: row['Reference Code'],
            orderType: row['Order Type'] || 'normal',
            topic: row['Topic'],
            words: parseInt(row['Words']),
            cpp: parseFloat(row['CPP']),
            hasCode: row['Has Code'] === 'Yes',
            codeAmount: parseFloat(row['Code Amount'] || 0),
            status: row['Status'],
            priority: row['Priority'],
            amount: row['Amount'],
            notes: row['Notes'],
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          };

          await addDoc(collection(db, 'projects'), projectData);
        }

        fetchProjects();
        alert('Import completed successfully!');
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError('Error importing data: ' + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="card shadow">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h2 className="h4 mb-0">Projects</h2>
          <button
            className="btn btn-light"
            onClick={() => navigate('/projects/new')}
          >
            Add New Project
          </button>
        </div>

        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <div className="row mb-3">
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <input
                type="date"
                className="form-control"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start Date"
              />
            </div>
            <div className="col-md-2">
              <input
                type="date"
                className="form-control"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End Date"
              />
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value="5">5 per page</option>
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>
            </div>
            <div className="col-md-3 text-end">
              <button
                className="btn btn-secondary me-2"
                onClick={resetFilters}
              >
                Reset Filters
              </button>
              <button
                className="btn btn-success me-2"
                onClick={exportToExcel}
              >
                Export to Excel
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
                Import
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th onClick={() => handleSort('orderDate')} style={{ cursor: 'pointer' }}>
                    Date {sortConfig.key === 'orderDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('orderRefCode')} style={{ cursor: 'pointer' }}>
                    Ref Code {sortConfig.key === 'orderRefCode' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('orderType')} style={{ cursor: 'pointer' }}>
                    Type {sortConfig.key === 'orderType' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('topic')} style={{ cursor: 'pointer' }}>
                    Topic {sortConfig.key === 'topic' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('words')} style={{ cursor: 'pointer' }}>
                    Words {sortConfig.key === 'words' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('amount')} style={{ cursor: 'pointer' }}>
                    Amount {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                    Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('priority')} style={{ cursor: 'pointer' }}>
                    Priority {sortConfig.key === 'priority' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.map(project => (
                  <tr key={project.id}>
                    <td>{new Date(project.orderDate).toLocaleDateString()}</td>
                    <td>{project.orderRefCode}</td>
                    <td className="text-capitalize">{project.orderType}</td>
                    <td>{project.topic}</td>
                    <td>{project.words}</td>
                    <td>Ksh.{parseFloat(project.amount).toFixed(2)}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="d-flex justify-content-between align-items-center">
            <div>
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredProjects.length)} of {filteredProjects.length} entries
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