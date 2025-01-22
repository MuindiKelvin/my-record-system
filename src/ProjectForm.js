import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

function ProjectForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const initialFormState = {
    orderDate: new Date().toISOString().split('T')[0],
    orderRefCode: '',
    orderType: 'normal', // Added order type field
    topic: '',
    words: '',
    cpp: '',
    hasCode: false,
    codeAmount: '',
    status: 'pending',
    priority: 'medium',
    notes: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  // Fetch project data for editing
  useEffect(() => {
    if (!id) return;

    const fetchProject = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(db, 'projects', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            ...data,
            orderDate: data.orderDate || new Date().toISOString().split('T')[0],
            orderType: data.orderType || 'normal', // Added order type
            words: data.words?.toString() || '',
            cpp: data.cpp?.toString() || '',
            codeAmount: data.codeAmount?.toString() || '',
            hasCode: Boolean(data.hasCode),
            status: data.status || 'pending',
            priority: data.priority || 'medium',
            notes: data.notes || ''
          });
        } else {
          setError('Project not found');
          navigate('/projects');
        }
      } catch (err) {
        setError('Error loading project: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };

      // Reset code amount when unchecking hasCode
      if (name === 'hasCode' && !checked) {
        newData.codeAmount = '';
      }

      return newData;
    });

    // Clear any previous error when user makes changes
    setError('');
  };

  const calculateAmount = () => {
    const words = parseFloat(formData.words) || 0;
    const cpp = parseFloat(formData.cpp) || 0;
    const codeAmount = parseFloat(formData.codeAmount) || 0;

    // Apply different rates based on order type
    const baseRate = formData.orderType === 'dissertation' ? 1 : 1;
    const wordCost = (words / 275) * cpp * baseRate;
    const total = formData.hasCode ? wordCost + codeAmount : wordCost;

    return isNaN(total) ? '0.00' : total.toFixed(2);
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.orderDate) errors.push('Order date is required');
    if (!formData.orderRefCode) errors.push('Order reference code is required');
    if (!formData.orderType) errors.push('Order type is required');
    if (!formData.words || formData.words <= 0) errors.push('Valid word count is required');
    if (!formData.cpp || formData.cpp <= 0) errors.push('Valid cost per page is required');
    if (formData.hasCode && (!formData.codeAmount || formData.codeAmount < 0)) {
      errors.push('Valid code amount is required when code is included');
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const projectData = {
        ...formData,
        words: parseInt(formData.words),
        cpp: parseFloat(formData.cpp),
        codeAmount: formData.hasCode ? parseFloat(formData.codeAmount) : 0,
        amount: calculateAmount(),
        lastUpdated: new Date().toISOString()
      };

      if (id) {
        // Update existing project
        const projectRef = doc(db, 'projects', id);
        await updateDoc(projectRef, projectData);
      } else {
        // Create new project
        projectData.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'projects'), projectData);
      }

      navigate('/projects');
    } catch (err) {
      setError('Error saving project: ' + err.message);
    } finally {
      setIsLoading(false);
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
    <div className="container my-4">
      <div className="card shadow">
        <div className="card-header bg-primary text-white">
          <h2 className="h4 mb-0">{id ? 'Edit Project' : 'Create New Project'}</h2>
        </div>
        
        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              {/* Order Details */}
              <div className="col-md-4">
                <label className="form-label">Order Date</label>
                <input
                  type="date"
                  name="orderDate"
                  value={formData.orderDate}
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Order Reference Code</label>
                <input
                  type="text"
                  name="orderRefCode"
                  value={formData.orderRefCode}
                  onChange={handleChange}
                  className="form-control"
                  required
                  placeholder="Enter reference code"
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Order Type</label>
                <select
                  name="orderType"
                  value={formData.orderType}
                  onChange={handleChange}
                  className="form-select"
                  required
                >
                  <option value="normal">Normal</option>
                  <option value="dissertation">Dissertation</option>
                </select>
              </div>

              <div className="col-12">
                <label className="form-label">Topic</label>
                <input
                  type="text"
                  name="topic"
                  value={formData.topic}
                  onChange={handleChange}
                  className="form-control"
                  placeholder="Enter project topic"
                />
              </div>

              {/* Cost Calculation */}
              <div className="col-md-6">
                <label className="form-label">Word Count</label>
                <input
                  type="number"
                  name="words"
                  value={formData.words}
                  onChange={handleChange}
                  className="form-control"
                  required
                  min="1"
                  placeholder="Enter word count"
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Cost Per Page (CPP)</label>
                <input
                  type="number"
                  name="cpp"
                  value={formData.cpp}
                  onChange={handleChange}
                  className="form-control"
                  required
                  min="0"
                  step="0.01"
                  placeholder="Enter cost per page"
                />
              </div>

              {/* Code Related Fields */}
              <div className="col-12">
                <div className="form-check mb-3">
                  <input
                    type="checkbox"
                    name="hasCode"
                    checked={formData.hasCode}
                    onChange={handleChange}
                    className="form-check-input"
                    id="hasCode"
                  />
                  <label className="form-check-label" htmlFor="hasCode">
                    Project Includes Code
                  </label>
                </div>
              </div>

              {formData.hasCode && (
                <div className="col-md-6">
                  <label className="form-label">Code Amount</label>
                  <input
                    type="number"
                    name="codeAmount"
                    value={formData.codeAmount}
                    onChange={handleChange}
                    className="form-control"
                    min="0"
                    step="0.01"
                    placeholder="Enter code amount"
                  />
                </div>
              )}

              {/* Project Status */}
              <div className="col-md-6">
                <label className="form-label">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Priority</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Notes */}
              <div className="col-12">
                <label className="form-label">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className="form-control"
                  rows="3"
                  placeholder="Enter any additional notes"
                />
              </div>

              {/* Amount Display */}
              <div className="col-12">
                <div className="alert alert-info">
                  <strong>Total Amount: Ksh.{calculateAmount()}</strong>
                  <br />
                  <small>
                    Base cost: Ksh.{((parseFloat(formData.words) / 275) * parseFloat(formData.cpp) * (formData.orderType === 'dissertation' ? 1 : 1)).toFixed(2)}
                    {formData.hasCode && ` + Code cost: Ksh.${parseFloat(formData.codeAmount || 0).toFixed(2)}`}
                  </small>
                </div>
              </div>

              {/* Form Actions */}
              <div className="col-12">
                <div className="d-flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Saving...' : (id ? 'Update Project' : 'Create Project')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate('/projects')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ProjectForm;