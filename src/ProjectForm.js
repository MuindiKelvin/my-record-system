import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const MONO = "'IBM Plex Mono', 'Fira Code', 'Cascadia Code', monospace";

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
  width: '100%', fontFamily: MONO, fontSize: '0.82rem',
  background: '#fff', border: '1px solid #ced4da', borderRadius: '4px',
  color: '#212529', padding: '0.42rem 0.75rem', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

function FI({ style, ...p }) {
  return (
    <input style={{ ...inputBase, ...style }}
      onFocus={e => { e.target.style.borderColor = '#86b7fe'; e.target.style.boxShadow = '0 0 0 3px rgba(13,110,253,0.15)'; }}
      onBlur={e => { e.target.style.borderColor = '#ced4da'; e.target.style.boxShadow = 'none'; }}
      {...p} />
  );
}

function FS({ style, children, ...p }) {
  return (
    <select
      style={{
        ...inputBase, appearance: 'none', cursor: 'pointer', paddingRight: '2rem',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236c757d' stroke-width='1.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', ...style,
      }}
      onFocus={e => { e.target.style.borderColor = '#86b7fe'; e.target.style.boxShadow = '0 0 0 3px rgba(13,110,253,0.15)'; }}
      onBlur={e => { e.target.style.borderColor = '#ced4da'; e.target.style.boxShadow = 'none'; }}
      {...p}
    >{children}</select>
  );
}

function FTA({ style, ...p }) {
  return (
    <textarea style={{ ...inputBase, resize: 'vertical', ...style }}
      onFocus={e => { e.target.style.borderColor = '#86b7fe'; e.target.style.boxShadow = '0 0 0 3px rgba(13,110,253,0.15)'; }}
      onBlur={e => { e.target.style.borderColor = '#ced4da'; e.target.style.boxShadow = 'none'; }}
      {...p} />
  );
}

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


function Toggle({ checked, onChange, id, name, label }) {
  return (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ position: 'relative', width: '36px', height: '20px', flexShrink: 0 }}>
        <input
          type="checkbox"
          id={id}
          name={name}          // ← was missing; handleChange needs this
          checked={checked}
          onChange={onChange}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '10px',
          background: checked ? '#0d6efd' : '#dee2e6',
          transition: 'background 0.2s',
        }} />
        <div style={{
          position: 'absolute', top: '3px', left: checked ? '19px' : '3px',
          width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
        }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: '0.82rem', color: '#212529', letterSpacing: '0.02em' }}>{label}</span>
    </label>
  );
}

