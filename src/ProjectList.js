import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc, addDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import * as XLSX from 'xlsx';
import { CSVLink } from 'react-csv';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaListAlt, FaFileExcel, FaFileCsv,
  FaFilter, FaSort, FaSearch, FaCalendarAlt,
  FaFileImport, FaGraduationCap,
  FaPencilAlt, FaTrashAlt
} from 'react-icons/fa';

// ─────────────────────────────────────────────────────────────────────────────
// Font style: IBM Plex Mono / Fira Code / monospace
// ─────────────────────────────────────────────────────────────────────────────
const MONO_FONT = "'IBM Plex Mono', 'Fira Code', monospace";
const monoStyle = { fontFamily: MONO_FONT };

// ─────────────────────────────────────────────────────────────────────────────
// ActionButton — icon pill with slide-in label on hover
// ─────────────────────────────────────────────────────────────────────────────
function ActionButton({ icon: Icon, label, onClick, variant }) {
  const [hovered, setHovered] = useState(false);

  const palette = {
    edit: {
      idle:    { bg: '#e8f0fe', iconColor: '#1a73e8', border: '#c5d8ff' },
      hover:   { bg: '#1a73e8', iconColor: '#fff',    border: '#1a73e8' },
      shadow:  '0 4px 14px rgba(26,115,232,0.35)',
    },
    delete: {
      idle:    { bg: '#fce8e8', iconColor: '#d93025', border: '#f5c6c4' },
      hover:   { bg: '#d93025', iconColor: '#fff',    border: '#d93025' },
      shadow:  '0 4px 14px rgba(217,48,37,0.35)',
    },
  };

  const p      = palette[variant] || palette.edit;
  const colors = hovered ? p.hover : p.idle;

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        overflow: 'hidden',
        padding: '0 10px',
        height: '30px',
        border: `1.5px solid ${colors.border}`,
        borderRadius: '20px',
        background: colors.bg,
        cursor: 'pointer',
        outline: 'none',
        boxShadow: hovered ? p.shadow : 'none',
        transition: 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        fontFamily: MONO_FONT,
        whiteSpace: 'nowrap',
      }}
      whileTap={{ scale: 0.92 }}
    >
      {/* Icon */}
      <motion.span
        animate={{ color: colors.iconColor }}
        transition={{ duration: 0.15 }}
        style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem' }}
      >
        <Icon />
      </motion.span>

      {/* Label — slides in on hover */}
      <AnimatePresence initial={false}>
        {hovered && (
          <motion.span
            key="label"
            initial={{ width: 0, opacity: 0, marginLeft: 0 }}
            animate={{ width: 'auto', opacity: 1, marginLeft: 5 }}
            exit={{ width: 0, opacity: 0, marginLeft: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              display: 'inline-block',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: colors.iconColor,
              fontFamily: MONO_FONT,
              overflow: 'hidden',
            }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dissertation Invoice Generator — with Code Amount support
// ─────────────────────────────────────────────────────────────────────────────
function generateDissertationInvoice(dissertationProjects, targetMonthLabel, format = 'xlsx') {

  const clientMap = new Map();

  for (const p of dissertationProjects) {
    const key = (p.orderRefCode || p.topic || 'Unknown').trim();
    if (!clientMap.has(key)) {
      clientMap.set(key, { code: key, rows: [], projectCodes: [], pptRows: [] });
    }
    const entry = clientMap.get(key);

    const topicLower     = String(p.topic     || '').toLowerCase();
    const orderTypeLower = String(p.orderType || '').toLowerCase();

    const isPPT =
      p.hasPresentation === true ||
      topicLower.includes('ppt') || topicLower.includes('presentation') || topicLower.includes('slides') ||
      orderTypeLower.includes('ppt') || orderTypeLower.includes('presentation');

    const isProjectCode =
      !isPPT &&
      (!p.words || Number(p.words) === 0) &&
      (topicLower.includes('project code') || orderTypeLower.includes('code'));

    if (isPPT)              entry.pptRows.push(p);
    else if (isProjectCode) entry.projectCodes.push(p);
    else                    entry.rows.push(p);
  }

  const monthKeySet = new Set();
  for (const [, client] of clientMap) {
    for (const p of client.rows) {
      const d  = new Date(p.orderDate);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthKeySet.add(mk);
    }
  }
  const monthKeys   = Array.from(monthKeySet).sort();
  const monthLabels = monthKeys.map(mk => {
    const [yr, mo] = mk.split('-');
    return new Date(Number(yr), Number(mo) - 1, 1).toLocaleString('default', { month: 'long' });
  });

  const monthCount    = monthKeys.length;
  const CPP_COL_IDX   = 2 + monthCount;
  const AMT_COL_IDX   = CPP_COL_IDX  + 1;
  const CODE_COL_IDX  = AMT_COL_IDX  + 1;
  const TOTAL_COL_IDX = CODE_COL_IDX + 1;
  const PAID_COL_IDX  = TOTAL_COL_IDX + 1;
  const COL_COUNT = PAID_COL_IDX + 1;

  const cppColLetter   = XLSX.utils.encode_col(CPP_COL_IDX);
  const amtColLetter   = XLSX.utils.encode_col(AMT_COL_IDX);
  const codeColLetter  = XLSX.utils.encode_col(CODE_COL_IDX);
  const totalColLetter = XLSX.utils.encode_col(TOTAL_COL_IDX);
  const paidColLetter  = XLSX.utils.encode_col(PAID_COL_IDX);

  const headerRow = [
    'Code', 'Assignment',
    ...monthLabels,
    'CPP', 'Amount', 'Code', 'Total Due', 'Amount Paid'
  ];

  const dataRows    = [headerRow];
  const formulaRows = [];

  let excelRowIdx = 2;

  const clientAmountPaid = (client) => {
    const allRows = [...client.rows, ...client.projectCodes, ...(client.pptRows || [])];
    return allRows.reduce((sum, p) => {
      const status = (p.paymentStatus || 'unpaid').toLowerCase();
      if (status === 'paid')    return sum + (Number(p.amountPaid) > 0 ? Number(p.amountPaid) : Number(p.amount) || 0);
      if (status === 'partial') return sum + (Number(p.amountPaid) || 0);
      return sum;
    }, 0);
  };

  for (const [, client] of clientMap) {
    const totalAmountPaid = clientAmountPaid(client);
    let firstRowWritten = false;

    for (const p of client.rows) {
      const wordCols = monthKeys.map(mk => {
        const d  = new Date(p.orderDate);
        const pk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return pk === mk ? (Number(p.words) || 0) : '';
      });

      const cpp     = Number(p.cpp) || 400;
      const codeAmt = p.hasCode ? (Number(p.codeAmount) || 0) : '';

      const monthColOffset = monthKeys.findIndex(mk => {
        const d  = new Date(p.orderDate);
        return mk === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      });
      const wordColLetter = XLSX.utils.encode_col(2 + monthColOffset);

      const amountPaidCell = !firstRowWritten ? totalAmountPaid : '';
      firstRowWritten = true;

      const row = new Array(COL_COUNT).fill('');
      row[0]             = p.orderRefCode || '';
      row[1]             = p.topic || '';
      wordCols.forEach((v, i) => { row[2 + i] = v; });
      row[CPP_COL_IDX]   = cpp;
      row[AMT_COL_IDX]   = null;
      row[CODE_COL_IDX]  = codeAmt;
      row[TOTAL_COL_IDX] = null;
      row[PAID_COL_IDX]  = amountPaidCell;

      dataRows.push(row);
      formulaRows.push({ excelRow: excelRowIdx, wordCol: wordColLetter, hasCode: p.hasCode });
      excelRowIdx++;
    }

    for (const pt of (client.pptRows || [])) {
      const flatAmount = Number(pt.amount) || 0;
      const codeAmt    = pt.hasCode ? (Number(pt.codeAmount) || 0) : '';
      const slideInfo  = pt.slideCount ? ` (${pt.slideCount} slides)` : '';
      const label      = (pt.topic || 'PPT Presentation') + slideInfo;
      const totalAmt   = flatAmount + (Number(codeAmt) || 0);

      const amountPaidCell = !firstRowWritten ? totalAmountPaid : '';
      firstRowWritten = true;

      const row = new Array(COL_COUNT).fill('');
      row[0]             = pt.orderRefCode || '';
      row[1]             = label;
      row[AMT_COL_IDX]   = flatAmount;
      row[CODE_COL_IDX]  = codeAmt;
      row[TOTAL_COL_IDX] = totalAmt || '';
      row[PAID_COL_IDX]  = amountPaidCell;
      dataRows.push(row);
      excelRowIdx++;
    }

    for (const pc of client.projectCodes) {
      const flatAmount = Number(pc.amount) || 10000;
      const codeAmt    = pc.hasCode ? (Number(pc.codeAmount) || 0) : '';
      const totalAmt   = flatAmount + (Number(codeAmt) || 0);

      const amountPaidCell = !firstRowWritten ? totalAmountPaid : '';
      firstRowWritten = true;

      const row = new Array(COL_COUNT).fill('');
      row[0]             = pc.orderRefCode || '';
      row[1]             = 'Project Code';
      row[AMT_COL_IDX]   = flatAmount;
      row[CODE_COL_IDX]  = codeAmt;
      row[TOTAL_COL_IDX] = totalAmt || '';
      row[PAID_COL_IDX]  = amountPaidCell;
      dataRows.push(row);
      excelRowIdx++;
    }
  }

  const grandTotalAmountPaid = Array.from(clientMap.values()).reduce((sum, client) => {
    return sum + clientAmountPaid(client);
  }, 0);

  const totalRow = new Array(COL_COUNT).fill('');
  totalRow[CPP_COL_IDX - 1] = 'Total';
  totalRow[PAID_COL_IDX]    = grandTotalAmountPaid;
  dataRows.push(totalRow);

  const firstDataRow  = 2;
  const lastDataRow   = excelRowIdx - 1;
  const totalExcelRow = excelRowIdx + 1;

  if (format === 'csv') {
    const csvRows = dataRows.map((row, rIdx) => {
      if (rIdx === 0) return row;
      const fr = formulaRows.find(f => f.excelRow === rIdx + 1);
      if (fr) {
        const wordColIdx = XLSX.utils.decode_col(fr.wordCol);
        const words  = Number(row[wordColIdx]) || 0;
        const cpp    = Number(row[CPP_COL_IDX]) || 0;
        const amt    = words > 0 && cpp > 0 ? parseFloat((words / 275 * cpp).toFixed(2)) : 0;
        const code   = fr.hasCode ? (Number(row[CODE_COL_IDX]) || 0) : 0;
        const total  = amt + code;
        const newRow = [...row];
        newRow[AMT_COL_IDX]   = amt   || '';
        newRow[TOTAL_COL_IDX] = total || '';
        return newRow;
      }
      return row;
    });

    const monthYearLabel = targetMonthLabel || new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const csvContent = csvRows.map(row =>
      row.map(cell => {
        const v = cell === null || cell === undefined ? '' : String(cell);
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Kevz_Dissertations_Invoice_${monthYearLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(dataRows);

  for (const fr of formulaRows) {
    const r = fr.excelRow;
    ws[`${amtColLetter}${r}`] = {
      t: 'n',
      f: `=${fr.wordCol}${r}/275*${cppColLetter}${r}`
    };
    ws[`${totalColLetter}${r}`] = {
      t: 'n',
      f: fr.hasCode
        ? `=${amtColLetter}${r}+${codeColLetter}${r}`
        : `=${amtColLetter}${r}`
    };
  }

  ws[`${amtColLetter}${totalExcelRow}`]   = { t: 'n', f: `=SUM(${amtColLetter}${firstDataRow}:${amtColLetter}${lastDataRow})` };
  ws[`${codeColLetter}${totalExcelRow}`]  = { t: 'n', f: `=SUM(${codeColLetter}${firstDataRow}:${codeColLetter}${lastDataRow})` };
  ws[`${totalColLetter}${totalExcelRow}`] = { t: 'n', f: `=SUM(${totalColLetter}${firstDataRow}:${totalColLetter}${lastDataRow})` };
  ws[`${paidColLetter}${totalExcelRow}`]  = { t: 'n', f: `=SUM(${paidColLetter}${firstDataRow}:${paidColLetter}${lastDataRow})` };

  ws['!cols'] = [
    { wch: 14 },
    { wch: 30 },
    ...monthKeys.map(() => ({ wch: 10 })),
    { wch: 8  },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
  ];

  const HEADER_FILL = 'FF4472C4';
  const HEADER_FONT = 'FFFFFFFF';
  const EVEN_FILL   = 'FFDCE6F1';
  const ODD_FILL    = 'FFFFFFFF';
  const PC_FILL     = 'FFEDEDED';
  const CODE_FILL   = 'FFFFE0B2';

  for (let c = 0; c < headerRow.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) ws[cellRef] = { t: 's', v: headerRow[c] };
    const isCodeCol = c === CODE_COL_IDX;
    ws[cellRef].s = {
      font:      { bold: true, color: { rgb: isCodeCol ? 'FF7B3F00' : HEADER_FONT } },
      fill:      { fgColor: { rgb: isCodeCol ? CODE_FILL : HEADER_FILL } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        bottom: { style: 'thin', color: { rgb: 'FFCCCCCC' } },
        right:  { style: 'thin', color: { rgb: 'FFCCCCCC' } }
      }
    };
  }

  let styleRow  = 1;
  let clientIdx = 0;
  for (const [, client] of clientMap) {
    const fillRgb = clientIdx % 2 === 0 ? EVEN_FILL : ODD_FILL;

    for (let i = 0; i < client.rows.length; i++) {
      for (let c = 0; c < headerRow.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: styleRow, c });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
        ws[cellRef].s = {
          fill:      { fgColor: { rgb: c === CODE_COL_IDX && client.rows[i].hasCode ? 'FFFFF3E0' : fillRgb } },
          alignment: { horizontal: c >= 2 ? 'right' : 'left' },
          border:    { bottom: { style: 'hair', color: { rgb: 'FFCCCCCC' } } }
        };
      }
      styleRow++;
    }

    for (let i = 0; i < (client.pptRows || []).length; i++) {
      for (let c = 0; c < headerRow.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: styleRow, c });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
        ws[cellRef].s = {
          font:      { italic: true, color: { rgb: 'FF7B3F00' } },
          fill:      { fgColor: { rgb: 'FFFFF2CC' } },
          alignment: { horizontal: c >= 2 ? 'right' : 'left' },
          border:    { bottom: { style: 'hair', color: { rgb: 'FFCCCCCC' } } }
        };
      }
      styleRow++;
    }

    for (let i = 0; i < client.projectCodes.length; i++) {
      for (let c = 0; c < headerRow.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: styleRow, c });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
        ws[cellRef].s = {
          font:      { italic: true, color: { rgb: 'FF595959' } },
          fill:      { fgColor: { rgb: PC_FILL } },
          alignment: { horizontal: c >= 2 ? 'right' : 'left' }
        };
      }
      styleRow++;
    }
    clientIdx++;
  }

  styleRow++;
  const TOTAL_CELL_STYLE = {
    font:      { bold: true },
    alignment: { horizontal: 'right' },
    border:    { top: { style: 'thin', color: { rgb: 'FF000000' } } }
  };

  const totalLabelRef = XLSX.utils.encode_cell({ r: styleRow, c: CPP_COL_IDX - 1 });
  ws[totalLabelRef] = { t: 's', v: 'Total', s: { font: { bold: true }, alignment: { horizontal: 'right' } } };

  [AMT_COL_IDX, CODE_COL_IDX, TOTAL_COL_IDX].forEach(colIdx => {
    const ref = XLSX.utils.encode_cell({ r: styleRow, c: colIdx });
    if (!ws[ref]) ws[ref] = { t: 'n', v: 0 };
    ws[ref].s = TOTAL_CELL_STYLE;
  });

  const totalPaidRef = XLSX.utils.encode_cell({ r: styleRow, c: PAID_COL_IDX });
  if (!ws[totalPaidRef]) ws[totalPaidRef] = { t: 'n', v: grandTotalAmountPaid };
  ws[totalPaidRef].s = { ...TOTAL_CELL_STYLE, fill: { fgColor: { rgb: 'FFE2EFDA' } } };

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: styleRow, c: headerRow.length - 1 }
  });

  const monthYearLabel = targetMonthLabel || new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  XLSX.utils.book_append_sheet(wb, ws, monthYearLabel.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 31));
  XLSX.writeFile(wb, `Kevz_Dissertations_Invoice_${monthYearLabel}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
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
    number: true, orderDate: true, submissionDate: true, orderRefCode: true,
    orderType: true, topic: true, words: true, cpp: true, hasCode: true,
    codeAmount: true, hasPresentation: true, slideCount: true, paymentStatus: true,
    amountPaid: true, balance: true, status: true, priority: true, amount: true,
    notes: true, due: true
  });
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const toastRef = useRef(null);

  const columns = [
    { id: 'number',          label: '#' },
    { id: 'orderDate',       label: 'Order Date' },
    { id: 'submissionDate',  label: 'Submission Date' },
    { id: 'orderRefCode',    label: 'Reference Code' },
    { id: 'orderType',       label: 'Order Type' },
    { id: 'topic',           label: 'Topic' },
    { id: 'words',           label: 'Words' },
    { id: 'cpp',             label: 'CPP' },
    { id: 'hasCode',         label: 'Has Code' },
    { id: 'codeAmount',      label: 'Code Amount' },
    { id: 'hasPresentation', label: 'Has Presentation' },
    { id: 'slideCount',      label: 'Slide Count' },
    { id: 'paymentStatus',   label: 'Payment Status' },
    { id: 'amountPaid',      label: 'Amount Paid' },
    { id: 'balance',         label: 'Balance' },
    { id: 'status',          label: 'Status' },
    { id: 'priority',        label: 'Priority' },
    { id: 'amount',          label: 'Total Amount' },
    { id: 'notes',           label: 'Notes' },
    { id: 'due',             label: 'Due' }
  ];

  const showNotification = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const getMonthYearString = (date) =>
    new Date(date).toLocaleString('default', { month: 'short', year: 'numeric' });

  const getMonthYearKey = (date) => {
    const d = new Date(date);
    return d.getFullYear() * 12 + d.getMonth();
  };

  const isCurrentMonth = (date) => {
    const now = new Date(), pd = new Date(date);
    return now.getFullYear() === pd.getFullYear() && now.getMonth() === pd.getMonth();
  };

  const processBalanceCarryForwards = async (allProjects) => {
    const now = new Date();
    const [currentYear, currentMonth] = [now.getFullYear(), now.getMonth()];

    const projectsWithBalance = allProjects.filter(p =>
      p.paymentStatus === 'partial' && Number(p.balance) > 0 && !p.isCarryForward &&
      (() => {
        const d = new Date(p.orderDate);
        return !(d.getFullYear() === currentYear && d.getMonth() === currentMonth);
      })()
    );
    if (!projectsWithBalance.length) return 0;

    const cfSnap = await getDocs(query(collection(db, 'projects'), where('isCarryForward', '==', true)));
    const alreadyCF = new Set(
      cfSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(cf => {
          const d = new Date(cf.orderDate);
          return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        })
        .map(cf => cf.carryForwardFromId)
    );

    const currentMonthDateISO = new Date(currentYear, currentMonth, 1).toISOString();
    let created = 0;

    for (const p of projectsWithBalance) {
      if (alreadyCF.has(p.id)) continue;
      const bal = Number(p.balance);
      await addDoc(collection(db, 'projects'), {
        orderDate: currentMonthDateISO, submissionDate: p.submissionDate,
        amount: bal, amountPaid: 0, balance: bal, paymentStatus: 'unpaid',
        orderRefCode: p.orderRefCode, orderType: p.orderType, topic: p.topic,
        words: p.words || 0, cpp: p.cpp || 0, hasCode: p.hasCode || false,
        codeAmount: p.codeAmount || 0, hasPresentation: p.hasPresentation || false,
        slideCount: p.slideCount || 0,
        status: ['completed', 'cancelled'].includes(p.status) ? p.status : 'pending',
        priority: p.priority || 'medium',
        notes: p.notes ? `[Balance carried forward] ${p.notes}` : '[Balance carried forward]',
        isCarryForward: true, carryForwardFromId: p.id,
        createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString()
      });
      created++;
    }
    return created;
  };

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'projects'));
      const raw  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const newlyCreated = await processBalanceCarryForwards(raw);

      let source = raw;
      if (newlyCreated > 0) {
        const rSnap = await getDocs(collection(db, 'projects'));
        source = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        showNotification(
          `${newlyCreated} balance${newlyCreated > 1 ? 's' : ''} carried forward to this month`,
          'success'
        );
      }

      const now         = new Date();
      const curMonthKey = getMonthYearKey(now);

      const data = source.map((p, i) => {
        const subDate = new Date(p.submissionDate);
        const diff    = Math.round((subDate - now) / (1000 * 3600 * 24));
        const orderDate = new Date(p.orderDate);
        return {
          ...p, number: i + 1, daysUntilDue: diff,
          isDue:      diff <= 2 && diff >= 0 && !['completed', 'cancelled'].includes(p.status),
          isOverdue:  diff < 0  && !['completed', 'cancelled'].includes(p.status),
          monthYearKey:   getMonthYearKey(orderDate),
          isCurrentMonth: isCurrentMonth(orderDate)
        };
      }).sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return  1;
        if (b.status === 'completed' && a.status !== 'completed') return -1;
        if ((a.isDue || a.isOverdue) && !b.isDue && !b.isOverdue) return -1;
        if ((b.isDue || b.isOverdue) && !a.isDue && !a.isOverdue) return  1;
        if (a.monthYearKey !== b.monthYearKey) {
          if (a.monthYearKey === curMonthKey) return -1;
          if (b.monthYearKey === curMonthKey) return  1;
          return b.monthYearKey - a.monthYearKey;
        }
        return new Date(b.orderDate) - new Date(a.orderDate);
      }).map((p, i) => ({ ...p, number: i + 1 }));

      setProjects(data);
      setFilteredProjects(data);
    } catch (err) {
      setError('Error fetching projects: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  useEffect(() => {
    let results = [...projects];
    if (startDate && endDate) {
      if (new Date(startDate) > new Date(endDate)) { setError('Start date cannot be after end date'); return; }
      results = results.filter(p =>
        new Date(p.orderDate) >= new Date(startDate) && new Date(p.orderDate) <= new Date(endDate)
      );
    }
    if (searchTerm)
      results = results.filter(p =>
        Object.values(p).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))
      );
    if (selectedCategory !== 'all')
      results = results.filter(p => p.orderType === selectedCategory);

    const curMonthKey = getMonthYearKey(new Date());
    results = results.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return  1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;
      if ((a.isDue || a.isOverdue) && !b.isDue && !b.isOverdue) return -1;
      if ((b.isDue || b.isOverdue) && !a.isDue && !a.isOverdue) return  1;
      if (a.monthYearKey !== b.monthYearKey) {
        if (a.monthYearKey === curMonthKey) return -1;
        if (b.monthYearKey === curMonthKey) return  1;
        return b.monthYearKey - a.monthYearKey;
      }
      return new Date(b.orderDate) - new Date(a.orderDate);
    });
    setFilteredProjects(results);
    setCurrentPage(1);
    setError('');
  }, [searchTerm, startDate, endDate, selectedCategory, projects]);

  const resetFilters = () => {
    setSearchTerm(''); setStartDate(''); setEndDate('');
    setSelectedCategory('all'); setFilteredProjects(projects); setCurrentPage(1); setError('');
  };

  const handleSort = (key) => {
    const dir = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction: dir });
    const sorted = [...filteredProjects].sort((a, b) => {
      if (key === 'due')    { const av = a.daysUntilDue ?? Infinity, bv = b.daysUntilDue ?? Infinity; return dir === 'asc' ? av - bv : bv - av; }
      if (key === 'number') return dir === 'asc' ? a.number - b.number : b.number - a.number;
      const av = a[key] || '', bv = b[key] || '';
      if (typeof av === 'number' && typeof bv === 'number') return dir === 'asc' ? av - bv : bv - av;
      return dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    setFilteredProjects(sorted);
  };

  const calculateTotals = () =>
    filteredProjects.reduce((acc, p) => ({
      totalAmount:  acc.totalAmount  + (Number(p.amount)    || 0),
      totalPaid:    acc.totalPaid    + (Number(p.amountPaid) || 0),
      totalBalance: acc.totalBalance + (Number(p.balance)   || 0)
    }), { totalAmount: 0, totalPaid: 0, totalBalance: 0 });

  const toggleColumn    = (id)  => setSelectedColumns(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleAllColumns = (val) => setSelectedColumns(Object.fromEntries(columns.map(c => [c.id, val])));

  const prepareExportData = () =>
    filteredProjects.map((p, i) => {
      const row = {};
      if (selectedColumns.number)          row['#']                = i + 1;
      if (selectedColumns.orderDate)       row['Order Date']       = new Date(p.orderDate).toLocaleDateString();
      if (selectedColumns.submissionDate)  row['Submission Date']  = new Date(p.submissionDate).toLocaleDateString();
      if (selectedColumns.orderRefCode)    row['Reference Code']   = p.orderRefCode;
      if (selectedColumns.orderType)       row['Order Type']       = p.orderType;
      if (selectedColumns.topic)           row['Topic']            = p.topic;
      if (selectedColumns.words)           row['Words']            = p.words;
      if (selectedColumns.cpp)             row['CPP']              = p.cpp;
      if (selectedColumns.hasCode)         row['Has Code']         = p.hasCode ? 'Yes' : 'No';
      if (selectedColumns.codeAmount)      row['Code Amount']      = p.codeAmount || 0;
      if (selectedColumns.hasPresentation) row['Has Presentation'] = p.hasPresentation ? 'Yes' : 'No';
      if (selectedColumns.slideCount)      row['Slide Count']      = p.slideCount || 0;
      if (selectedColumns.paymentStatus)   row['Payment Status']   = p.paymentStatus || 'unpaid';
      if (selectedColumns.amountPaid)      row['Amount Paid']      = p.amountPaid || 0;
      if (selectedColumns.balance)         row['Balance']          = p.balance || 0;
      if (selectedColumns.status)          row['Status']           = p.status;
      if (selectedColumns.priority)        row['Priority']         = p.priority;
      if (selectedColumns.amount)          row['Total Amount']     = p.amount;
      if (selectedColumns.notes)           row['Notes']            = p.notes;
      if (selectedColumns.due)             row['Due']              = p.daysUntilDue !== undefined
        ? p.daysUntilDue < 0
          ? `${Math.abs(p.daysUntilDue)} days overdue`
          : `${p.daysUntilDue} days remaining`
        : '-';
      return row;
    });

  const prepareCSVExportData = () => {
    const data    = prepareExportData();
    const totals  = calculateTotals();
    const headers = Object.keys(data[0] || {});
    data.push({}, {});
    const totalRow = {};
    const aiIdx = headers.indexOf('Total Amount'),
          piIdx = headers.indexOf('Amount Paid'),
          biIdx = headers.indexOf('Balance');
    if (aiIdx >= 0) {
      totalRow[headers[aiIdx - 1]] = 'Total:';
      totalRow['Total Amount'] = totals.totalAmount;
      if (piIdx >= 0) totalRow['Amount Paid'] = totals.totalPaid;
      if (biIdx >= 0) totalRow['Balance']     = totals.totalBalance;
    } else {
      totalRow[headers[headers.length - 1]] = 'Total:';
      totalRow['Total Amount'] = totals.totalAmount;
    }
    data.push(totalRow);
    return data;
  };

  const exportDissertationInvoice = () => {
    const dissertationProjects = filteredProjects.filter(p => p.orderType === 'dissertation');
    if (!dissertationProjects.length) {
      showNotification('No dissertation projects found in current filter', 'warning');
      return;
    }
    const refDate    = startDate ? new Date(startDate) : new Date();
    const monthLabel = refDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    try {
      generateDissertationInvoice(dissertationProjects, monthLabel, exportFormat);
      showNotification(
        `Dissertation invoice exported as ${exportFormat.toUpperCase()} for ${monthLabel}`,
        'success'
      );
    } catch (err) {
      setError('Error generating dissertation invoice: ' + err.message);
      showNotification('Failed to generate dissertation invoice', 'danger');
    }
  };

  const exportData = () => {
    if (!Object.values(selectedColumns).some(Boolean)) {
      setError('Please select at least one column to export');
      return;
    }
    const dataToExport = prepareExportData();
    const totals       = calculateTotals();
    const monthYear    = startDate ? getMonthYearString(startDate) : getMonthYearString(new Date());
    const categoryMap  = { normal: 'Kevz_Normal_Invoice', dissertation: 'Kevz_Dissertations_Invoice', all: 'Kevz_All_Invoice' };
    const filenameBase = `${categoryMap[selectedCategory] || 'Kevz_Projects'}_${monthYear}`;

    if (exportFormat === 'xlsx') {
      const ws      = XLSX.utils.json_to_sheet(dataToExport);
      const headers = Object.keys(dataToExport[0] || {});
      const amtIdx  = headers.indexOf('Total Amount'),
            paidIdx = headers.indexOf('Amount Paid'),
            balIdx  = headers.indexOf('Balance');
      const lastRow  = dataToExport.length + 1,
            totalRow = lastRow + 2;

      if (amtIdx >= 0) {
        ws[`${XLSX.utils.encode_col(amtIdx - 1)}${totalRow}`] = { t: 's', v: 'Total:' };
        ws[`${XLSX.utils.encode_col(amtIdx)}${totalRow}`]     = { t: 'n', v: totals.totalAmount };
        if (paidIdx >= 0) ws[`${XLSX.utils.encode_col(paidIdx)}${totalRow}`] = { t: 'n', v: totals.totalPaid };
        if (balIdx  >= 0) ws[`${XLSX.utils.encode_col(balIdx)}${totalRow}`]  = { t: 'n', v: totals.totalBalance };
        ws['!ref'] = XLSX.utils.encode_range({
          s: { c: 0, r: 0 },
          e: { c: Math.max(amtIdx, paidIdx, balIdx), r: totalRow }
        });
      }

      const wb2 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb2, ws, 'Projects');
      XLSX.writeFile(wb2, `${filenameBase}.xlsx`);
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
      reader.onload = async (ev) => {
        const data = new Uint8Array(ev.target.result);
        const wb2  = XLSX.read(data, { type: 'array' });
        const ws   = wb2.Sheets[wb2.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws);
        if (!json.length) { showNotification('Imported file is empty', 'warning'); return; }
        for (const row of json) {
          await addDoc(collection(db, 'projects'), {
            orderDate:       row['Order Date']       || new Date().toISOString(),
            submissionDate:  row['Submission Date']  || new Date().toISOString(),
            orderRefCode:    row['Reference Code']   || '',
            orderType:       row['Order Type']       || 'normal',
            topic:           row['Topic']            || '',
            words:           parseInt(row['Words'])  || 0,
            cpp:             parseFloat(row['CPP'])  || 0,
            hasCode:         row['Has Code']         === 'Yes',
            codeAmount:      parseFloat(row['Code Amount'])  || 0,
            hasPresentation: row['Has Presentation'] === 'Yes',
            slideCount:      parseInt(row['Slide Count'])    || 0,
            paymentStatus:   row['Payment Status']   || 'unpaid',
            amountPaid:      parseFloat(row['Amount Paid'])  || 0,
            balance:         parseFloat(row['Balance'])      || 0,
            status:          row['Status']           || 'pending',
            priority:        row['Priority']         || 'medium',
            amount:          parseFloat(row['Total Amount']) || 0,
            notes:           row['Notes']            || '',
            createdAt:       new Date().toISOString(),
            lastUpdated:     new Date().toISOString()
          });
        }
        fetchProjects();
        showNotification(`Imported ${json.length} projects successfully`, 'success');
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError('Error importing data: ' + err.message);
      showNotification('Failed to import projects', 'danger');
    }
  };

  const handleAddProject = () => navigate('/projects/new');

  const totalPages        = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex        = (currentPage - 1) * itemsPerPage;
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
          <span className="visually-hidden" style={monoStyle}>Loading...</span>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {/* ── Styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Fira+Code:wght@400;500;600;700&display=swap');

        .pl-mono, .pl-mono * {
          font-family: 'IBM Plex Mono', 'Fira Code', monospace !important;
        }

        .pl-mono .form-control,
        .pl-mono .form-select,
        .pl-mono .btn,
        .pl-mono .badge,
        .pl-mono th,
        .pl-mono td,
        .pl-mono .card-header,
        .pl-mono .card-body,
        .pl-mono label,
        .pl-mono .form-check-label,
        .pl-mono .page-link,
        .pl-mono .alert,
        .pl-mono .toast,
        .pl-mono .toast-header,
        .pl-mono .toast-body,
        .pl-mono input,
        .pl-mono select,
        .pl-mono textarea {
          font-family: 'IBM Plex Mono', 'Fira Code', monospace !important;
        }

        .pl-mono .form-control::placeholder {
          font-family: 'IBM Plex Mono', 'Fira Code', monospace !important;
        }

        .pl-mono .card-header h2 {
          letter-spacing: -0.02em;
        }

        .pl-mono th {
          font-size: 0.72rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .pl-mono td {
          font-size: 0.82rem;
        }

        .pl-mono .badge {
          font-size: 0.68rem;
          letter-spacing: 0.05em;
        }

        .pl-mono .btn {
          font-size: 0.82rem;
          letter-spacing: 0.02em;
        }

        .pl-mono .form-control,
        .pl-mono .form-select,
        .pl-mono input[type="date"],
        .pl-mono input[type="text"],
        .pl-mono input[type="number"] {
          font-size: 0.82rem;
        }

        .pl-mono .page-link {
          font-size: 0.78rem;
        }

        .pl-mono .alert {
          font-size: 0.82rem;
        }

        .pl-mono .form-check-label {
          font-size: 0.8rem;
        }

        .pl-mono small,
        .pl-mono .small {
          font-size: 0.72rem;
        }

        /* Actions cell — keep buttons together without wrapping */
        .actions-cell {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }
      `}</style>

      <div className="container-fluid py-4 pl-mono">
        {/* ── Toast ── */}
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
                {toast.type === 'success' ? 'Success' : toast.type === 'danger' ? 'Error' : 'Warning'}
              </strong>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={() => setToast({ show: false, message: '', type: '' })}
              />
            </div>
            <div className="toast-body text-white">{toast.message}</div>
          </motion.div>
        </div>

        <div className="card shadow">
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h2 className="h4 mb-0">
              <FaListAlt className="me-2" /> Projects Management
            </h2>
            <button className="btn btn-light" onClick={handleAddProject}>
              + Add Project
            </button>
          </div>

          <div className="card-body">
            {/* ── Filters Row ── */}
            <div
              className="mb-3"
              style={{
                display: 'flex',
                flexWrap: 'nowrap',
                alignItems: 'center',
                gap: '0.4rem',
                overflowX: 'auto',
              }}
            >
              {/* Search */}
              <div className="input-group" style={{ flex: '1 1 180px', minWidth: '140px' }}>
                <span className="input-group-text px-2"><FaSearch /></span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Start date */}
              <div className="input-group" style={{ flex: '0 0 160px' }}>
                <span className="input-group-text px-2"><FaCalendarAlt /></span>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>

              {/* End date */}
              <div className="input-group" style={{ flex: '0 0 160px' }}>
                <span className="input-group-text px-2"><FaCalendarAlt /></span>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>

              {/* Category filter */}
              <div className="input-group" style={{ flex: '0 0 160px' }}>
                <span className="input-group-text px-2"><FaFilter /></span>
                <select
                  className="form-select"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="normal">Normal</option>
                  <option value="dissertation">Dissertation</option>
                </select>
              </div>

              {/* Divider */}
              <div style={{ width: '1px', height: '32px', background: '#dee2e6', flexShrink: 0 }} />

              {/* Columns toggle */}
              <button
                className="btn btn-outline-primary btn-sm"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={() => setShowColumnSelector(!showColumnSelector)}
              >
                <FaSort className="me-1" /> Columns
              </button>

              {/* Format selector */}
              <select
                className="form-select form-select-sm"
                value={exportFormat}
                onChange={e => setExportFormat(e.target.value)}
                style={{ width: '75px', flexShrink: 0 }}
              >
                <option value="xlsx">XLSX</option>
                <option value="csv">CSV</option>
              </select>

              {/* Export button */}
              {exportFormat === 'xlsx' ? (
                <button
                  className="btn btn-success btn-sm"
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={exportData}
                >
                  <FaFileExcel className="me-1" /> Export
                </button>
              ) : (
                <CSVLink
                  data={prepareCSVExportData()}
                  filename={`${
                    selectedCategory === 'dissertation' ? 'Kevz_Dissertations_Invoice'
                    : selectedCategory === 'normal'     ? 'Kevz_Normal_Invoice'
                    : 'Kevz_All_Invoice'
                  }_${getMonthYearString(startDate || new Date())}.csv`}
                  className="btn btn-success btn-sm"
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={() => {
                    if (!Object.values(selectedColumns).some(Boolean)) {
                      showNotification('Please select at least one column', 'warning');
                      return false;
                    }
                    showNotification('Projects exported successfully', 'success');
                    setError('');
                    return true;
                  }}
                >
                  <FaFileCsv className="me-1" /> Export
                </CSVLink>
              )}

              {/* Dissertation Invoice */}
              <button
                className="btn btn-warning btn-sm text-dark fw-semibold"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={exportDissertationInvoice}
                title="Generate formatted dissertation invoice"
              >
                <FaGraduationCap className="me-1" /> Diss. Invoice
              </button>

              {/* Reset */}
              <button
                className="btn btn-secondary btn-sm"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={resetFilters}
              >
                Reset
              </button>

              {/* Import */}
              <input
                type="file"
                id="importExcel"
                className="d-none"
                accept=".xlsx,.xls"
                onChange={importFromExcel}
              />
              <button
                className="btn btn-info btn-sm"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={() => document.getElementById('importExcel').click()}
              >
                <FaFileImport className="me-1" /> Import
              </button>
            </div>

            {/* ── Column Selector ── */}
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
                    {columns.map(col => (
                      <div key={col.id} className="col-md-3 mb-2">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`col-${col.id}`}
                            checked={selectedColumns[col.id] || false}
                            onChange={() => toggleColumn(col.id)}
                          />
                          <label className="form-check-label" htmlFor={`col-${col.id}`}>
                            {col.label}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Dissertation Invoice Info Banner ── */}
            {selectedCategory === 'dissertation' && (
              <motion.div
                className="alert alert-info d-flex align-items-center gap-2 py-2 mb-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <FaGraduationCap size={18} />
                <span>
                  <strong>Dissertation Invoice mode:</strong> Click <em>Dissertation Invoice</em> to
                  generate a formatted invoice showing each client's word counts per month, CPP, calculated
                  amount, code amount, total, and amount paid — matching the Kevz Dissertations Invoice
                  layout. The format selector above (XLSX / CSV) applies to both Export and Dissertation Invoice.
                </span>
              </motion.div>
            )}

            {error && (
              <motion.div
                className="alert alert-danger"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {error}
              </motion.div>
            )}

            {/* ── Table ── */}
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    {[
                      'number', 'orderDate', 'submissionDate', 'orderRefCode', 'orderType',
                      'topic', 'words', 'amount', 'paymentStatus', 'amountPaid',
                      'balance', 'status', 'priority', 'due'
                    ].map(key => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        style={{ cursor: 'pointer' }}
                      >
                        {columns.find(c => c.id === key)?.label}
                        {sortConfig.key === key && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                      </th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProjects.map((p, idx) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className={p.isOverdue ? 'table-danger' : p.isDue ? 'table-warning' : ''}
                    >
                      <td>
                        {startIndex + idx + 1}
                        {p.isCarryForward && (
                          <span
                            className="badge bg-info ms-1"
                            title="Balance carried forward"
                            style={{ fontSize: '0.65rem' }}
                          >
                            CF
                          </span>
                        )}
                      </td>
                      <td>{new Date(p.orderDate).toLocaleDateString()}</td>
                      <td>{new Date(p.submissionDate).toLocaleDateString()}</td>
                      <td>{p.orderRefCode}</td>
                      <td className="text-capitalize">{p.orderType}</td>
                      <td>{p.topic}</td>
                      <td>{p.words}</td>
                      <td>Ksh.{Number(p.amount).toFixed(2)}</td>
                      <td>
                        <span
                          className={`badge bg-${
                            p.paymentStatus === 'paid'    ? 'success' :
                            p.paymentStatus === 'partial' ? 'warning' : 'secondary'
                          }`}
                        >
                          {p.paymentStatus || 'unpaid'}
                        </span>
                      </td>
                      <td>
                        {p.paymentStatus === 'partial'
                          ? `Ksh.${Number(p.amountPaid || 0).toFixed(2)}`
                          : p.paymentStatus === 'paid' ? 'Fully Paid' : '-'}
                      </td>
                      <td>
                        {p.paymentStatus === 'partial'
                          ? `Ksh.${Number(p.balance || 0).toFixed(2)}`
                          : '-'}
                      </td>
                      <td>
                        <span
                          className={`badge bg-${
                            p.status === 'completed'   ? 'success' :
                            p.status === 'in-progress' ? 'warning' :
                            p.status === 'cancelled'   ? 'danger'  : 'secondary'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge bg-${
                            p.priority === 'urgent' ? 'danger'  :
                            p.priority === 'high'   ? 'warning' :
                            p.priority === 'medium' ? 'info'    : 'secondary'
                          }`}
                        >
                          {p.priority}
                        </span>
                      </td>
                      <td>
                        {p.daysUntilDue !== undefined && p.status !== 'completed'
                          ? p.daysUntilDue < 0
                            ? `${Math.abs(p.daysUntilDue)} days overdue`
                            : `${p.daysUntilDue} days remaining`
                          : '-'}
                      </td>

                      {/* ── Action Buttons ── */}
                      <td>
                        <div className="actions-cell">
                          <ActionButton
                            icon={FaPencilAlt}
                            label="Edit"
                            variant="edit"
                            onClick={() => navigate(`/projects/edit/${p.id}`)}
                          />
                          <ActionButton
                            icon={FaTrashAlt}
                            label="Delete"
                            variant="delete"
                            onClick={() => handleDelete(p.id)}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            <div className="d-flex justify-content-between align-items-center mt-3">
              <div>
                Showing {startIndex + 1} to{' '}
                {Math.min(startIndex + itemsPerPage, filteredProjects.length)} of{' '}
                {filteredProjects.length} entries
                <select
                  className="form-select d-inline-block ms-2"
                  value={itemsPerPage}
                  onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  style={{ width: 'auto' }}
                >
                  {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <nav>
                <ul className="pagination mb-0">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    >
                      Previous
                    </button>
                  </li>
                  {[...Array(totalPages)].map((_, i) => (
                    <li
                      key={i + 1}
                      className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}
                    >
                      <button className="page-link" onClick={() => setCurrentPage(i + 1)}>
                        {i + 1}
                      </button>
                    </li>
                  ))}
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
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
    </>
  );
}

export default ProjectList;