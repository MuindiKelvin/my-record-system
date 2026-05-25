import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Pricing modes
// 'word_count' – classic: words + CPP drive the cost
// 'flat_rate'  – user enters a direct negotiated/agreed price

function ProjectForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  //  Pricing mode toggle 
  const [pricingMode, setPricingMode] = useState('word_count');

  const initialFormState = {
    orderDate: new Date().toISOString().split('T')[0],
    submissionDate: new Date().toISOString().split('T')[0],
    orderRefCode: '',
    orderType: 'normal',
    topic: '',
    // word-count mode fields
    words: '',
    cpp: '',
    // flat-rate mode field
    flatRate: '',
    // add-ons
    hasCode: false,
    codeAmount: '',
    hasPresentation: false,
    slideCount: '',
    // payment
    paymentStatus: 'unpaid',
    amountPaid: '',
    // status
    status: 'pending',
    priority: 'medium',
    notes: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  //  Load existing project  
  useEffect(() => {
    if (!id) return;

    const fetchProject = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(db, 'projects', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();

          // Detect which pricing mode was used when this project was saved
          const savedMode = data.pricingMode || (data.flatRate ? 'flat_rate' : 'word_count');
          setPricingMode(savedMode);

          setFormData({
            ...data,
            orderDate: data.orderDate || new Date().toISOString().split('T')[0],
            submissionDate: data.submissionDate || new Date().toISOString().split('T')[0],
            orderType: data.orderType || 'normal',
            words: data.words != null ? Math.round(data.words).toString() : '',
            cpp: data.cpp?.toString() || '',
            flatRate: data.flatRate?.toString() || '',
            codeAmount: data.codeAmount?.toString() || '',
            hasCode: Boolean(data.hasCode),
            hasPresentation: Boolean(data.hasPresentation),
            slideCount: data.slideCount != null ? Math.round(data.slideCount).toString() : '',
            paymentStatus: data.paymentStatus || 'unpaid',
            amountPaid: data.amountPaid?.toString() || '',
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

  //  Field change handler 
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };

      if (name === 'hasCode' && !checked) newData.codeAmount = '';
      if (name === 'hasPresentation' && !checked) newData.slideCount = '';
      if (name === 'paymentStatus' && value === 'paid') newData.amountPaid = '';

      return newData;
    });

    setError('');
  };

  // Switch pricing mode and clear the other mode's fields to avoid stale data
  const handlePricingModeChange = (mode) => {
    setPricingMode(mode);
    setFormData(prev => ({
      ...prev,
      words: '',
      cpp: '',
      flatRate: ''
    }));
    setError('');
  };

  //  Cost calculations 
  const calculatePresentationCost = () => {
    const slideCount = parseFloat(formData.slideCount) || 0;
    if (slideCount === 0) return 0;
    const costPerSlide = 400 / 3; // Ksh.400 per 3 slides
    return slideCount * costPerSlide;
  };

  const calculateAmount = () => {
    let base = 0;

    if (pricingMode === 'word_count') {
      const words = parseFloat(formData.words) || 0;
      const cpp = parseFloat(formData.cpp) || 0;
      base = words > 0 ? (words / 275) * cpp : 0;
    } else {
      // flat_rate
      base = parseFloat(formData.flatRate) || 0;
    }

    const codeAmount = formData.hasCode ? parseFloat(formData.codeAmount) || 0 : 0;
    const presentationCost = formData.hasPresentation ? calculatePresentationCost() : 0;

    const total = base + codeAmount + presentationCost;
    return isNaN(total) ? '0.00' : total.toFixed(2);
  };

  const calculateBalance = () => {
    const totalAmount = parseFloat(calculateAmount());
    const amountPaid = parseFloat(formData.amountPaid) || 0;
    return (totalAmount - amountPaid).toFixed(2);
  };

  //  Validation 
  const validateForm = () => {
    const errors = [];

    if (!formData.orderDate) errors.push('Order date is required');
    if (!formData.submissionDate) errors.push('Submission date is required');
    if (!formData.orderRefCode) errors.push('Order reference code is required');
    if (!formData.orderType) errors.push('Order type is required');

    if (pricingMode === 'word_count') {
      const hasWords = formData.words && parseFloat(formData.words) > 0;
      const hasCode = formData.hasCode && formData.codeAmount;
      const hasPresentation = formData.hasPresentation && formData.slideCount;

      if (!hasWords && !hasCode && !hasPresentation) {
        errors.push('Provide a word count, code amount, or presentation slide count');
      }
      if (hasWords && (!formData.cpp || parseFloat(formData.cpp) <= 0)) {
        errors.push('A valid cost per page is required when a word count is specified');
      }
    } else {
      // flat_rate
      const hasFlat = formData.flatRate && parseFloat(formData.flatRate) > 0;
      const hasCode = formData.hasCode && formData.codeAmount;
      const hasPresentation = formData.hasPresentation && formData.slideCount;

      if (!hasFlat && !hasCode && !hasPresentation) {
        errors.push('Enter a flat rate amount, code amount, or presentation slide count');
      }
    }

    if (formData.hasCode && (!formData.codeAmount || parseFloat(formData.codeAmount) < 0)) {
      errors.push('A valid code amount is required when code is included');
    }
    if (formData.hasPresentation && (!formData.slideCount || parseFloat(formData.slideCount) < 0)) {
      errors.push('A valid slide count is required when a presentation is included');
    }
    if (formData.paymentStatus === 'partial' && (!formData.amountPaid || parseFloat(formData.amountPaid) <= 0)) {
      errors.push('Amount paid is required for partial payment');
    }
    if (formData.amountPaid && parseFloat(formData.amountPaid) > parseFloat(calculateAmount())) {
      errors.push('Amount paid cannot exceed the total amount');
    }

    return errors;
  };

  //  Submit  
  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join('. '));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const projectData = {
        // Descriptive fields — stored exactly as the user typed them
        orderDate: formData.orderDate,
        submissionDate: formData.submissionDate,
        orderRefCode: formData.orderRefCode,
        orderType: formData.orderType,
        topic: formData.topic,
        status: formData.status,
        priority: formData.priority,
        notes: formData.notes,
        paymentStatus: formData.paymentStatus,

        // Pricing mode
        pricingMode,

        // Word-count fields — only meaningful in word_count mode
        words: pricingMode === 'word_count' && parseFloat(formData.words) > 0
          ? Math.round(parseFloat(formData.words))
          : 0,
        cpp: pricingMode === 'word_count' && parseFloat(formData.cpp) > 0
          ? parseFloat(formData.cpp)
          : 0,

        // Flat-rate field — only meaningful in flat_rate mode
        flatRate: pricingMode === 'flat_rate' && parseFloat(formData.flatRate) > 0
          ? parseFloat(formData.flatRate)
          : 0,

        // Add-ons
        hasCode: Boolean(formData.hasCode),
        codeAmount: formData.hasCode && parseFloat(formData.codeAmount) > 0
          ? parseFloat(formData.codeAmount)
          : 0,
        hasPresentation: Boolean(formData.hasPresentation),
        slideCount: formData.hasPresentation && parseFloat(formData.slideCount) > 0
          ? Math.round(parseFloat(formData.slideCount))
          : 0,

        // Payment
        amountPaid: formData.paymentStatus === 'partial' && parseFloat(formData.amountPaid) > 0
          ? parseFloat(formData.amountPaid)
          : 0,

        // Computed totals
        amount: parseFloat(calculateAmount()),
        balance: formData.paymentStatus === 'partial'
          ? parseFloat(calculateBalance())
          : 0,

        lastUpdated: new Date().toISOString()
      };

      if (id) {
        // Preserve carry-forward sentinels if they exist on the original document
        if (formData.isCarryForward) projectData.isCarryForward = true;
        if (formData.carryForwardFromId) projectData.carryForwardFromId = formData.carryForwardFromId;
        await updateDoc(doc(db, 'projects', id), projectData);
      } else {
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

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  //  Derived display values 
  const writingCost = pricingMode === 'word_count'
    ? ((parseFloat(formData.words) || 0) / 275) * (parseFloat(formData.cpp) || 0)
    : parseFloat(formData.flatRate) || 0;

  //  Render 
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

              {/*  Basic Information  */}
              <div className="col-12">
                <h5 className="border-bottom pb-2 mb-3">Basic Information</h5>
              </div>

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
                <label className="form-label">Submission Date</label>
                <input
                  type="date"
                  name="submissionDate"
                  value={formData.submissionDate}
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

              <div className="col-md-6">
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

              {/*  Pricing Mode Toggle  */}
              <div className="col-12 mt-4">
                <h5 className="border-bottom pb-2 mb-3">Pricing Details</h5>

                {/* Toggle pills */}
                <div
                  className="d-inline-flex rounded-3 p-1 mb-3"
                  style={{ background: '#e9ecef', gap: '4px' }}
                >
                  <button
                    type="button"
                    className={`btn btn-sm px-4 ${
                      pricingMode === 'word_count'
                        ? 'btn-primary shadow-sm'
                        : 'btn-link text-secondary text-decoration-none'
                    }`}
                    style={{ borderRadius: '6px', transition: 'all 0.2s' }}
                    onClick={() => handlePricingModeChange('word_count')}
                  >
                    📄 Word Count
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm px-4 ${
                      pricingMode === 'flat_rate'
                        ? 'btn-primary shadow-sm'
                        : 'btn-link text-secondary text-decoration-none'
                    }`}
                    style={{ borderRadius: '6px', transition: 'all 0.2s' }}
                    onClick={() => handlePricingModeChange('flat_rate')}
                  >
                    💰 Flat Rate
                  </button>
                </div>

                {/* Helper text */}
                <p className="text-muted small mb-0">
                  {pricingMode === 'word_count'
                    ? 'Cost is calculated automatically from the word count and cost-per-page rate.'
                    : 'Use this when the client gives a fixed agreed price with no word count specified.'}
                </p>
              </div>

              {/*  Word Count Mode  */}
              {pricingMode === 'word_count' && (
                <>
                  <div className="col-md-6">
                    <label className="form-label">Word Count</label>
                    <input
                      type="number"
                      name="words"
                      value={formData.words}
                      onChange={handleChange}
                      className="form-control"
                      min="0"
                      step="1"
                      placeholder="e.g. 3000"
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Cost Per Page (CPP)</label>
                    <select
                      name="cpp"
                      value={formData.cpp}
                      onChange={handleChange}
                      className="form-select"
                      disabled={!(parseFloat(formData.words) > 0)}
                    >
                      <option value="">Select CPP</option>
                      <option value="350">Ksh. 350</option>
                      <option value="400">Ksh. 400</option>
                    </select>
                    {parseFloat(formData.words) > 0 && parseFloat(formData.cpp) > 0 && (
                      <small className="text-muted">
                        {formData.words} words / 275 x Ksh.{formData.cpp} = Ksh.
                        {((parseFloat(formData.words) / 275) * parseFloat(formData.cpp)).toFixed(2)}
                      </small>
                    )}
                  </div>
                </>
              )}

              {/*  Flat Rate Mode  */}
              {pricingMode === 'flat_rate' && (
                <div className="col-md-6">
                  <label className="form-label">Agreed / Flat Rate Amount (Ksh.)</label>
                  <div className="input-group">
                    <span className="input-group-text">Ksh.</span>
                    <input
                      type="number"
                      name="flatRate"
                      value={formData.flatRate}
                      onChange={handleChange}
                      className="form-control"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 5000"
                    />
                  </div>
                  <small className="text-muted">
                    Enter the total price agreed with the client for this project.
                  </small>
                </div>
              )}

              {/*  Code Add-on  */}
              <div className="col-12 mt-3">
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
                  <label className="form-label">Code Amount (Ksh.)</label>
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

              {/*  Presentation Add-on  */}
              <div className="col-12 mt-3">
                <div className="form-check mb-3">
                  <input
                    type="checkbox"
                    name="hasPresentation"
                    checked={formData.hasPresentation}
                    onChange={handleChange}
                    className="form-check-input"
                    id="hasPresentation"
                  />
                  <label className="form-check-label" htmlFor="hasPresentation">
                    Project Includes PowerPoint Presentation
                  </label>
                </div>
              </div>

              {formData.hasPresentation && (
                <div className="col-md-6">
                  <label className="form-label">Number of Slides</label>
                  <input
                    type="number"
                    name="slideCount"
                    value={formData.slideCount}
                    onChange={handleChange}
                    className="form-control"
                    min="0"
                    step="1"
                    placeholder="Enter number of slides"
                  />
                  {formData.slideCount > 0 && (
                    <small className="text-muted">
                      Cost: Ksh.{calculatePresentationCost().toFixed(2)} (@ Ksh.400 per 3 slides)
                    </small>
                  )}
                </div>
              )}

              {/*  Payment Information  */}
              <div className="col-12 mt-4">
                <h5 className="border-bottom pb-2 mb-3">Payment Information</h5>
              </div>

              <div className="col-md-6">
                <label className="form-label">Payment Status</label>
                <select
                  name="paymentStatus"
                  value={formData.paymentStatus}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partially Paid</option>
                  <option value="paid">Fully Paid</option>
                </select>
              </div>

              {formData.paymentStatus === 'partial' && (
                <div className="col-md-6">
                  <label className="form-label">Amount Paid (Ksh.)</label>
                  <input
                    type="number"
                    name="amountPaid"
                    value={formData.amountPaid}
                    onChange={handleChange}
                    className="form-control"
                    min="0"
                    step="0.01"
                    placeholder="Enter amount paid"
                  />
                </div>
              )}

              {/*  Project Status  */}
              <div className="col-12 mt-4">
                <h5 className="border-bottom pb-2 mb-3">Project Status</h5>
              </div>

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

              {/*  Cost Breakdown Summary  */}
              <div className="col-12 mt-3">
                <div className="alert alert-info">
                  <h6 className="alert-heading">Cost Breakdown</h6>
                  <hr />

                  {/* Base cost row */}
                  {pricingMode === 'word_count' && (parseFloat(formData.words) || 0) > 0 && (
                    <div>
                      <strong>Writing Cost:</strong> Ksh.{writingCost.toFixed(2)}
                      <br />
                      <small className="text-muted">
                        ({formData.words} words / 275 x Ksh.{formData.cpp || 0} CPP)
                      </small>
                    </div>
                  )}

                  {pricingMode === 'flat_rate' && (parseFloat(formData.flatRate) || 0) > 0 && (
                    <div>
                      <strong>Flat Rate:</strong> Ksh.{writingCost.toFixed(2)}
                      <br />
                      <small className="text-muted">Agreed price, no word count</small>
                    </div>
                  )}

                  {formData.hasCode && (parseFloat(formData.codeAmount) || 0) > 0 && (
                    <div className="mt-2">
                      <strong>Code Cost:</strong> Ksh.{parseFloat(formData.codeAmount || 0).toFixed(2)}
                    </div>
                  )}

                  {formData.hasPresentation && (parseFloat(formData.slideCount) || 0) > 0 && (
                    <div className="mt-2">
                      <strong>Presentation Cost:</strong> Ksh.{calculatePresentationCost().toFixed(2)}
                      <br />
                      <small className="text-muted">
                        ({formData.slideCount} slides @ Ksh.400 per 3 slides)
                      </small>
                    </div>
                  )}

                  <hr />
                  <div className="mt-2">
                    <strong className="fs-5">Total Amount: Ksh.{calculateAmount()}</strong>
                  </div>

                  {formData.paymentStatus === 'partial' && (parseFloat(formData.amountPaid) || 0) > 0 && (
                    <div className="mt-2">
                      <strong>Amount Paid:</strong> Ksh.{parseFloat(formData.amountPaid).toFixed(2)}
                      <br />
                      <strong className="text-danger">Balance Due:</strong> Ksh.{calculateBalance()}
                    </div>
                  )}

                  {formData.paymentStatus === 'paid' && (
                    <div className="mt-2">
                      <span className="badge bg-success">Fully Paid</span>
                    </div>
                  )}

                  {formData.paymentStatus === 'unpaid' && (
                    <div className="mt-2">
                      <span className="badge bg-warning text-dark">Unpaid</span>
                    </div>
                  )}
                </div>
              </div>

              {/*  Actions  */}
              <div className="col-12">
                <div className="d-flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Saving...' : id ? 'Update Project' : 'Create Project'}
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