function BRow({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: MONO, fontSize: '0.8rem', color: color || '#495057', fontWeight: bold ? 700 : 400, padding: '0.2rem 0', gap: '0.5rem' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function G2({ children, style }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', ...style }}>
      {children}
    </div>
  );
}

function G3({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
      {children}
    </div>
  );
}


// Helpers 

// ✅ FIX: Safe numeric parser — returns 0 for empty/invalid, handles string input from text fields
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
    <div style={{ minHeight: '100vh', background: '#1a1f2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem' }}>
      <div className="spinner-border text-primary" role="status" style={{ width: '2rem', height: '2rem' }}>
        <span className="visually-hidden">Loading…</span>
      </div>
      <p style={{ fontFamily: MONO, fontSize: '0.75rem', color: '#6c757d', margin: 0 }}>Loading…</p>
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

  const priColors = { low: '#198754', medium: '#fd7e14', high: '#dc3545', urgent: '#9b0000' };
  const priColor = priColors[fd.priority] || '#6c757d';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }
        /* ✅ FIX: Removed webkit-spin-button suppression — it was interfering with number inputs on some browsers.
           Using type="text" + inputmode for integer fields instead. */
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .pf-layout { display: grid; grid-template-columns: 1fr 300px; gap: 1.25rem; align-items: start; }
        @media (max-width: 860px) { .pf-layout { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#1a1f2e', padding: '1.25rem 1.5rem', fontFamily: MONO }}>
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <form onSubmit={handleSubmit} noValidate>
            <div className="pf-layout">

              {/*  LEFT  */}
              <div style={{ background: '#fff', borderRadius: '6px', boxShadow: '0 2px 12px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                <div style={{ background: '#0d6efd', padding: '0.85rem 1.25rem' }}>
                  <h2 style={{ fontFamily: MONO, fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
                    {id ? 'Edit Project' : 'Create New Project'}
                  </h2>
                </div>

                <div style={{ padding: '1.25rem' }}>

                  {error && (
                    <div style={{ fontFamily: MONO, fontSize: '0.8rem', background: '#f8d7da', border: '1px solid #f5c2c7', borderRadius: '4px', color: '#842029', padding: '0.6rem 0.85rem', marginBottom: '1rem', display: 'flex', gap: '0.45rem', animation: 'slideIn 0.2s ease' }}>
                      <span>⚠</span><span>{error}</span>
                    </div>
                  )}

                  <SectionLabel>Basic Information</SectionLabel>
                  <G3>
                    <div>
                      <FL>Order Date</FL>
                      <FI type="date" name="orderDate" value={fd.orderDate} onChange={handleChange} required />
                    </div>
                    <div>
                      <FL>Submission Date</FL>
                      <FI type="date" name="submissionDate" value={fd.submissionDate} onChange={handleChange} required />
                    </div>
                    <div>
                      <FL>Reference Code</FL>
                      <FI type="text" name="orderRefCode" value={fd.orderRefCode} onChange={handleChange} placeholder="e.g. ORD-001" required />
                    </div>
                  </G3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <div>
                      <FL>Order Type</FL>
                      <FS name="orderType" value={fd.orderType} onChange={handleChange} required>
                        <option value="normal">Normal</option>
                        <option value="dissertation">Dissertation</option>
                      </FS>
                    </div>
                    <div>
                      <FL>Priority</FL>
                      <FS name="priority" value={fd.priority} onChange={handleChange}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </FS>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <FL>Topic</FL>
                    <FI type="text" name="topic" value={fd.topic} onChange={handleChange} placeholder="Enter project topic" />
                  </div>

                  <Divider />

                  <SectionLabel>Pricing Details</SectionLabel>

                  <div style={{ display: 'inline-flex', border: '1px solid #dee2e6', borderRadius: '6px', padding: '3px', gap: '2px', marginBottom: '0.85rem', background: '#f8f9fa' }}>
                    {[['word_count', '📄 Word Count'], ['flat_rate', '💰 Flat Rate']].map(([mode, label]) => (
                      <button key={mode} type="button" onClick={() => handleModeChange(mode)}
                        style={{ fontFamily: MONO, fontSize: '0.78rem', fontWeight: pricingMode === mode ? 700 : 500, padding: '0.35rem 1rem', borderRadius: '4px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: pricingMode === mode ? '#0d6efd' : 'transparent', color: pricingMode === mode ? '#fff' : '#6c757d' }}
                      >{label}</button>
                    ))}
                  </div>

                  <p style={{ fontFamily: MONO, fontSize: '0.7rem', color: '#6c757d', margin: '0 0 0.85rem', letterSpacing: '0.02em' }}>
                    {pricingMode === 'word_count'
                      ? 'Cost is calculated automatically from the word count and cost-per-page rate.'
                      : 'Use this when the client gives a fixed agreed price with no word count specified.'}
                  </p>

                  {pricingMode === 'word_count' && (
                    <G2>
                      <div>
                        <FL>Word Count</FL>
                        {/* ✅ FIX: type="text" + inputMode="numeric" so the full number can be typed/pasted freely */}
                        <FI
                          type="text"
                          inputMode="numeric"
                          name="words"
                          value={fd.words}
                          onChange={handleChange}
                          placeholder="e.g. 3000"
                        />
                      </div>
                      <div>
                        <FL>Cost Per Page (CPP)</FL>
                        <FS
                          name="cpp"
                          value={fd.cpp}
                          onChange={handleChange}
                          disabled={toNum(fd.words) <= 0}
                          style={{ opacity: toNum(fd.words) > 0 ? 1 : 0.55, background: toNum(fd.words) > 0 ? '#fff' : '#f8f9fa' }}
                        >
                          <option value="">Select CPP</option>
                          <option value="350">Ksh. 350</option>
                          <option value="400">Ksh. 400</option>
                        </FS>
                        {toNum(fd.words) > 0 && toNum(fd.cpp) > 0 && (
                          <p style={{ fontFamily: MONO, fontSize: '0.68rem', color: '#6c757d', margin: '0.25rem 0 0' }}>
                            {fd.words} ÷ 275 × {fd.cpp} = Ksh.{((toNum(fd.words) / 275) * toNum(fd.cpp)).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </G2>
                  )}

                  {pricingMode === 'flat_rate' && (
                    <div style={{ maxWidth: '260px' }}>
                      <FL>Agreed Amount</FL>
                      <div style={{ display: 'flex' }}>
                        <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.65rem', background: '#e9ecef', border: '1px solid #ced4da', borderRight: 'none', borderRadius: '4px 0 0 4px', fontFamily: MONO, fontSize: '0.78rem', color: '#495057', flexShrink: 0 }}>Ksh.</span>
                        <FI type="text" inputMode="decimal" name="flatRate" value={fd.flatRate} onChange={handleChange} placeholder="0.00" style={{ borderRadius: '0 4px 4px 0' }} />
                      </div>
                    </div>
                  )}

                  {/* Add-ons */}
                  <div style={{ marginTop: '0.85rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '6px', padding: '0.75rem' }}>
                      {/* ✅ FIX: name prop passed to Toggle so handleChange can identify the field */}
                      <Toggle id="hasCode" name="hasCode" checked={fd.hasCode} onChange={handleChange} label="Project includes code" />
                      {fd.hasCode && (
                        <div style={{ marginTop: '0.6rem', animation: 'slideIn 0.15s ease' }}>
                          <FL>Code Amount (Ksh.)</FL>
                          <FI type="text" inputMode="decimal" name="codeAmount" value={fd.codeAmount} onChange={handleChange} placeholder="0.00" />
                        </div>
                      )}
                    </div>
                    <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '6px', padding: '0.75rem' }}>
                      {/* ✅ FIX: name prop passed to Toggle */}
                      <Toggle id="hasPresentation" name="hasPresentation" checked={fd.hasPresentation} onChange={handleChange} label="Includes presentation" />
                      {fd.hasPresentation && (
                        <div style={{ marginTop: '0.6rem', animation: 'slideIn 0.15s ease' }}>
                          <FL>Slide Count</FL>
                          <FI type="text" inputMode="numeric" name="slideCount" value={fd.slideCount} onChange={handleChange} placeholder="0" />
                          {toNum(fd.slideCount) > 0 && (
                            <p style={{ fontFamily: MONO, fontSize: '0.68rem', color: '#6c757d', margin: '0.25rem 0 0' }}>
                              Ksh.{calcPPT().toFixed(2)} (@ Ksh.400 / 3 slides)
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <Divider />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div>
                      <SectionLabel>Payment Information</SectionLabel>
                      <div>
                        <FL>Payment Status</FL>
                        <FS name="paymentStatus" value={fd.paymentStatus} onChange={handleChange}>
                          <option value="unpaid">Unpaid</option>
                          <option value="partial">Partially Paid</option>
                          <option value="paid">Fully Paid</option>
                        </FS>
                      </div>
                      {fd.paymentStatus === 'partial' && (
                        <div style={{ marginTop: '0.65rem', animation: 'slideIn 0.15s ease' }}>
                          <FL>Amount Paid (Ksh.)</FL>
                          <FI type="text" inputMode="decimal" name="amountPaid" value={fd.amountPaid} onChange={handleChange} placeholder="0.00" />
                        </div>
                      )}
                    </div>
                    <div>
                      <SectionLabel>Project Status</SectionLabel>
                      <div>
                        <FL>Status</FL>
                        <FS name="status" value={fd.status} onChange={handleChange}>
                          <option value="pending">Pending</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </FS>
                      </div>
                    </div>
                  </div>

                  <Divider />

                  <SectionLabel>Notes</SectionLabel>
                  <FTA name="notes" value={fd.notes} onChange={handleChange} rows={3} placeholder="Additional notes, instructions, or comments…" />

                </div>
              </div>

              {/*  RIGHT sidebar  */}
              <div style={{ position: 'sticky', top: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

                <div style={{ background: '#fff', borderRadius: '6px', boxShadow: '0 2px 12px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                  <div style={{ background: '#f8f9fa', borderBottom: '1px solid #dee2e6', padding: '0.6rem 1rem' }}>
                    <span style={{ fontFamily: MONO, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#495057' }}>Cost Breakdown</span>
                  </div>
                  <div style={{ padding: '0.85rem 1rem' }}>
                    {hasBreakdown ? (
                      <>
                        {pricingMode === 'word_count' && toNum(fd.words) > 0 && (
                          <>
                            <BRow label="Writing Cost" value={`Ksh.${writingCost.toFixed(2)}`} />
                            <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#adb5bd', margin: '0 0 0.3rem 0' }}>
                              {fd.words} ÷ 275 × Ksh.{fd.cpp || 0}
                            </p>
                          </>
                        )}
                        {pricingMode === 'flat_rate' && toNum(fd.flatRate) > 0 && (
                          <BRow label="Flat Rate" value={`Ksh.${writingCost.toFixed(2)}`} />
                        )}
                        {fd.hasCode && toNum(fd.codeAmount) > 0 && (
                          <BRow label="Code" value={`Ksh.${toNum(fd.codeAmount).toFixed(2)}`} />
                        )}
                        {fd.hasPresentation && toNum(fd.slideCount) > 0 && (
                          <>
                            <BRow label="Presentation" value={`Ksh.${calcPPT().toFixed(2)}`} />
                            <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#adb5bd', margin: '0 0 0.3rem 0' }}>
                              {fd.slideCount} slides
                            </p>
                          </>
                        )}
                        <div style={{ borderTop: '1px dashed #dee2e6', margin: '0.5rem 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '0.95rem', fontWeight: 800, color: '#212529' }}>
                          <span>Total</span><span>Ksh.{calcAmount()}</span>
                        </div>
                        {fd.paymentStatus === 'partial' && toNum(fd.amountPaid) > 0 && (
                          <>
                            <div style={{ borderTop: '1px dashed #dee2e6', margin: '0.5rem 0' }} />
                            <BRow label="Paid" value={`Ksh.${toNum(fd.amountPaid).toFixed(2)}`} color="#198754" />
                            <BRow label="Balance" value={`Ksh.${calcBalance()}`} color="#dc3545" bold />
                          </>
                        )}
                        <div style={{ marginTop: '0.65rem' }}>
                          {fd.paymentStatus === 'paid' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontFamily: MONO, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#0f5132', background: '#d1e7dd', border: '1px solid #a3cfbb', borderRadius: '4px', padding: '0.25rem 0.6rem' }}>
                              ✓ Fully Paid
                            </span>
                          )}
                          {fd.paymentStatus === 'unpaid' && totalAmt > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontFamily: MONO, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#664d03', background: '#fff3cd', border: '1px solid #ffda6a', borderRadius: '4px', padding: '0.25rem 0.6rem' }}>
                              Unpaid
                            </span>
                          )}
                          {fd.paymentStatus === 'partial' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontFamily: MONO, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#084298', background: '#cfe2ff', border: '1px solid #9ec5fe', borderRadius: '4px', padding: '0.25rem 0.6rem' }}>
                              Partial
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p style={{ fontFamily: MONO, fontSize: '0.72rem', color: '#adb5bd', margin: 0, textAlign: 'center', padding: '0.35rem 0', lineHeight: 1.6 }}>
                        Fill in pricing details<br />to see a summary
                      </p>
                    )}
                  </div>
                </div>

                {fd.priority && (
                  <div style={{ background: '#fff', borderRadius: '6px', boxShadow: '0 2px 12px rgba(0,0,0,0.3)', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: priColor, flexShrink: 0 }} />
                    <span style={{ fontFamily: MONO, fontSize: '0.72rem', color: '#495057' }}>
                      <span style={{ fontWeight: 700, color: priColor }}>{fd.priority.charAt(0).toUpperCase() + fd.priority.slice(1)}</span> priority
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button type="submit" disabled={isLoading}
                    style={{ fontFamily: MONO, fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.04em', background: isLoading ? '#6ea8fe' : '#0d6efd', border: 'none', borderRadius: '4px', color: '#fff', padding: '0.6rem 1rem', cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = '#0b5ed7'; }}
                    onMouseLeave={e => { if (!isLoading) e.currentTarget.style.background = '#0d6efd'; }}
                  >
                    {isLoading
                      ? <><span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Saving…</>
                      : (id ? '✓ Update Project' : '+ Create Project')
                    }
                  </button>
                  <button type="button" onClick={() => navigate('/projects')}
                    style={{ fontFamily: MONO, fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.04em', background: '#6c757d', border: 'none', borderRadius: '4px', color: '#fff', padding: '0.55rem 1rem', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#5c636a'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#6c757d'; }}
                  >Cancel</button>
                </div>

              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default ProjectForm;