import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Helpers

// ✅ FIX: Safe numeric parser - returns 0 for empty/invalid, handles string input from text fields
const toNum = (v) => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n; };

// ✅ FIX: Validates that a string contains only digits (for integer fields like word count / slide count)
const isPositiveInt = (v) => /^\d+$/.test(String(v).trim()) && parseInt(v, 10) > 0;

//  Main 

function ProjectForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pricingMode, setPricingMode] = useState('word_count');

  const init = {
    orderDate: new Date().toISOString().split('T')[0],
    submissionDate: new Date().toISOString().split('T')[0],
    orderRefCode: '', orderType: 'normal', topic: '',
    words: '', cpp: '', flatRate: '',
    hasCode: false, codeAmount: '',
    hasPresentation: false, slideCount: '',
    paymentStatus: 'unpaid', amountPaid: '',
    status: 'pending', priority: 'medium', notes: '',
  };
  const [fd, setFd] = useState(init);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'projects', id));
        if (snap.exists()) {
          const d = snap.data();
          setPricingMode(d.pricingMode || (d.flatRate ? 'flat_rate' : 'word_count'));
          setFd({
            ...d,
            orderDate: d.orderDate || init.orderDate,
            submissionDate: d.submissionDate || init.submissionDate,
            orderType: d.orderType || 'normal',
            words: d.words != null && d.words > 0 ? String(Math.round(d.words)) : '',
            cpp: d.cpp?.toString() || '',
            flatRate: d.flatRate?.toString() || '',
            codeAmount: d.codeAmount?.toString() || '',
            hasCode: Boolean(d.hasCode),
            hasPresentation: Boolean(d.hasPresentation),
            slideCount: d.slideCount != null && d.slideCount > 0 ? String(Math.round(d.slideCount)) : '',
            paymentStatus: d.paymentStatus || 'unpaid',
            amountPaid: d.amountPaid?.toString() || '',
            status: d.status || 'pending',
            priority: d.priority || 'medium',
            notes: d.notes || '',
          });
        } else { setError('Project not found'); navigate('/projects'); }
      } catch (e) { setError('Error loading: ' + e.message); }
      finally { setIsLoading(false); }
    })();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFd(prev => {
      const n = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'hasCode' && !checked) n.codeAmount = '';
      if (name === 'hasPresentation' && !checked) n.slideCount = '';
      if (name === 'paymentStatus' && value === 'paid') n.amountPaid = '';
      return n;
    });
    setError('');
  };

  const handleModeChange = (mode) => {
    setPricingMode(mode);
    setFd(prev => ({ ...prev, words: '', cpp: '', flatRate: '' }));
    setError('');
  };

  const calcPPT = () => toNum(fd.slideCount) * (400 / 3);

  const calcAmount = () => {
    const base = pricingMode === 'word_count'
      ? (toNum(fd.words) / 275) * toNum(fd.cpp)
      : toNum(fd.flatRate);
    const code = fd.hasCode ? toNum(fd.codeAmount) : 0;
    const ppt  = fd.hasPresentation ? calcPPT() : 0;
    const t = base + code + ppt;
    return isNaN(t) ? '0.00' : t.toFixed(2);
  };

  const calcBalance = () => (parseFloat(calcAmount()) - toNum(fd.amountPaid)).toFixed(2);

  const validate = () => {
    const errs = [];
    if (!fd.orderDate) errs.push('Order date required');
    if (!fd.submissionDate) errs.push('Submission date required');
    if (!fd.orderRefCode.trim()) errs.push('Reference code required');
    if (!fd.orderType) errs.push('Order type required');
    if (pricingMode === 'word_count') {
      const hw = fd.words.trim() !== '' && toNum(fd.words) > 0;
      const hc = fd.hasCode && fd.codeAmount.trim() !== '';
      const hp = fd.hasPresentation && fd.slideCount.trim() !== '';
      if (!hw && !hc && !hp) errs.push('Provide word count, code amount, or slide count');
      if (hw && toNum(fd.cpp) <= 0) errs.push('CPP required when word count is set');
    } else {
      const hf = toNum(fd.flatRate) > 0;
      const hc = fd.hasCode && fd.codeAmount.trim() !== '';
      const hp = fd.hasPresentation && fd.slideCount.trim() !== '';
      if (!hf && !hc && !hp) errs.push('Enter flat rate, code amount, or slide count');
    }
    if (fd.hasCode && toNum(fd.codeAmount) < 0) errs.push('Valid code amount required');
    if (fd.hasPresentation && toNum(fd.slideCount) < 0) errs.push('Valid slide count required');
    if (fd.paymentStatus === 'partial' && toNum(fd.amountPaid) <= 0) errs.push('Amount paid required for partial payment');
    if (fd.amountPaid && toNum(fd.amountPaid) > parseFloat(calcAmount())) errs.push('Amount paid exceeds total');
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (errs.length) { setError(errs.join('. ')); return; }
    setIsLoading(true); setError('');
    try {
      const pd = {
        orderDate: fd.orderDate, submissionDate: fd.submissionDate,
        orderRefCode: fd.orderRefCode, orderType: fd.orderType, topic: fd.topic,
        status: fd.status, priority: fd.priority, notes: fd.notes,
        paymentStatus: fd.paymentStatus, pricingMode,
        words: pricingMode === 'word_count' && toNum(fd.words) > 0 ? Math.round(toNum(fd.words)) : 0,
        cpp: pricingMode === 'word_count' && toNum(fd.cpp) > 0 ? toNum(fd.cpp) : 0,
        flatRate: pricingMode === 'flat_rate' && toNum(fd.flatRate) > 0 ? toNum(fd.flatRate) : 0,
        hasCode: Boolean(fd.hasCode),
        codeAmount: fd.hasCode && toNum(fd.codeAmount) > 0 ? toNum(fd.codeAmount) : 0,
        hasPresentation: Boolean(fd.hasPresentation),
        slideCount: fd.hasPresentation && toNum(fd.slideCount) > 0 ? Math.round(toNum(fd.slideCount)) : 0,
        amountPaid: fd.paymentStatus === 'partial' && toNum(fd.amountPaid) > 0 ? toNum(fd.amountPaid) : 0,
        amount: parseFloat(calcAmount()),
        balance: fd.paymentStatus === 'partial' ? parseFloat(calcBalance()) : 0,
        lastUpdated: new Date().toISOString(),
      };
      if (id) {
        if (fd.isCarryForward) pd.isCarryForward = true;
        if (fd.carryForwardFromId) pd.carryForwardFromId = fd.carryForwardFromId;
        await updateDoc(doc(db, 'projects', id), pd);
      } else {
        pd.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'projects'), pd);
      }
      navigate('/projects');
    } catch (e) { setError('Error saving: ' + e.message); }
    finally { setIsLoading(false); }
  };

  if (isLoading) return (
    <div className="page-loader">
      <div className="spinner-ring" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      <span className="small">Loading...</span>
    </div>
  );

  const writingCost = pricingMode === 'word_count'
    ? (toNum(fd.words) / 275) * toNum(fd.cpp)
    : toNum(fd.flatRate);
  const totalAmt = parseFloat(calcAmount());
  const hasBreakdown =
    (pricingMode === 'word_count' && toNum(fd.words) > 0) ||
    (pricingMode === 'flat_rate' && toNum(fd.flatRate) > 0) ||
    (fd.hasCode && toNum(fd.codeAmount) > 0) ||
    (fd.hasPresentation && toNum(fd.slideCount) > 0);

  const priTone = { low: 'success', medium: 'warning', high: 'danger', urgent: 'danger' };
  const priorityTone = priTone[fd.priority] || 'secondary';

  const submitLabel = id
    ? <><i className="bi bi-check2-circle" aria-hidden="true" /> Update Project</>
    : <><i className="bi bi-plus-lg" aria-hidden="true" /> Create Project</>;

  return (
    <div className="pf-root has-action-bar">
      <form id="project-form" onSubmit={handleSubmit} noValidate>
        <div className="row g-3 g-xl-4 align-items-start">

          {/* Main form */}
          <div className="col-12 col-lg-8">
            <div className="card">
              <div className="card-header">
                <h1 className="page-title h4 mb-0">
                  <span className="title-chip">
                    <i className={`bi ${id ? 'bi-pencil-square' : 'bi-folder-plus'}`} aria-hidden="true" />
                  </span>
                  {id ? 'Edit Project' : 'Create New Project'}
                </h1>
              </div>

              <div className="card-body">
                {error && (
                  <div className="alert alert-danger d-flex align-items-start gap-2 py-2" role="alert">
                    <i className="bi bi-exclamation-triangle-fill mt-1" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                <h2 className="card-title-sm mb-3"><i className="bi bi-info-circle" aria-hidden="true" /> Basic Information</h2>
                <div className="row g-3">
                  <div className="col-12 col-sm-6 col-xl-4">
                    <label className="form-label" htmlFor="orderDate">Order Date</label>
                    <input id="orderDate" className="form-control" type="date" name="orderDate" value={fd.orderDate} onChange={handleChange} required />
                  </div>
                  <div className="col-12 col-sm-6 col-xl-4">
                    <label className="form-label" htmlFor="submissionDate">Submission Date</label>
                    <input id="submissionDate" className="form-control" type="date" name="submissionDate" value={fd.submissionDate} onChange={handleChange} required />
                  </div>
                  <div className="col-12 col-xl-4">
                    <label className="form-label" htmlFor="orderRefCode">Reference Code</label>
                    <input id="orderRefCode" className="form-control" type="text" name="orderRefCode" value={fd.orderRefCode} onChange={handleChange} placeholder="e.g. ORD-001" required />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label" htmlFor="orderType">Order Type</label>
                    <select id="orderType" className="form-select" name="orderType" value={fd.orderType} onChange={handleChange} required>
                      <option value="normal">Normal</option>
                      <option value="dissertation">Dissertation</option>
                    </select>
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label" htmlFor="priority">Priority</label>
                    <select id="priority" className="form-select" name="priority" value={fd.priority} onChange={handleChange}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="topic">Topic</label>
                    <input id="topic" className="form-control" type="text" name="topic" value={fd.topic} onChange={handleChange} placeholder="Enter project topic" />
                  </div>
                </div>

                <hr className="my-4" />

                <h2 className="card-title-sm mb-3"><i className="bi bi-calculator" aria-hidden="true" /> Pricing Details</h2>
                <div className="seg mb-3" role="group" aria-label="Pricing mode">
                  {[['word_count', 'bi-file-earmark-text', 'Word Count'], ['flat_rate', 'bi-cash-coin', 'Flat Rate']].map(([mode, icon, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={pricingMode === mode ? 'active' : ''}
                      aria-pressed={pricingMode === mode}
                      onClick={() => handleModeChange(mode)}
                    >
                      <i className={`bi ${icon}`} aria-hidden="true" /> {label}
                    </button>
                  ))}
                </div>

                <p className="form-text mb-3">
                  {pricingMode === 'word_count'
                    ? 'Cost is calculated automatically from the word count and cost-per-page rate.'
                    : 'Use this when the client gives a fixed agreed price with no word count specified.'}
                </p>

                {pricingMode === 'word_count' && (
                  <div className="row g-3">
                    <div className="col-12 col-sm-6">
                      <label className="form-label" htmlFor="words">Word Count</label>
                      <input
                        id="words"
                        className="form-control"
                        type="text"
                        inputMode="numeric"
                        name="words"
                        value={fd.words}
                        onChange={handleChange}
                        placeholder="e.g. 3000"
                      />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label" htmlFor="cpp">Cost Per Page (CPP)</label>
                      <select
                        id="cpp"
                        className="form-select"
                        name="cpp"
                        value={fd.cpp}
                        onChange={handleChange}
                        disabled={toNum(fd.words) <= 0}
                      >
                        <option value="">Select CPP</option>
                        <option value="350">Ksh. 350</option>
                        <option value="400">Ksh. 400</option>
                      </select>
                      {toNum(fd.words) > 0 && toNum(fd.cpp) > 0 && (
                        <div className="form-text mono">
                          {fd.words} ÷ 275 × {fd.cpp} = Ksh.{((toNum(fd.words) / 275) * toNum(fd.cpp)).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {pricingMode === 'flat_rate' && (
                  <div style={{ maxWidth: 320 }}>
                    <label className="form-label" htmlFor="flatRate">Agreed Amount</label>
                    <div className="input-group">
                      <span className="input-group-text">Ksh.</span>
                      <input id="flatRate" className="form-control" type="text" inputMode="decimal" name="flatRate" value={fd.flatRate} onChange={handleChange} placeholder="0.00" />
                    </div>
                  </div>
                )}

                {/* Add-ons */}
                <div className="row g-3 mt-1">
                  <div className="col-12 col-sm-6">
                    <div className="addon-box">
                      <div className="form-check form-switch mb-0">
                        <input className="form-check-input" type="checkbox" role="switch" id="hasCode" name="hasCode" checked={fd.hasCode} onChange={handleChange} />
                        <label className="form-check-label fw-semibold" htmlFor="hasCode"><i className="bi bi-code-slash me-1" aria-hidden="true" />Project includes code</label>
                      </div>
                      {fd.hasCode && (
                        <div className="mt-3">
                          <label className="form-label" htmlFor="codeAmount">Code Amount (Ksh.)</label>
                          <input id="codeAmount" className="form-control" type="text" inputMode="decimal" name="codeAmount" value={fd.codeAmount} onChange={handleChange} placeholder="0.00" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-12 col-sm-6">
                    <div className="addon-box">
                      <div className="form-check form-switch mb-0">
                        <input className="form-check-input" type="checkbox" role="switch" id="hasPresentation" name="hasPresentation" checked={fd.hasPresentation} onChange={handleChange} />
                        <label className="form-check-label fw-semibold" htmlFor="hasPresentation"><i className="bi bi-easel me-1" aria-hidden="true" />Includes presentation</label>
                      </div>
                      {fd.hasPresentation && (
                        <div className="mt-3">
                          <label className="form-label" htmlFor="slideCount">Slide Count</label>
                          <input id="slideCount" className="form-control" type="text" inputMode="numeric" name="slideCount" value={fd.slideCount} onChange={handleChange} placeholder="0" />
                          {toNum(fd.slideCount) > 0 && (
                            <div className="form-text mono">
                              Ksh.{calcPPT().toFixed(2)} (@ Ksh.400 / 3 slides)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="my-4" />

                <div className="row g-4">
                  <div className="col-12 col-sm-6">
                    <h2 className="card-title-sm mb-3"><i className="bi bi-credit-card" aria-hidden="true" /> Payment Information</h2>
                    <label className="form-label" htmlFor="paymentStatus">Payment Status</label>
                    <select id="paymentStatus" className="form-select" name="paymentStatus" value={fd.paymentStatus} onChange={handleChange}>
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partially Paid</option>
                      <option value="paid">Fully Paid</option>
                    </select>
                    {fd.paymentStatus === 'partial' && (
                      <div className="mt-3">
                        <label className="form-label" htmlFor="amountPaid">Amount Paid (Ksh.)</label>
                        <input id="amountPaid" className="form-control" type="text" inputMode="decimal" name="amountPaid" value={fd.amountPaid} onChange={handleChange} placeholder="0.00" />
                      </div>
                    )}
                  </div>
                  <div className="col-12 col-sm-6">
                    <h2 className="card-title-sm mb-3"><i className="bi bi-flag" aria-hidden="true" /> Project Status</h2>
                    <label className="form-label" htmlFor="status">Status</label>
                    <select id="status" className="form-select" name="status" value={fd.status} onChange={handleChange}>
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <hr className="my-4" />

                <h2 className="card-title-sm mb-3"><i className="bi bi-journal-text" aria-hidden="true" /> Notes</h2>
                <textarea className="form-control" name="notes" value={fd.notes} onChange={handleChange} rows={3} placeholder="Additional notes, instructions, or comments…" aria-label="Notes" />
              </div>
            </div>
          </div>

          {/* Summary column */}
          <div className="col-12 col-lg-4">
            <div className="sticky-side d-flex flex-column gap-3">
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title-sm"><i className="bi bi-receipt" aria-hidden="true" /> Cost Breakdown</h2>
                </div>
                <div className="card-body">
                  {hasBreakdown ? (
                    <>
                      {pricingMode === 'word_count' && toNum(fd.words) > 0 && (
                        <>
                          <div className="kv"><span>Writing Cost</span><span className="num">Ksh.{writingCost.toFixed(2)}</span></div>
                          <div className="form-text mono mb-1">{fd.words} ÷ 275 × Ksh.{fd.cpp || 0}</div>
                        </>
                      )}
                      {pricingMode === 'flat_rate' && toNum(fd.flatRate) > 0 && (
                        <div className="kv"><span>Flat Rate</span><span className="num">Ksh.{writingCost.toFixed(2)}</span></div>
                      )}
                      {fd.hasCode && toNum(fd.codeAmount) > 0 && (
                        <div className="kv"><span>Code</span><span className="num">Ksh.{toNum(fd.codeAmount).toFixed(2)}</span></div>
                      )}
                      {fd.hasPresentation && toNum(fd.slideCount) > 0 && (
                        <>
                          <div className="kv"><span>Presentation</span><span className="num">Ksh.{calcPPT().toFixed(2)}</span></div>
                          <div className="form-text mono mb-1">{fd.slideCount} slides</div>
                        </>
                      )}
                      <div className="hr-dashed" />
                      <div className="kv kv-total"><span>Total</span><span className="num">Ksh.{calcAmount()}</span></div>
                      {fd.paymentStatus === 'partial' && toNum(fd.amountPaid) > 0 && (
                        <>
                          <div className="hr-dashed" />
                          <div className="kv text-ink-success"><span>Paid</span><span className="num">Ksh.{toNum(fd.amountPaid).toFixed(2)}</span></div>
                          <div className="kv text-ink-danger fw-bold"><span>Balance</span><span className="num">Ksh.{calcBalance()}</span></div>
                        </>
                      )}
                      <div className="mt-3">
                        {fd.paymentStatus === 'paid' && (
                          <span className="pill pill-success"><i className="bi bi-check-circle-fill" aria-hidden="true" /> Fully Paid</span>
                        )}
                        {fd.paymentStatus === 'unpaid' && totalAmt > 0 && (
                          <span className="pill pill-warning"><i className="bi bi-clock" aria-hidden="true" /> Unpaid</span>
                        )}
                        {fd.paymentStatus === 'partial' && (
                          <span className="pill pill-info"><i className="bi bi-hourglass-split" aria-hidden="true" /> Partial</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-secondary small py-2">
                      <i className="bi bi-receipt fs-2 d-block opacity-50 mb-1" aria-hidden="true" />
                      Fill in pricing details<br />to see a summary
                    </div>
                  )}
                </div>
              </div>

              {fd.priority && (
                <div className="card">
                  <div className="card-body py-2 d-flex align-items-center gap-2">
                    <span className={`pill pill-${priorityTone}`}>
                      <i className="bi bi-flag-fill" aria-hidden="true" /> {fd.priority.charAt(0).toUpperCase() + fd.priority.slice(1)}
                    </span>
                    <span className="small text-secondary">priority</span>
                  </div>
                </div>
              )}

              {/* Desktop actions */}
              <div className="d-none d-lg-flex flex-column gap-2">
                <button type="submit" className="btn btn-primary btn-lg" disabled={isLoading}>
                  {submitLabel}
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/projects')}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Phone / tablet actions stay reachable while scrolling */}
      <div className="mobile-action-bar d-lg-none">
        <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/projects')}>
          Cancel
        </button>
        <button type="submit" form="project-form" className="btn btn-primary" disabled={isLoading}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

export default ProjectForm;
