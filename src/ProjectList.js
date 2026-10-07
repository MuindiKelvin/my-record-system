import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc, addDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import * as XLSX from 'xlsx';
import { CSVLink } from 'react-csv';

// ─
// Dissertation Invoice Generator - with Code Amount support
// ─
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

// Main Component
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
      <div className="page-loader">
        <div className="spinner-ring" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="small">Loading projects...</span>
      </div>
    );
  }

  const toneOf = {
    status: (v) => v === 'completed' ? 'success' : v === 'in-progress' ? 'warning' : v === 'cancelled' ? 'danger' : 'secondary',
    payment: (v) => v === 'paid' ? 'success' : v === 'partial' ? 'warning' : 'secondary',
    priority: (v) => v === 'urgent' ? 'danger' : v === 'high' ? 'warning' : v === 'medium' ? 'info' : 'secondary',
  };

  const sortableKeys = [
    'number', 'orderDate', 'submissionDate', 'orderRefCode', 'orderType',
    'topic', 'words', 'amount', 'paymentStatus', 'amountPaid',
    'balance', 'status', 'priority', 'due'
  ];

  // Windowed page list so long result sets never overflow on phones
  const pageList = (() => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) pages.push(i);
      else if (pages[pages.length - 1] !== '...') pages.push('...');
    }
    return pages;
  })();

  const toastIcon = toast.type === 'success' ? 'bi-check-circle-fill' : toast.type === 'danger' ? 'bi-x-octagon-fill' : 'bi-exclamation-triangle-fill';
  const hasNoRows = filteredProjects.length === 0;

  return (
    <div className="pl-root">
      {/* Toast */}
      {toast.show && (
        <div className="app-toast-wrap" role="status" aria-live="polite">
          <div ref={toastRef} className={`app-toast ${toast.type}`}>
            <i className={`bi ${toastIcon}`} aria-hidden="true" />
            <div className="min-w-0">
              <strong className="d-block">
                {toast.type === 'success' ? 'Success' : toast.type === 'danger' ? 'Error' : 'Warning'}
              </strong>
              <span className="small">{toast.message}</span>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Dismiss"
              onClick={() => setToast({ show: false, message: '', type: '' })}
            />
          </div>
        </div>
      )}

      <div className="page-head">
        <div>
          <h1 className="page-title">
            <span className="title-chip"><i className="bi bi-list-task" aria-hidden="true" /></span>
            Projects Management
          </h1>
          <p className="page-sub">
            {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} shown
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-primary" onClick={handleAddProject}>
            <i className="bi bi-plus-lg" aria-hidden="true" /> Add Project
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {/* Filters */}
          <div className="filter-bar mb-3">
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search" aria-hidden="true" /></span>
              <input
                type="search"
                className="form-control"
                placeholder="Search..."
                aria-label="Search projects"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="input-group">
              <span className="input-group-text" title="Start date"><i className="bi bi-calendar-event" aria-hidden="true" /></span>
              <input
                type="date"
                className="form-control"
                aria-label="Start date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="input-group">
              <span className="input-group-text" title="End date"><i className="bi bi-calendar-check" aria-hidden="true" /></span>
              <input
                type="date"
                className="form-control"
                aria-label="End date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-funnel" aria-hidden="true" /></span>
              <select
                className="form-select"
                aria-label="Order type"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
              >
                <option value="all">All</option>
                <option value="normal">Normal</option>
                <option value="dissertation">Dissertation</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="toolbar mb-3">
            <button
              type="button"
              className={`btn btn-sm ${showColumnSelector ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              aria-expanded={showColumnSelector}
            >
              <i className="bi bi-layout-three-columns" aria-hidden="true" /> Columns
            </button>

            <span className="toolbar-sep" aria-hidden="true" />

            <select
              className="form-select form-select-sm w-auto"
              aria-label="Export format"
              value={exportFormat}
              onChange={e => setExportFormat(e.target.value)}
            >
              <option value="xlsx">XLSX</option>
              <option value="csv">CSV</option>
            </select>

            {exportFormat === 'xlsx' ? (
              <button type="button" className="btn btn-success btn-sm" onClick={exportData}>
                <i className="bi bi-file-earmark-excel" aria-hidden="true" /> Export
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
                <i className="bi bi-filetype-csv" aria-hidden="true" /> Export
              </CSVLink>
            )}

            <button
              type="button"
              className="btn btn-warning btn-sm"
              onClick={exportDissertationInvoice}
              title="Generate formatted dissertation invoice"
            >
              <i className="bi bi-mortarboard" aria-hidden="true" /> Diss. Invoice
            </button>

            <span className="toolbar-sep" aria-hidden="true" />

            <input
              type="file"
              id="importExcel"
              className="d-none"
              accept=".xlsx,.xls"
              onChange={importFromExcel}
            />
            <button
              type="button"
              className="btn btn-info btn-sm"
              onClick={() => document.getElementById('importExcel').click()}
            >
              <i className="bi bi-box-arrow-in-down" aria-hidden="true" /> Import
            </button>

            <button type="button" className="btn btn-outline-secondary btn-sm ms-sm-auto" onClick={resetFilters}>
              <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Reset
            </button>
          </div>

          {/* Column selector */}
          {showColumnSelector && (
            <div className="card mb-3 bg-transparent shadow-none">
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <h5 className="card-title-sm"><i className="bi bi-layout-three-columns" aria-hidden="true" /> Select columns for export</h5>
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => toggleAllColumns(true)}>
                      Select All
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggleAllColumns(false)}>
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="row g-2">
                  {columns.map(col => (
                    <div key={col.id} className="col-6 col-md-4 col-xl-3">
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
            </div>
          )}

          {/* Dissertation Invoice info */}
          {selectedCategory === 'dissertation' && (
            <div className="alert alert-info d-flex align-items-start gap-2 py-2 mb-3">
              <i className="bi bi-mortarboard-fill mt-1" aria-hidden="true" />
              <span className="small">
                <strong>Dissertation Invoice mode:</strong> Click <em>Dissertation Invoice</em> to
                generate a formatted invoice showing each client's word counts per month, CPP, calculated
                amount, code amount, total, and amount paid, matching the Kevz Dissertations Invoice
                layout. The format selector above (XLSX / CSV) applies to both Export and Dissertation Invoice.
              </span>
            </div>
          )}

          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2" role="alert">
              <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Table (cards on phones) */}
          <div className="table-responsive">
            <table className="table table-hover table-stack align-middle">
              <thead>
                <tr>
                  {sortableKeys.map(key => (
                    <th
                      key={key}
                      scope="col"
                      className="th-sort"
                      onClick={() => handleSort(key)}
                      aria-sort={sortConfig.key === key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      {columns.find(c => c.id === key)?.label}
                      {sortConfig.key === key && (
                        <i className={`bi ${sortConfig.direction === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill'} ms-1`} aria-hidden="true" />
                      )}
                    </th>
                  ))}
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={p.isOverdue ? 'row-state-overdue' : p.isDue ? 'row-state-due' : ''}
                  >
                    <td data-label="#" className="num">
                      {startIndex + idx + 1}
                      {p.isCarryForward && (
                        <span className="pill pill-info ms-1" title="Balance carried forward">CF</span>
                      )}
                    </td>
                    <td data-label="Order Date" className="text-nowrap">{new Date(p.orderDate).toLocaleDateString()}</td>
                    <td data-label="Submission Date" className="text-nowrap">{new Date(p.submissionDate).toLocaleDateString()}</td>
                    <td data-label="Reference Code" className="mono">{p.orderRefCode}</td>
                    <td data-label="Order Type" className="text-capitalize">{p.orderType}</td>
                    <td data-label="Topic"><div className="clamp-md-2" title={p.topic}>{p.topic}</div></td>
                    <td data-label="Words" className="num">{p.words}</td>
                    <td data-label="Total Amount" className="num text-nowrap">Ksh.{Number(p.amount).toFixed(2)}</td>
                    <td data-label="Payment Status">
                      <span className={`pill pill-${toneOf.payment(p.paymentStatus)}`}>{p.paymentStatus || 'unpaid'}</span>
                    </td>
                    <td data-label="Amount Paid" className="num text-nowrap">
                      {p.paymentStatus === 'partial'
                        ? `Ksh.${Number(p.amountPaid || 0).toFixed(2)}`
                        : p.paymentStatus === 'paid' ? 'Fully Paid' : '-'}
                    </td>
                    <td data-label="Balance" className="num text-nowrap">
                      {p.paymentStatus === 'partial'
                        ? `Ksh.${Number(p.balance || 0).toFixed(2)}`
                        : '-'}
                    </td>
                    <td data-label="Status">
                      <span className={`pill pill-${toneOf.status(p.status)}`}>{p.status}</span>
                    </td>
                    <td data-label="Priority">
                      <span className={`pill pill-${toneOf.priority(p.priority)}`}>{p.priority}</span>
                    </td>
                    <td data-label="Due" className="text-nowrap">
                      {p.daysUntilDue !== undefined && p.status !== 'completed'
                        ? p.daysUntilDue < 0
                          ? `${Math.abs(p.daysUntilDue)} days overdue`
                          : `${p.daysUntilDue} days remaining`
                        : '-'}
                    </td>
                    <td data-label="Actions">
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-soft-primary btn-sm"
                          onClick={() => navigate(`/projects/edit/${p.id}`)}
                          title="Edit project"
                        >
                          <i className="bi bi-pencil-square" aria-hidden="true" />
                          <span className="d-md-none">Edit</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-soft-danger btn-sm"
                          onClick={() => handleDelete(p.id)}
                          title="Delete project"
                        >
                          <i className="bi bi-trash3" aria-hidden="true" />
                          <span className="d-md-none">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasNoRows && (
            <div className="empty-state">
              <i className="bi bi-folder2-open" aria-hidden="true" />
              <strong>No projects found</strong>
              <span className="small">Try adjusting your filters or add a new project.</span>
            </div>
          )}

          {/* Pagination */}
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-center gap-3 mt-3">
            <div className="d-flex flex-wrap align-items-center justify-content-center gap-2 small">
              <span>
                Showing {startIndex + 1} to{' '}
                {Math.min(startIndex + itemsPerPage, filteredProjects.length)} of{' '}
                {filteredProjects.length} entries
              </span>
              <select
                className="form-select form-select-sm w-auto"
                aria-label="Rows per page"
                value={itemsPerPage}
                onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              >
                {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <nav aria-label="Projects pages">
              <ul className="pagination mb-0 justify-content-center">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    aria-label="Previous page"
                  >
                    <i className="bi bi-chevron-left" aria-hidden="true" />
                  </button>
                </li>
                {pageList.map((pg, i) =>
                  pg === '...' ? (
                    <li key={`gap-${i}`} className="page-item disabled">
                      <span className="page-link">&hellip;</span>
                    </li>
                  ) : (
                    <li key={pg} className={`page-item ${currentPage === pg ? 'active' : ''}`}>
                      <button type="button" className="page-link" onClick={() => setCurrentPage(pg)}>
                        {pg}
                      </button>
                    </li>
                  )
                )}
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    aria-label="Next page"
                  >
                    <i className="bi bi-chevron-right" aria-hidden="true" />
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
