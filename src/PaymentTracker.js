import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { motion, AnimatePresence } from 'framer-motion';
import styled, { ThemeProvider, keyframes, createGlobalStyle } from 'styled-components';
import {
  FaCheckCircle, FaHourglassHalf, FaTimesCircle,
  FaSearch, FaForward, FaSave,
  FaMoneyBillWave, FaExclamationTriangle,
  FaTimes, FaCheck,
  FaSort, FaSortUp, FaSortDown, FaChevronLeft, FaChevronRight,
  FaSync, FaSun, FaMoon, FaPalette,
  FaBolt, FaLayerGroup,
  FaPrint, FaFileInvoiceDollar, FaCalendarAlt,
} from 'react-icons/fa';

// ─── Themes ────────────────────────────────────────────────────────────────────
const themes = {
  dark: {
    name: 'dark',
    bg:          '#0f1419',
    bgGradient:  'radial-gradient(ellipse 60% 40% at 20% 10%, rgba(0,212,255,0.06) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 80% 80%, rgba(72,187,120,0.04) 0%, transparent 70%)',
    card:        '#16213e',
    border:      'rgba(0,212,255,0.15)',
    primary:     '#00d4ff',
    success:     '#48bb78',
    warning:     '#ecc94b',
    danger:      '#f56565',
    text:        '#e0e0e0',
    muted:       '#7a8fa6',
    shadow:      '0 8px 32px rgba(0,0,0,0.4)',
    inputBg:     '#0d1b2a',
    stripEven:   'rgba(0,212,255,0.03)',
    stripOdd:    'rgba(255,255,255,0.015)',
    headerBg:    '#0d1b2a',
    statBar:     'rgba(255,255,255,0.04)',
    divider:     'rgba(255,255,255,0.06)',
    toggleBg:    '#16213e',
  },
  light: {
    name: 'light',
    bg:          '#f8f9fa',
    bgGradient:  'radial-gradient(ellipse 60% 40% at 20% 10%, rgba(0,123,255,0.05) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 80% 80%, rgba(40,167,69,0.04) 0%, transparent 70%)',
    card:        '#ffffff',
    border:      'rgba(0,123,255,0.18)',
    primary:     '#007bff',
    success:     '#28a745',
    warning:     '#e6a817',
    danger:      '#dc3545',
    text:        '#212529',
    muted:       '#6c757d',
    shadow:      '0 4px 20px rgba(0,0,0,0.08)',
    inputBg:     '#f1f3f5',
    stripEven:   'rgba(0,123,255,0.03)',
    stripOdd:    'rgba(0,0,0,0.01)',
    headerBg:    '#e9ecef',
    statBar:     'rgba(0,0,0,0.03)',
    divider:     'rgba(0,0,0,0.06)',
    toggleBg:    '#ffffff',
  },
  vibrant: {
    name: 'vibrant',
    bg:          '#ffeaa7',
    bgGradient:  'radial-gradient(ellipse 60% 40% at 20% 10%, rgba(159,122,234,0.12) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 80% 80%, rgba(237,100,166,0.08) 0%, transparent 70%)',
    card:        '#fff5f5',
    border:      'rgba(159,122,234,0.25)',
    primary:     '#9f7aea',
    success:     '#38b2ac',
    warning:     '#ed8936',
    danger:      '#e53e3e',
    text:        '#2d3748',
    muted:       '#718096',
    shadow:      '0 4px 20px rgba(0,0,0,0.12)',
    inputBg:     '#fef9f0',
    stripEven:   'rgba(159,122,234,0.04)',
    stripOdd:    'rgba(237,100,166,0.02)',
    headerBg:    '#fde8e8',
    statBar:     'rgba(0,0,0,0.04)',
    divider:     'rgba(159,122,234,0.12)',
    toggleBg:    '#fff5f5',
  },
};

const THEME_ORDER = ['dark', 'light', 'vibrant'];

// ─── Animations ───────────────────────────────────────────────────────────────
const fadeUp = keyframes`
  from { transform:translateY(8px); opacity:0 }
  to   { transform:translateY(0);   opacity:1 }
`;

const unpaidPulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
`;

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

const stampDrop = keyframes`
  0%   { transform: rotate(-3deg) scale(1.6); opacity: 0; }
  60%  { transform: rotate(-3deg) scale(0.95); }
  80%  { transform: rotate(-3deg) scale(1.04); }
  100% { transform: rotate(-3deg) scale(1); opacity: 1; }
`;

// ─── Global style ─────────────────────────────────────────────────────────────
const GlobalStyle = createGlobalStyle`
  body {
    background: ${p => p.theme.bg};
    transition: background 0.35s ease;
  }
`;

// ─── Styled Components ────────────────────────────────────────────────────────
const Page = styled.div`
  min-height: 100vh;
  background: ${p => p.theme.bg};
  color: ${p => p.theme.text};
  font-family: 'IBM Plex Mono', 'Fira Code', monospace;
  padding: 2rem 1.5rem 4rem;
  position: relative;
  transition: background 0.35s ease, color 0.35s ease;

  &::before {
    content: '';
    position: fixed;
    inset: 0;
    background: ${p => p.theme.bgGradient};
    pointer-events: none;
    z-index: 0;
    transition: background 0.35s ease;
  }
`;

const Inner = styled.div`
  position: relative;
  z-index: 1;
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 2.5rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
`;

const HeaderLeft = styled.div`
  flex: 1;
`;

const Title = styled.h1`
  font-size: clamp(1.5rem, 3vw, 2.2rem);
  font-weight: 700;
  color: ${p => p.theme.primary};
  letter-spacing: -0.02em;
  margin: 0 0 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  svg { filter: drop-shadow(0 0 8px ${p => p.theme.primary}); }
`;

const Subtitle = styled.p`
  color: ${p => p.theme.muted};
  font-size: 0.85rem;
  margin: 0;
  letter-spacing: 0.05em;
`;

const LiveClock = styled.div`
  font-size: 0.75rem;
  color: ${p => p.theme.muted};
  margin-top: 0.35rem;
  letter-spacing: 0.08em;
  display: flex;
  align-items: center;
  gap: 0.4rem;

  &::before {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${p => p.theme.success};
    box-shadow: 0 0 6px ${p => p.theme.success};
    animation: ${unpaidPulse} 2s infinite;
  }
`;

const HeaderRight = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
`;

const ThemeToggleBtn = styled(motion.button)`
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.toggleBg};
  color: ${p => p.theme.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: ${p => p.theme.shadow};
  transition: background 0.25s, border-color 0.25s, color 0.25s;
  font-size: 1rem;
`;

const StatsBar = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
`;

const StatCard = styled(motion.div)`
  background: ${p => p.theme.card};
  border: 1px solid ${p => p.$color || p.theme.border};
  border-radius: 12px;
  padding: 1rem 1.25rem;
  position: relative;
  overflow: hidden;
  transition: background 0.3s, border-color 0.3s, box-shadow 0.2s;
  box-shadow: ${p => p.theme.shadow};

  &:hover { box-shadow: 0 12px 36px rgba(0,0,0,0.18); }

  &::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: ${p => p.$color || p.theme.primary};
    opacity: 0.8;
  }
`;

const StatLabel = styled.div`
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: ${p => p.theme.muted};
  text-transform: uppercase;
  margin-bottom: 0.4rem;
`;

const StatValue = styled.div`
  font-size: 1.4rem;
  font-weight: 700;
  color: ${p => p.$color || p.theme.text};
  line-height: 1.2;
`;

const StatSub = styled.div`
  font-size: 0.68rem;
  color: ${p => p.theme.muted};
  margin-top: 0.2rem;
`;

const SparklineWrap = styled.div`
  margin-top: 0.6rem;
  height: 28px;
  width: 100%;
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
  align-items: center;
`;

const SearchBox = styled.div`
  position: relative;
  flex: 1;
  min-width: 200px;
  max-width: 340px;

  svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: ${p => p.theme.muted};
    font-size: 0.85rem;
  }

  input {
    width: 100%;
    background: ${p => p.theme.inputBg};
    border: 1px solid ${p => p.theme.border};
    border-radius: 8px;
    padding: 0.55rem 0.75rem 0.55rem 2.2rem;
    color: ${p => p.theme.text};
    font-family: inherit;
    font-size: 0.82rem;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s, background 0.3s;

    &:focus { border-color: ${p => p.theme.primary}; }
    &::placeholder { color: ${p => p.theme.muted}; }
  }
`;

const FilterSelect = styled.select`
  background: ${p => p.theme.inputBg};
  border: 1px solid ${p => p.theme.border};
  border-radius: 8px;
  padding: 0.55rem 1rem;
  color: ${p => p.theme.text};
  font-family: inherit;
  font-size: 0.82rem;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s, background 0.3s;
  &:focus { border-color: ${p => p.theme.primary}; }
`;

const ActionBtn = styled(motion.button)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.1rem;
  border-radius: 8px;
  border: 1px solid ${p => p.$outline ? p.theme.border : 'transparent'};
  background: ${p => p.$outline ? 'transparent' : p.$color || p.theme.primary};
  color: ${p => {
    if (p.$outline) return p.theme.text;
    if (p.$color === p.theme.success || p.$color === p.theme.warning || p.$color === p.theme.primary) {
      return p.theme.name === 'dark' ? '#0a0a0a' : '#fff';
    }
    return '#fff';
  }};
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;

  &:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const TableWrap = styled.div`
  background: ${p => p.theme.card};
  border: 1px solid ${p => p.theme.border};
  border-radius: 14px;
  overflow: hidden;
  box-shadow: ${p => p.theme.shadow};
  overflow-x: auto;
  transition: background 0.3s, border-color 0.3s;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  min-width: 960px;
`;

const THead = styled.thead`
  background: ${p => p.theme.headerBg};
  transition: background 0.3s;

  th {
    padding: 0.8rem 0.9rem;
    text-align: left;
    color: ${p => p.theme.muted};
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-bottom: 1px solid ${p => p.theme.border};
    white-space: nowrap;
    user-select: none;
    cursor: pointer;
    transition: color 0.15s;

    &:hover { color: ${p => p.theme.primary}; }
  }
`;

const ThInner = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const TRow = styled(motion.tr)`
  background: ${p =>
    p.$paid
      ? (p.theme.name === 'light'
          ? 'rgba(40,167,69,0.05)'
          : p.theme.name === 'vibrant'
            ? 'rgba(56,178,172,0.05)'
            : 'rgba(72,187,120,0.04)')
      : p.$even ? p.theme.stripEven : p.theme.stripOdd};
  border-bottom: 1px solid ${p => p.theme.divider};
  transition: background 0.15s;
  opacity: ${p => p.$paid ? 0.62 : 1};

  &:hover {
    background: ${p => p.$paid
      ? (p.theme.name === 'light'
          ? 'rgba(40,167,69,0.1)'
          : 'rgba(72,187,120,0.08)')
      : p.theme.name === 'light'
        ? 'rgba(0,123,255,0.05)'
        : p.theme.name === 'vibrant'
          ? 'rgba(159,122,234,0.07)'
          : 'rgba(0,212,255,0.05)'};
    opacity: 1;
  }

  td {
    padding: 0.7rem 0.9rem;
    vertical-align: middle;
    color: ${p => p.theme.text};
    transition: color 0.3s;
  }

  &.paid-row    td:first-child { border-left: 3px solid ${p => p.theme.success}; }
  &.partial-row td:first-child { border-left: 3px solid ${p => p.theme.warning}; }
  &.unpaid-row  td:first-child { border-left: 3px solid ${p =>
    p.theme.name === 'light' ? 'rgba(220,53,69,0.5)' : 'rgba(245,101,101,0.5)'}; }
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: ${p =>
    p.$s === 'paid'    ? `${p.theme.success}22`  :
    p.$s === 'partial' ? `${p.theme.warning}22`  :
                         `${p.theme.danger}18`};
  color: ${p =>
    p.$s === 'paid'    ? p.theme.success :
    p.$s === 'partial' ? p.theme.warning :
                         p.theme.danger};
  border: 1px solid ${p =>
    p.$s === 'paid'    ? `${p.theme.success}44` :
    p.$s === 'partial' ? `${p.theme.warning}44` :
                         `${p.theme.danger}33`};
`;

const PayEditor = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const AmtInput = styled.input`
  width: 110px;
  background: ${p => p.theme.inputBg};
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  color: ${p => p.theme.text};
  font-family: inherit;
  font-size: 0.82rem;
  outline: none;
  transition: border-color 0.2s, background 0.3s;
  &:focus { border-color: ${p => p.theme.primary}; }
`;

const MiniBtn = styled(motion.button)`
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  border: none;
  background: ${p => p.$c || p.theme.primary};
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;

  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const Pagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-top: 1px solid ${p => p.theme.border};
  gap: 1rem;
  flex-wrap: wrap;
  background: ${p => p.theme.headerBg};
  transition: background 0.3s;
`;

const PageInfo = styled.span`
  font-size: 0.78rem;
  color: ${p => p.theme.muted};
`;

const PageBtns = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const PageBtn = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid ${p => p.$active ? p.theme.primary : p.theme.border};
  background: ${p => p.$active ? p.theme.primary : 'transparent'};
  color: ${p => p.$active ? (p.theme.name === 'dark' ? '#0a0a0a' : '#fff') : p.theme.text};
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: ${p => p.$active ? 700 : 400};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    border-color: ${p => p.theme.primary};
    color: ${p => p.$active ? (p.theme.name === 'dark' ? '#0a0a0a' : '#fff') : p.theme.primary};
  }
  &:disabled { opacity: 0.35; cursor: not-allowed; }
`;

const Toast = styled(motion.div)`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: ${p => p.theme.card};
  border: 1px solid ${p =>
    p.$type === 'success' ? p.theme.success :
    p.$type === 'warn'    ? p.theme.warning :
                            p.theme.danger};
  border-radius: 10px;
  padding: 0.9rem 1.25rem;
  font-size: 0.85rem;
  color: ${p => p.theme.text};
  z-index: 9999;
  box-shadow: ${p => p.theme.shadow};
  display: flex;
  align-items: center;
  gap: 0.6rem;
  max-width: 340px;
`;

const Overlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Modal = styled(motion.div)`
  background: ${p => p.theme.card};
  border: 1px solid ${p => p.theme.border};
  border-radius: 16px;
  padding: 2rem;
  max-width: 520px;
  width: 100%;
  box-shadow: ${p => p.theme.shadow};
`;

const ModalTitle = styled.h3`
  color: ${p => p.theme.warning};
  font-size: 1.1rem;
  margin: 0 0 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ModalBody = styled.p`
  color: ${p => p.theme.muted};
  font-size: 0.85rem;
  margin: 0 0 1.5rem;
  line-height: 1.6;
`;

const ModalList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem;
  max-height: 220px;
  overflow-y: auto;

  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.75rem;
    margin-bottom: 0.4rem;
    border-radius: 8px;
    background: ${p => p.theme.name === 'light' ? 'rgba(230,168,23,0.08)' : 'rgba(236,201,75,0.06)'};
    border: 1px solid ${p => p.theme.name === 'light' ? 'rgba(230,168,23,0.2)' : 'rgba(236,201,75,0.15)'};
    font-size: 0.82rem;
    color: ${p => p.theme.text};

    span:last-child {
      color: ${p => p.theme.warning};
      font-weight: 700;
    }
  }
`;

const ModalActions = styled.div`
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: ${p => p.theme.muted};
  font-size: 0.85rem;

  svg {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    opacity: 0.3;
    display: block;
    margin-left: auto;
    margin-right: auto;
  }
`;

const PaidSectionDivider = styled.tr`
  td {
    padding: 0.45rem 0.9rem;
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${p => p.theme.success};
    background: ${p => p.theme.name === 'light'
      ? 'rgba(40,167,69,0.07)'
      : p.theme.name === 'vibrant'
        ? 'rgba(56,178,172,0.07)'
        : 'rgba(72,187,120,0.06)'};
    border-top: 1px dashed ${p => p.theme.success}55;
    border-bottom: 1px dashed ${p => p.theme.success}33;
    font-weight: 600;
    transition: background 0.3s;
  }
`;

const BulkPanel = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem 1.1rem;
  margin-bottom: 0.75rem;
  border-radius: 10px;
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.card};
  box-shadow: ${p => p.theme.shadow};
`;

const BulkLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${p => p.theme.muted};
  white-space: nowrap;
  flex-shrink: 0;
`;

const BulkCount = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 10px;
  background: ${p => p.theme.primary}33;
  color: ${p => p.theme.primary};
  font-size: 0.68rem;
  font-weight: 800;
`;

const BulkDivider = styled.div`
  width: 1px;
  height: 20px;
  background: ${p => p.theme.divider};
  flex-shrink: 0;
`;

const BulkBtn = styled(motion.button)`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 1rem;
  border-radius: 7px;
  border: 1px solid ${p => p.$border || 'transparent'};
  background: ${p => p.$bg};
  color: ${p => p.$color};
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  letter-spacing: 0.02em;
  transition: opacity 0.15s, transform 0.15s;

  &:hover:not(:disabled) { opacity: 0.85; }
  &:disabled { opacity: 0.35; cursor: not-allowed; }

  svg { font-size: 0.8rem; }
`;

const BulkProgress = styled.div`
  margin-left: auto;
  font-size: 0.72rem;
  color: ${p => p.theme.muted};
  white-space: nowrap;
  flex-shrink: 0;
`;

// ─── Receipt Preview Styled Components ────────────────────────────────────────

const ReceiptOverlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  z-index: 7000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  overflow-y: auto;
  backdrop-filter: blur(4px);
`;

const ReceiptWrapper = styled(motion.div)`
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  margin: auto;
`;

// ─── Monthly Receipt Preview (wider) ──────────────────────────────────────────
const MonthReceiptWrapper = styled(motion.div)`
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  margin: auto;
`;

const ReceiptCard = styled.div`
  background: #fafaf8;
  color: #1a1a1a;
  font-family: 'Courier New', Courier, monospace;
  position: relative;
  filter: drop-shadow(0 24px 48px rgba(0,0,0,0.55));
`;

const ReceiptTear = styled.div`
  height: 16px;
  background-color: ${p => p.$dark ? '#0a0c10' : '#f0ede6'};
  background-image: ${p => p.$bottom
    ? `radial-gradient(circle at 10px 18px, ${p.$dark ? '#0a0c10' : '#f0ede6'} 9px, #fafaf8 9px)`
    : `radial-gradient(circle at 10px -2px, ${p.$dark ? '#0a0c10' : '#f0ede6'} 9px, #fafaf8 9px)`};
  background-size: 20px 20px;
  background-repeat: repeat-x;
`;

const ReceiptBody = styled.div`
  padding: 1.4rem 1.85rem 1.1rem;
`;

const ReceiptHeaderSec = styled.div`
  text-align: center;
  padding-bottom: 1.1rem;
  margin-bottom: 1.1rem;
  border-bottom: 2px dashed #d8d4cc;
  position: relative;
`;

const ReceiptLogoRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  margin-bottom: 0.4rem;
`;

const ReceiptLogoIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #00d4ff;
  font-size: 1rem;
`;

const ReceiptBrandName = styled.div`
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #1a1a1a;
`;

const ReceiptSubBrand = styled.div`
  font-size: 0.6rem;
  color: #aaa;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-top: 0.1rem;
`;

const ReceiptMetaGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.3rem 0.5rem;
  margin-bottom: 0.2rem;
`;

const ReceiptMetaItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.08rem;

  .r-lbl { font-size: 0.57rem; letter-spacing: 0.12em; color: #bbb; text-transform: uppercase; }
  .r-val { font-size: 0.76rem; font-weight: 700; color: #1a1a1a; word-break: break-word; }
`;

const ReceiptSectionHead = styled.div`
  font-size: 0.58rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #c0bbb0;
  margin: 1rem 0 0.45rem;
  padding-bottom: 0.28rem;
  border-bottom: 1px solid #ece8e0;
  display: flex;
  align-items: center;
  gap: 0.4rem;

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #ece8e0;
  }
`;

const ReceiptTopicBlock = styled.div`
  font-size: 0.74rem;
  color: #333;
  line-height: 1.6;
  word-break: break-word;
  background: #f5f2eb;
  border-left: 3px solid #1a1a2e;
  padding: 0.55rem 0.7rem;
  border-radius: 0 4px 4px 0;
`;

const ReceiptLineRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.73rem;
  padding: 0.3rem 0;
  color: #555;
  gap: 0.5rem;
  border-bottom: 1px dotted #eee;

  .ll { flex: 1; }
  .lr { font-weight: 600; white-space: nowrap; color: #333; }

  &:last-child { border-bottom: none; }
`;

const ReceiptTotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${p => p.$big ? '0.88rem' : '0.78rem'};
  font-weight: ${p => p.$big ? 800 : 600};
  padding: ${p => p.$big ? '0.6rem 0 0.3rem' : '0.3rem 0'};
  color: ${p => p.$color || '#1a1a1a'};
  border-top: ${p => p.$big ? '2px solid #1a1a1a' : 'none'};
  margin-top: ${p => p.$big ? '0.3rem' : 0};
  gap: 0.5rem;

  .tl { flex: 1; letter-spacing: 0.05em; }
  .tr { white-space: nowrap; }
`;

const ReceiptDividerLine = styled.div`
  border: none;
  border-top: ${p => p.$dashed ? '1px dashed #d8d4cc' : '1px solid #ece8e0'};
  margin: 0.7rem 0;
`;

const ReceiptStampArea = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem 0 0.5rem;
`;

const ReceiptStamp = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 1.75rem;
  border: 3px solid ${p => p.$c};
  color: ${p => p.$c};
  background: ${p => p.$bg};
  font-size: 0.85rem;
  font-weight: 900;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  border-radius: 3px;
  transform: rotate(-2.5deg);
  box-shadow: inset 0 0 0 1px ${p => p.$c}33;
  animation: ${stampDrop} 0.5s cubic-bezier(0.22,1,0.36,1) both;
  animation-delay: 0.1s;
`;

const ReceiptBarcodeRow = styled.div`
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 1px;
  height: 38px;
  padding: 0 0.5rem;
  overflow: hidden;
  margin-top: 0.75rem;
`;

const ReceiptRefCode = styled.div`
  text-align: center;
  font-size: 0.58rem;
  color: #bbb;
  letter-spacing: 0.22em;
  margin: 0.2rem 0 0.75rem;
`;

const ReceiptFooter = styled.div`
  text-align: center;
  font-size: 0.6rem;
  color: #c8c4bc;
  line-height: 1.8;
  padding-top: 0.7rem;
  border-top: 1px dashed #d8d4cc;
`;

const ReceiptActionsBar = styled.div`
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  padding: 0.85rem 1rem;
  background: rgba(0,0,0,0.75);
  border-radius: 0 0 10px 10px;
  border: 1px solid rgba(255,255,255,0.05);
  border-top: none;
`;

const ReceiptActionBtn = styled(motion.button)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.4rem;
  border-radius: 7px;
  border: 1px solid ${p => p.$primary ? 'transparent' : 'rgba(255,255,255,0.15)'};
  background: ${p => p.$primary ? '#00d4ff' : 'rgba(255,255,255,0.07)'};
  color: ${p => p.$primary ? '#0a0a0a' : '#e0e0e0'};
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.04em;
  transition: opacity 0.15s, transform 0.15s;

  &:hover { opacity: 0.88; }
`;

const ReceiptPreviewLabel = styled.div`
  text-align: center;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  margin-bottom: 0.5rem;
`;

// ─── Monthly Statement Preview Styled Components ───────────────────────────────

const MonthSummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.9rem;
`;

const MonthSummaryCard = styled.div`
  border-radius: 4px;
  padding: 0.55rem 0.6rem;
  text-align: center;
  background: ${p => p.$bg};
  border: 1px solid ${p => p.$border};
`;

const MonthRateBarBg = styled.div`
  background: #e8e4da;
  border-radius: 3px;
  height: 7px;
  overflow: hidden;
  margin-top: 0.3rem;
`;

const MonthRateBarFill = styled.div`
  height: 100%;
  border-radius: 3px;
  width: ${p => p.$pct}%;
  background: ${p => p.$c};
`;

const MonthStatusPills = styled.div`
  display: flex;
  gap: 0.45rem;
  justify-content: center;
  flex-wrap: wrap;
  margin: 0.75rem 0;
`;

const MonthStatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.65rem;
  font-weight: 700;
  background: ${p => p.$bg};
  color: ${p => p.$c};
  border: 1px solid ${p => p.$border};
`;

const MonthOrderTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.66rem;
  margin-top: 0.4rem;
  max-height: 220px;
  display: block;
  overflow-y: auto;

  thead { display: table; width: 100%; table-layout: fixed; }
  tbody { display: table; width: 100%; table-layout: fixed; }

  th {
    background: #1a1a2e;
    color: #fafaf8;
    padding: 0.35rem 0.6rem;
    font-size: 0.57rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-align: left;
    font-weight: 700;
  }
  th:last-child { text-align: right; }
  th:nth-child(4) { text-align: right; }

  td {
    padding: 0.32rem 0.6rem;
    border-bottom: 1px solid #ece8e0;
    color: #333;
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = n => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

const statusIcon = (s, theme) =>
  s === 'paid'    ? <FaCheckCircle   color={theme.success} /> :
  s === 'partial' ? <FaHourglassHalf color={theme.warning} /> :
                    <FaTimesCircle   color={theme.danger}  />;

const isFullyPaid = (p) =>
  (p.paymentStatus || '').toLowerCase() === 'paid' &&
  Number(p.amountPaid || 0) >= Number(p.amount || 0) &&
  Number(p.amount || 0) > 0;

// ── Derive the effective balance for a record, never trusting the stored field alone ──
const effectiveBalance = (p) => {
  const amount    = Number(p.amount)    || 0;
  const amountPaid = Number(p.amountPaid) || 0;
  return Math.max(0, amount - amountPaid);
};

// ── Derive the effective payment status from the actual numbers ──
const effectiveStatus = (p) => {
  const amount     = Number(p.amount)    || 0;
  const amountPaid = Number(p.amountPaid) || 0;
  const stored     = (p.paymentStatus || 'unpaid').toLowerCase();

  if (amount > 0 && amountPaid >= amount) return 'paid';
  if (amountPaid > 0 && amountPaid < amount) return 'partial';
  if (stored === 'paid' && amountPaid < amount) return amountPaid > 0 ? 'partial' : 'unpaid';
  return stored;
};

const nextThemeIcon = (current) => {
  const idx  = THEME_ORDER.indexOf(current);
  const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  return next === 'dark'    ? <FaMoon />    :
         next === 'light'   ? <FaSun />     :
                              <FaPalette />;
};

// ── Barcode generator from seed string ──
function genBars(seed = 'receipt') {
  const bars = [];
  const s = seed || 'receipt';
  for (let i = 0; i < 46; i++) {
    const c = s.charCodeAt(i % s.length) || 65;
    bars.push({
      h: 10 + (c % 26),
      w: i % 9 === 0 ? 3 : i % 5 === 0 ? 1 : 2,
    });
  }
  return bars;
}

// ── Sparkline SVG ──
function Sparkline({ data, color, height = 28 }) {
  if (!data || data.length < 2) return null;
  const w = 120, h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.7"
      />
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${pts.join(' ')} ${w},${h}`}
        fill={`url(#sg-${color.replace('#','')})`}
      />
      <circle
        cx={pts[pts.length - 1].split(',')[0]}
        cy={pts[pts.length - 1].split(',')[1]}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PaymentTracker() {
  const [activeThemeName, setActiveThemeName] = useState(() => {
    return localStorage.getItem('paymentTrackerTheme') || 'dark';
  });
  const theme = themes[activeThemeName] || themes.dark;

  const cycleTheme = () => {
    const idx  = THEME_ORDER.indexOf(activeThemeName);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    setActiveThemeName(next);
    localStorage.setItem('paymentTrackerTheme', next);
  };

  // ── Live clock ──
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleString('en-KE', {
        weekday: 'short', day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const [projects,          setProjects]          = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [search,            setSearch]            = useState('');
  const [filterStatus,      setFilterStatus]      = useState('all');
  const [filterMonth,       setFilterMonth]       = useState('all');
  const [itemsPerPage,      setItemsPerPage]      = useState(15);
  const [currentPage,       setCurrentPage]       = useState(1);
  const [sortConfig,        setSortConfig]        = useState({ key: 'orderDate', direction: 'desc' });
  const [saving,            setSaving]            = useState({});
  const [editState,         setEditState]         = useState({});
  const [toast,             setToast]             = useState(null);
  const [cfModal,           setCfModal]           = useState(false);
  const [cfCandidates,      setCfCandidates]      = useState([]);
  const [cfRunning,         setCfRunning]         = useState(false);
  const [receiptProject,    setReceiptProject]    = useState(null);
  // ── NEW: monthly statement preview ──
  const [monthReceiptOpen,  setMonthReceiptOpen]  = useState(false);

  const searchRef = useRef(null);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (monthReceiptOpen) { setMonthReceiptOpen(false); return; }
        if (receiptProject)   { setReceiptProject(null); return; }
        if (document.activeElement === searchRef.current) {
          setSearch('');
          searchRef.current?.blur();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (Object.keys(editState).length > 0) saveAll();
      }
      if (e.key === 't' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
        cycleTheme();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editState, activeThemeName, receiptProject, monthReceiptOpen]);

  // ── Fetch ──
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'projects'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProjects(data);
    } catch (e) {
      showToast('Failed to load projects: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  // ── Toast ──
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Edit state helpers ──
  const getEdit = (p) => editState[p.id] ?? {
    status:     effectiveStatus(p),
    amountPaid: Number(p.amountPaid) || 0,
  };

  const setEdit = (id, patch) =>
    setEditState(prev => {
      const proj    = projects.find(x => x.id === id) || {};
      const current = prev[id] ?? {
        status:     effectiveStatus(proj),
        amountPaid: Number(proj.amountPaid) || 0,
      };
      return { ...prev, [id]: { ...current, ...patch } };
    });

  const markFull    = (p) => setEdit(p.id, { status: 'paid',    amountPaid: Number(p.amount) || 0 });
  const markPartial = (p) => { if (getEdit(p).status !== 'partial') setEdit(p.id, { status: 'partial', amountPaid: getEdit(p).amountPaid || 0 }); };
  const markUnpaid  = (p) => setEdit(p.id, { status: 'unpaid',  amountPaid: 0 });

  // ── Save single row ──
  const saveRow = async (p) => {
    const ed = getEdit(p);
    const totalAmount = Number(p.amount) || 0;
    let { status, amountPaid } = ed;
    amountPaid = Number(amountPaid) || 0;

    if (amountPaid >= totalAmount && totalAmount > 0) status = 'paid';
    else if (amountPaid > 0 && amountPaid < totalAmount) status = 'partial';
    else if (amountPaid <= 0) status = 'unpaid';

    const balance = Math.max(0, totalAmount - amountPaid);

    setSaving(prev => ({ ...prev, [p.id]: true }));
    try {
      await updateDoc(doc(db, 'projects', p.id), {
        paymentStatus: status,
        amountPaid,
        balance,
        lastUpdated: new Date().toISOString(),
      });
      setProjects(prev => prev.map(x =>
        x.id === p.id ? { ...x, paymentStatus: status, amountPaid, balance } : x
      ));
      setEditState(prev => { const n = { ...prev }; delete n[p.id]; return n; });
      showToast(`Saved: ${p.topic?.slice(0, 30) || 'Order'} → ${status.toUpperCase()}`, 'success');
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
    } finally {
      setSaving(prev => { const n = { ...prev }; delete n[p.id]; return n; });
    }
  };

  // ── Save all dirty rows ──
  const saveAll = async () => {
    const dirtyIds = Object.keys(editState);
    if (!dirtyIds.length) return;
    for (const id of dirtyIds) {
      const p = projects.find(x => x.id === id);
      if (p) await saveRow(p);
    }
    showToast(`All ${dirtyIds.length} changes saved.`, 'success');
  };

  // ── Bulk apply status ──
  const [bulkRunning,  setBulkRunning]  = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);

  const applyBulkStatus = async (targetStatus) => {
    const targets = projects.filter(p => {
      if (filterMonth === 'all') return false;
      const d = new Date(p.orderDate);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (k !== filterMonth) return false;
      const current = effectiveStatus(p);
      return current !== targetStatus;
    });

    if (!targets.length) {
      showToast(`All orders in this month are already ${targetStatus}.`, 'warn');
      return;
    }

    setBulkRunning(true);
    setBulkProgress({ done: 0, total: targets.length });

    let succeeded = 0;
    let failed = 0;

    for (const p of targets) {
      const totalAmount = Number(p.amount) || 0;
      let status = targetStatus;
      let amountPaid = targetStatus === 'paid'    ? totalAmount :
                       targetStatus === 'partial'  ? (Number(p.amountPaid) || 0) :
                       0;
      const balance = Math.max(0, totalAmount - amountPaid);

      try {
        await updateDoc(doc(db, 'projects', p.id), {
          paymentStatus: status,
          amountPaid,
          balance,
          lastUpdated: new Date().toISOString(),
        });
        setProjects(prev => prev.map(x =>
          x.id === p.id ? { ...x, paymentStatus: status, amountPaid, balance } : x
        ));
        succeeded++;
      } catch {
        failed++;
      }
      setBulkProgress({ done: succeeded + failed, total: targets.length });
    }

    setEditState(prev => {
      const next = { ...prev };
      targets.forEach(p => delete next[p.id]);
      return next;
    });

    setBulkRunning(false);
    setBulkProgress(null);
    showToast(
      failed > 0
        ? `Bulk update: ${succeeded} saved, ${failed} failed.`
        : `${succeeded} order(s) marked as ${targetStatus}.`,
      failed > 0 ? 'error' : 'success'
    );
  };

  // ── Carry-forward ──
  const openCarryForward = () => {
    const now = new Date();
    const [cy, cm] = [now.getFullYear(), now.getMonth()];
    const candidates = projects.filter(p => {
      const bal = effectiveBalance(p);
      if (bal <= 0) return false;
      if (effectiveStatus(p) === 'paid') return false;
      if (p.isCarryForward) return false;
      const d = new Date(p.orderDate);
      return !(d.getFullYear() === cy && d.getMonth() === cm);
    });
    setCfCandidates(candidates);
    setCfModal(true);
  };

  const runCarryForward = async () => {
    setCfRunning(true);
    try {
      const now = new Date();
      const [cy, cm] = [now.getFullYear(), now.getMonth()];
      const cfSnap = await getDocs(query(collection(db, 'projects'), where('isCarryForward', '==', true)));
      const alreadyCF = new Set(
        cfSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(cf => { const d = new Date(cf.orderDate); return d.getFullYear() === cy && d.getMonth() === cm; })
          .map(cf => cf.carryForwardFromId)
      );

      const isoDate = new Date(cy, cm, 1).toISOString();
      let created = 0;
      for (const p of cfCandidates) {
        if (alreadyCF.has(p.id)) continue;
        const bal = effectiveBalance(p);
        await addDoc(collection(db, 'projects'), {
          orderDate: isoDate, submissionDate: p.submissionDate || isoDate,
          amount: bal, amountPaid: 0, balance: bal, paymentStatus: 'unpaid',
          orderRefCode: p.orderRefCode, orderType: p.orderType, topic: p.topic,
          words: p.words || 0, cpp: p.cpp || 0,
          hasCode: p.hasCode || false, codeAmount: p.codeAmount || 0,
          hasPresentation: p.hasPresentation || false, slideCount: p.slideCount || 0,
          status: ['completed', 'cancelled'].includes(p.status) ? p.status : 'pending',
          priority: p.priority || 'medium',
          notes: p.notes ? `[Balance carried forward] ${p.notes}` : '[Balance carried forward]',
          isCarryForward: true, carryForwardFromId: p.id,
          createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString(),
        });
        created++;
      }
      showToast(`${created} balance(s) carried forward.`, 'success');
      setCfModal(false);
      await fetchProjects();
    } catch (e) {
      showToast('Carry-forward failed: ' + e.message, 'error');
    } finally {
      setCfRunning(false);
    }
  };

  // ── Receipt printing (single order) ──
  const printReceiptToWindow = (p) => {
    const statusS    = effectiveStatus(p);
    const totalAmt   = Number(p.amount) || 0;
    const paidAmt    = Number(p.amountPaid) || 0;
    const balAmt     = effectiveBalance(p);

    const stampColor = statusS === 'paid'    ? '#1a6b3c' : statusS === 'partial' ? '#b45309' : '#991b1b';
    const stampBg    = statusS === 'paid'    ? '#d1fae5' : statusS === 'partial' ? '#fef3c7' : '#fee2e2';
    const stampText  = statusS === 'paid'    ? 'PAID IN FULL' : statusS === 'partial' ? 'PARTIAL' : 'UNPAID';
    const stampMark  = statusS === 'paid'    ? '✓' : statusS === 'partial' ? '◑' : '✕';

    const words      = Number(p.words)      || 0;
    const cpp        = Number(p.cpp)        || 0;
    const codeAmt    = p.hasCode            ? (Number(p.codeAmount) || 0) : 0;
    const slideCount = Number(p.slideCount) || 0;
    const writingAmt = words && cpp ? words * cpp : 0;

    const fmtR = n => `KES&nbsp;${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

    let breakdownRows = '';
    if (writingAmt > 0) {
      breakdownRows += `<div class="line-row"><span class="ll">${words.toLocaleString()} words &times; KES&nbsp;${cpp}/w</span><span class="lr">${fmtR(writingAmt)}</span></div>`;
    }
    if (p.hasCode && codeAmt > 0) {
      breakdownRows += `<div class="line-row"><span class="ll">Code supplement</span><span class="lr">${fmtR(codeAmt)}</span></div>`;
    }
    if (p.hasPresentation && slideCount > 0) {
      breakdownRows += `<div class="line-row"><span class="ll">Presentation &mdash; ${slideCount} slide${slideCount !== 1 ? 's' : ''}</span><span class="lr">&mdash;</span></div>`;
    }
    if (!breakdownRows) {
      breakdownRows = `<div class="line-row"><span class="ll">Order Amount</span><span class="lr">${fmtR(totalAmt)}</span></div>`;
    }

    const bars     = genBars(p.id || p.orderRefCode || 'receipt');
    const barsHtml = bars.map(b =>
      `<div style="background:#2a2a2a;width:${b.w}px;height:${b.h}px;flex-shrink:0;"></div>`
    ).join('');

    const orderDateStr = p.orderDate
      ? new Date(p.orderDate).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—';
    const printDateStr = new Date().toLocaleString('en-KE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Receipt &middot; ${p.orderRefCode || 'Order'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=DM+Serif+Display&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  body{ background:#1c1c28; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding:2.5rem 1rem 3rem; font-family:'Space Mono','Courier New',monospace; }
  .page-title{ font-family:'Space Mono',monospace; color:rgba(255,255,255,0.25); font-size:0.6rem; letter-spacing:0.3em; text-transform:uppercase; margin-bottom:1.25rem; }
  .receipt-outer{ width:100%; max-width:400px; filter:drop-shadow(0 20px 40px rgba(0,0,0,0.6)); }
  .tear{ height:18px; background-size:20px 20px; background-repeat:repeat-x; }
  .tear-top{ background-color:#1c1c28; background-image:radial-gradient(circle at 10px -2px,#1c1c28 9px,#faf8f3 9px); }
  .tear-bottom{ background-color:#1c1c28; background-image:radial-gradient(circle at 10px 20px,#1c1c28 9px,#faf8f3 9px); }
  .receipt-body{ background:#faf8f3; padding:1.5rem 1.85rem 1.25rem; color:#1c1c1c; }
  .r-header{ text-align:center; padding-bottom:1.1rem; margin-bottom:1.1rem; border-bottom:2px dashed #ddd8ce; }
  .r-logo-row{ display:flex; align-items:center; justify-content:center; gap:0.65rem; margin-bottom:0.35rem; }
  .r-icon-box{ width:34px; height:34px; border-radius:7px; background:linear-gradient(135deg,#1c1c28 0%,#2a2a3e 100%); display:flex; align-items:center; justify-content:center; font-size:0.95rem; }
  .r-brand{ font-size:0.95rem; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; color:#1c1c1c; }
  .r-subbrand{ font-size:0.57rem; color:#b0a898; letter-spacing:0.16em; text-transform:uppercase; }
  .r-meta-grid{ display:grid; grid-template-columns:1fr 1fr; gap:0.35rem 0.5rem; }
  .r-meta-item{ display:flex; flex-direction:column; gap:0.07rem; }
  .r-meta-item .ml{ font-size:0.55rem; letter-spacing:0.14em; color:#c0b8ac; text-transform:uppercase; }
  .r-meta-item .mv{ font-size:0.74rem; font-weight:700; color:#1c1c1c; word-break:break-word; }
  .r-sec{ font-size:0.56rem; letter-spacing:0.22em; text-transform:uppercase; color:#c0b8ac; margin:1rem 0 0.42rem; padding-bottom:0.25rem; border-bottom:1px solid #e8e4da; }
  .r-topic{ font-size:0.73rem; color:#333; line-height:1.6; word-break:break-word; background:#f0ece3; border-left:3px solid #1c1c28; padding:0.5rem 0.65rem; border-radius:0 3px 3px 0; }
  .cf-tag{ display:inline-block; font-size:0.58rem; background:#fef3c7; color:#92400e; border:1px solid #fcd34d; padding:0.1rem 0.45rem; border-radius:10px; margin-top:0.35rem; letter-spacing:0.05em; }
  .line-row{ display:flex; justify-content:space-between; align-items:center; font-size:0.72rem; padding:0.28rem 0; color:#555; gap:0.5rem; border-bottom:1px dotted #e8e4da; }
  .line-row:last-child{ border-bottom:none; }
  .ll{ flex:1; }
  .lr{ font-weight:600; white-space:nowrap; color:#333; }
  .r-divider{ border:none; border-top:1px dashed #ddd8ce; margin:0.65rem 0; }
  .total-row{ display:flex; justify-content:space-between; align-items:center; gap:0.5rem; padding:0.3rem 0; }
  .total-row.grand{ border-top:2px solid #1c1c1c; margin-top:0.3rem; padding-top:0.6rem; font-weight:700; font-size:0.88rem; color:#1c1c1c; }
  .total-row.paid-line{ color:#166534; font-weight:600; font-size:0.78rem; }
  .total-row.bal-pos{ color:#991b1b; font-weight:600; font-size:0.78rem; }
  .total-row.bal-zero{ color:#166534; font-weight:600; font-size:0.78rem; }
  .tl{ flex:1; }
  .tr{ white-space:nowrap; }
  .stamp-area{ display:flex; justify-content:center; align-items:center; padding:1.1rem 0 0.6rem; }
  .stamp{ display:inline-flex; align-items:center; gap:0.5rem; padding:0.48rem 1.6rem; border:3px solid ${stampColor}; color:${stampColor}; background:${stampBg}; font-size:0.82rem; font-weight:900; letter-spacing:0.26em; text-transform:uppercase; border-radius:3px; transform:rotate(-2.5deg); box-shadow:inset 0 0 0 1px ${stampColor}33; }
  .barcode-row{ display:flex; justify-content:center; align-items:flex-end; gap:1px; height:36px; padding:0 0.5rem; overflow:hidden; margin-top:0.75rem; }
  .ref-code{ text-align:center; font-size:0.57rem; color:#c0b8ac; letter-spacing:0.24em; margin:0.18rem 0 0.75rem; }
  .r-footer{ text-align:center; font-size:0.58rem; color:#ccc8be; line-height:1.85; padding-top:0.65rem; border-top:1px dashed #ddd8ce; }
  .print-actions{ display:flex; gap:0.75rem; justify-content:center; margin-top:1.5rem; }
  .btn{ display:inline-flex; align-items:center; gap:0.45rem; padding:0.6rem 1.6rem; border-radius:7px; font-family:'Space Mono',monospace; font-size:0.78rem; font-weight:700; letter-spacing:0.06em; cursor:pointer; border:none; transition:opacity 0.15s; }
  .btn:hover{ opacity:0.85; }
  .btn-print{ background:#faf8f3; color:#1c1c28; }
  .btn-close{ background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.7); border:1px solid rgba(255,255,255,0.15); }
  @media print{ body{ background:white; padding:0; } .page-title,.print-actions{ display:none !important; } .receipt-outer{ filter:none; max-width:100%; } .tear-top{ background-color:white; background-image:radial-gradient(circle at 10px -2px,white 9px,#faf8f3 9px); } .tear-bottom{ background-image:radial-gradient(circle at 10px 20px,white 9px,#faf8f3 9px); } }
</style>
</head>
<body>
<div class="page-title">&#9632; Payment Receipt Preview</div>
<div class="receipt-outer">
  <div class="tear tear-top"></div>
  <div class="receipt-body">
    <div class="r-header">
      <div class="r-logo-row">
        <div class="r-icon-box">&#9775;</div>
        <div><div class="r-brand">Payment Receipt</div><div class="r-subbrand">Freelance Order System</div></div>
      </div>
    </div>
    <div class="r-meta-grid">
      <div class="r-meta-item"><span class="ml">Receipt No.</span><span class="mv">${p.orderRefCode || '—'}</span></div>
      <div class="r-meta-item"><span class="ml">Order Date</span><span class="mv">${orderDateStr}</span></div>
      <div class="r-meta-item"><span class="ml">Order Type</span><span class="mv">${p.orderType || '—'}</span></div>
      <div class="r-meta-item"><span class="ml">Status</span><span class="mv" style="color:${stampColor};text-transform:uppercase;">${statusS}</span></div>
    </div>
    <div class="r-sec">Order Details</div>
    <div class="r-topic">${p.topic || 'No topic specified'}${p.isCarryForward ? '<br><span class="cf-tag">&#8629; Carried Forward Balance</span>' : ''}</div>
    <div class="r-sec">Payment Breakdown</div>
    <div>${breakdownRows}</div>
    <hr class="r-divider">
    <div class="total-row grand"><span class="tl">TOTAL INVOICED</span><span class="tr">${fmtR(totalAmt)}</span></div>
    <div class="total-row paid-line"><span class="tl">Amount Paid</span><span class="tr">${fmtR(paidAmt)}</span></div>
    <div class="total-row ${balAmt > 0 ? 'bal-pos' : 'bal-zero'}"><span class="tl">Outstanding Balance</span><span class="tr">${fmtR(balAmt)}</span></div>
    <div class="stamp-area"><div class="stamp">${stampMark}&nbsp; ${stampText}</div></div>
    <div class="barcode-row">${barsHtml}</div>
    <div class="ref-code">${(p.orderRefCode || p.id || '').toUpperCase()}</div>
    <div class="r-footer">Printed: ${printDateStr}<br>${p.lastUpdated ? `Last updated: ${new Date(p.lastUpdated).toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}<br>This is a system-generated receipt. Retain for your records.</div>
  </div>
  <div class="tear tear-bottom"></div>
</div>
<div class="print-actions">
  <button class="btn btn-print" onclick="window.print()">&#9113; Print / Save PDF</button>
  <button class="btn btn-close" onclick="window.close()">&#10005; Close</button>
</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=560,height=860,scrollbars=yes,resizable=yes');
    if (!win) { showToast('Popup blocked — please allow popups for printing.', 'warn'); return; }
    win.document.write(html);
    win.document.close();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ── MONTHLY RECEIPT / STATEMENT ───────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  const printMonthlyReceipt = (monthKey) => {
    const [yr, mo] = monthKey.split('-');
    const monthLabel = new Date(Number(yr), Number(mo) - 1, 1)
      .toLocaleString('en-KE', { month: 'long', year: 'numeric' });

    const monthOrders = projects
      .filter(p => {
        const d = new Date(p.orderDate);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return k === monthKey;
      })
      .sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));

    if (!monthOrders.length) {
      showToast('No orders found for this month.', 'warn');
      return;
    }

    const totalInvoiced    = monthOrders.reduce((s, p) => s + (Number(p.amount)    || 0), 0);
    const totalReceived    = monthOrders.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
    const totalOutstanding = monthOrders.reduce((s, p) => s + effectiveBalance(p), 0);
    const cPaid    = monthOrders.filter(p => effectiveStatus(p) === 'paid').length;
    const cPartial = monthOrders.filter(p => effectiveStatus(p) === 'partial').length;
    const cUnpaid  = monthOrders.filter(p => effectiveStatus(p) === 'unpaid').length;

    const collectionRate = totalInvoiced > 0
      ? ((totalReceived / totalInvoiced) * 100).toFixed(1)
      : '0.0';

    const fmtR = n => `KES&nbsp;${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
    const printDateStr = new Date().toLocaleString('en-KE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const groups = [
      { label: 'Fully Paid', status: 'paid',    color: '#1a6b3c', bg: '#d1fae5', mark: '✓' },
      { label: 'Partial',    status: 'partial',  color: '#b45309', bg: '#fef3c7', mark: '◑' },
      { label: 'Unpaid',     status: 'unpaid',   color: '#991b1b', bg: '#fee2e2', mark: '✕' },
    ];

    let orderRowsHtml = '';
    groups.forEach(({ label, status, color, bg, mark }) => {
      const group = monthOrders.filter(p => effectiveStatus(p) === status);
      if (!group.length) return;

      orderRowsHtml += `
        <tr class="group-header" style="background:${bg};">
          <td colspan="5" style="padding:0.4rem 0.75rem;font-size:0.6rem;letter-spacing:0.18em;
            text-transform:uppercase;color:${color};font-weight:700;border-top:1px solid ${color}33;
            border-bottom:1px solid ${color}22;">
            ${mark}&nbsp;&nbsp;${label} &mdash; ${group.length} order${group.length !== 1 ? 's' : ''}
          </td>
        </tr>`;

      group.forEach((p, i) => {
        const amt  = Number(p.amount)    || 0;
        const paid = Number(p.amountPaid) || 0;
        const bal  = effectiveBalance(p);
        const dateStr = p.orderDate
          ? new Date(p.orderDate).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })
          : '—';
        const topic = (p.topic || 'No topic').length > 42
          ? (p.topic || '').slice(0, 42) + '…'
          : (p.topic || 'No topic');
        const rowBg = i % 2 === 0 ? '#faf8f3' : '#f5f2eb';
        const cfTag = p.isCarryForward
          ? `<span style="font-size:0.56rem;color:#92400e;background:#fef3c7;border:1px solid #fcd34d;
              padding:0.05rem 0.35rem;border-radius:8px;margin-left:0.3rem;">CF</span>`
          : '';

        orderRowsHtml += `
          <tr style="background:${rowBg};border-bottom:1px solid #ece8e0;">
            <td style="padding:0.42rem 0.75rem;font-size:0.66rem;color:#888;white-space:nowrap;">${dateStr}</td>
            <td style="padding:0.42rem 0.75rem;font-size:0.66rem;color:#1a6b3c;font-weight:700;white-space:nowrap;">
              ${p.orderRefCode || '—'}
            </td>
            <td style="padding:0.42rem 0.75rem;font-size:0.66rem;color:#333;max-width:200px;">
              ${topic}${cfTag}
            </td>
            <td style="padding:0.42rem 0.75rem;font-size:0.66rem;font-weight:600;white-space:nowrap;text-align:right;color:#1c1c1c;">
              ${fmtR(amt)}
            </td>
            <td style="padding:0.42rem 0.75rem;font-size:0.66rem;font-weight:600;white-space:nowrap;text-align:right;
              color:${bal > 0 ? '#991b1b' : '#1a6b3c'};">
              ${bal > 0 ? fmtR(bal) : '<span style="color:#1a6b3c">✓ Settled</span>'}
            </td>
          </tr>`;
      });

      const grpTotal    = group.reduce((s, p) => s + (Number(p.amount)    || 0), 0);
      const grpReceived = group.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
      const grpBal      = group.reduce((s, p) => s + effectiveBalance(p), 0);
      orderRowsHtml += `
        <tr style="background:${bg};border-bottom:2px solid ${color}33;">
          <td colspan="3" style="padding:0.35rem 0.75rem;font-size:0.6rem;color:${color};
            font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Subtotal</td>
          <td style="padding:0.35rem 0.75rem;font-size:0.66rem;font-weight:700;text-align:right;color:${color};">
            ${fmtR(grpTotal)}
          </td>
          <td style="padding:0.35rem 0.75rem;font-size:0.66rem;font-weight:700;text-align:right;color:${color};">
            ${grpBal > 0 ? fmtR(grpBal) : '—'}
          </td>
        </tr>`;
    });

    const bars = genBars(monthKey);
    const barsHtml = bars.map(b =>
      `<div style="background:#2a2a2a;width:${b.w}px;height:${b.h}px;flex-shrink:0;"></div>`
    ).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Monthly Statement &middot; ${monthLabel}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#1c1c28; min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:2.5rem 1rem 3rem; font-family:'Space Mono','Courier New',monospace; }
  .page-title { color:rgba(255,255,255,0.25); font-size:0.58rem; letter-spacing:0.3em; text-transform:uppercase; margin-bottom:1.25rem; }
  .receipt-outer { width:100%; max-width:620px; filter:drop-shadow(0 20px 48px rgba(0,0,0,0.6)); }
  .tear { height:18px; background-size:20px 20px; background-repeat:repeat-x; }
  .tear-top    { background-color:#1c1c28; background-image:radial-gradient(circle at 10px -2px,#1c1c28 9px,#faf8f3 9px); }
  .tear-bottom { background-color:#1c1c28; background-image:radial-gradient(circle at 10px 20px,#1c1c28 9px,#faf8f3 9px); }
  .receipt-body { background:#faf8f3; padding:1.6rem 1.85rem 1.25rem; color:#1c1c1c; }
  .r-header { text-align:center; padding-bottom:1rem; margin-bottom:1rem; border-bottom:2px dashed #ddd8ce; }
  .r-logo-row { display:flex; align-items:center; justify-content:center; gap:0.65rem; margin-bottom:0.3rem; }
  .r-icon-box { width:36px; height:36px; border-radius:8px; background:linear-gradient(135deg,#1c1c28,#2a2a3e); display:flex; align-items:center; justify-content:center; font-size:1rem; }
  .r-brand { font-size:1rem; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; color:#1c1c1c; }
  .r-subbrand { font-size:0.56rem; color:#b0a898; letter-spacing:0.16em; text-transform:uppercase; margin-top:0.1rem; }
  .r-month-badge { display:inline-block; margin-top:0.6rem; background:#1c1c28; color:#faf8f3; font-size:0.72rem; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; padding:0.35rem 1.2rem; border-radius:2px; }
  .summary-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0.6rem; margin-bottom:1.1rem; }
  .summary-card { border-radius:4px; padding:0.6rem 0.7rem; text-align:center; }
  .summary-card .sc-lbl { font-size:0.55rem; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:0.2rem; }
  .summary-card .sc-val { font-size:0.82rem; font-weight:800; }
  .summary-card .sc-sub { font-size:0.57rem; margin-top:0.1rem; opacity:0.75; }
  .r-sec { font-size:0.55rem; letter-spacing:0.22em; text-transform:uppercase; color:#c0b8ac; margin:0.9rem 0 0.4rem; padding-bottom:0.22rem; border-bottom:1px solid #e8e4da; }
  .order-table { width:100%; border-collapse:collapse; font-size:0.66rem; }
  .order-table th { background:#1c1c28; color:#faf8f3; padding:0.4rem 0.75rem; font-size:0.57rem; letter-spacing:0.14em; text-transform:uppercase; text-align:left; font-weight:700; }
  .order-table th:last-child,.order-table th:nth-child(4) { text-align:right; }
  .totals-block { margin-top:0.8rem; border-top:2px solid #1c1c28; padding-top:0.6rem; }
  .total-row { display:flex; justify-content:space-between; align-items:center; padding:0.28rem 0; font-size:0.74rem; gap:0.5rem; }
  .total-row.grand { font-size:0.88rem; font-weight:800; color:#1c1c1c; padding-top:0.4rem; border-top:1px dashed #ddd8ce; margin-top:0.3rem; }
  .total-row.received { color:#1a6b3c; font-weight:700; }
  .total-row.outstanding { font-weight:700; }
  .tl { flex:1; letter-spacing:0.04em; }
  .tr { white-space:nowrap; }
  .rate-section { margin-top:0.9rem; }
  .rate-label-row { display:flex; justify-content:space-between; font-size:0.62rem; color:#888; margin-bottom:0.3rem; }
  .rate-bar-bg { background:#e8e4da; border-radius:3px; height:8px; overflow:hidden; }
  .rate-bar-fill { height:100%; border-radius:3px; }
  .status-pills { display:flex; gap:0.5rem; justify-content:center; margin-top:0.9rem; flex-wrap:wrap; }
  .s-pill { display:inline-flex; align-items:center; gap:0.35rem; padding:0.3rem 0.75rem; border-radius:20px; font-size:0.66rem; font-weight:700; letter-spacing:0.04em; }
  .barcode-row { display:flex; justify-content:center; align-items:flex-end; gap:1px; height:34px; padding:0 0.5rem; overflow:hidden; margin-top:1rem; }
  .ref-code { text-align:center; font-size:0.55rem; color:#c0b8ac; letter-spacing:0.22em; margin:0.18rem 0 0.6rem; }
  .r-footer { text-align:center; font-size:0.57rem; color:#ccc8be; line-height:1.9; padding-top:0.6rem; border-top:1px dashed #ddd8ce; }
  .print-actions { display:flex; gap:0.75rem; justify-content:center; margin-top:1.5rem; }
  .btn { display:inline-flex; align-items:center; gap:0.45rem; padding:0.6rem 1.6rem; border-radius:7px; font-family:'Space Mono',monospace; font-size:0.78rem; font-weight:700; letter-spacing:0.06em; cursor:pointer; border:none; transition:opacity 0.15s; }
  .btn:hover { opacity:0.85; }
  .btn-print { background:#faf8f3; color:#1c1c28; }
  .btn-close { background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.7); border:1px solid rgba(255,255,255,0.15); }
  @media print { body { background:white; padding:0; } .page-title,.print-actions { display:none !important; } .receipt-outer { filter:none; max-width:100%; } .tear-top { background-color:white; background-image:radial-gradient(circle at 10px -2px,white 9px,#faf8f3 9px); } .tear-bottom { background-image:radial-gradient(circle at 10px 20px,white 9px,#faf8f3 9px); } }
</style>
</head>
<body>
<div class="page-title">&#9632; Monthly Payment Statement</div>
<div class="receipt-outer">
  <div class="tear tear-top"></div>
  <div class="receipt-body">
    <div class="r-header">
      <div class="r-logo-row">
        <div class="r-icon-box">&#9775;</div>
        <div><div class="r-brand">Monthly Statement</div><div class="r-subbrand">Freelance Order System</div></div>
      </div>
      <div class="r-month-badge">${monthLabel}</div>
    </div>
    <div class="summary-grid">
      <div class="summary-card" style="background:#f0ece3;border:1px solid #ddd8ce;">
        <div class="sc-lbl" style="color:#888;">Total Invoiced</div>
        <div class="sc-val" style="color:#1c1c1c;">${fmtR(totalInvoiced)}</div>
        <div class="sc-sub" style="color:#888;">${monthOrders.length} order${monthOrders.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="summary-card" style="background:#d1fae5;border:1px solid #86efac;">
        <div class="sc-lbl" style="color:#166534;">Received</div>
        <div class="sc-val" style="color:#1a6b3c;">${fmtR(totalReceived)}</div>
        <div class="sc-sub" style="color:#166534;">${cPaid} fully paid</div>
      </div>
      <div class="summary-card" style="background:${totalOutstanding > 0 ? '#fee2e2' : '#d1fae5'};border:1px solid ${totalOutstanding > 0 ? '#fca5a5' : '#86efac'};">
        <div class="sc-lbl" style="color:${totalOutstanding > 0 ? '#991b1b' : '#166534'};">Outstanding</div>
        <div class="sc-val" style="color:${totalOutstanding > 0 ? '#991b1b' : '#1a6b3c'};">${fmtR(totalOutstanding)}</div>
        <div class="sc-sub" style="color:${totalOutstanding > 0 ? '#991b1b' : '#166534'};">${cUnpaid} unpaid, ${cPartial} partial</div>
      </div>
    </div>
    <div class="rate-section">
      <div class="rate-label-row">
        <span>Collection Rate</span>
        <span style="font-weight:700;color:${Number(collectionRate) >= 80 ? '#1a6b3c' : Number(collectionRate) >= 50 ? '#b45309' : '#991b1b'};">${collectionRate}%</span>
      </div>
      <div class="rate-bar-bg">
        <div class="rate-bar-fill" style="width:${Math.min(100, Number(collectionRate))}%;background:${Number(collectionRate) >= 80 ? '#1a6b3c' : Number(collectionRate) >= 50 ? '#b45309' : '#991b1b'};"></div>
      </div>
    </div>
    <div class="status-pills">
      <span class="s-pill" style="background:#d1fae5;color:#1a6b3c;border:1px solid #86efac;">&#10003; ${cPaid} Paid</span>
      <span class="s-pill" style="background:#fef3c7;color:#b45309;border:1px solid #fcd34d;">&#9685; ${cPartial} Partial</span>
      <span class="s-pill" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;">&#10005; ${cUnpaid} Unpaid</span>
    </div>
    <div class="r-sec" style="margin-top:1.1rem;">Order Breakdown</div>
    <table class="order-table">
      <thead>
        <tr>
          <th>Date</th><th>Ref</th><th>Topic</th>
          <th style="text-align:right;">Invoiced</th>
          <th style="text-align:right;">Balance</th>
        </tr>
      </thead>
      <tbody>${orderRowsHtml}</tbody>
    </table>
    <div class="totals-block">
      <div class="total-row grand"><span class="tl">TOTAL INVOICED</span><span class="tr">${fmtR(totalInvoiced)}</span></div>
      <div class="total-row received"><span class="tl">Total Received</span><span class="tr">${fmtR(totalReceived)}</span></div>
      <div class="total-row outstanding" style="color:${totalOutstanding > 0 ? '#991b1b' : '#1a6b3c'};"><span class="tl">Outstanding Balance</span><span class="tr">${fmtR(totalOutstanding)}</span></div>
    </div>
    <div class="barcode-row">${barsHtml}</div>
    <div class="ref-code">STMT &middot; ${monthKey.replace('-', '/')} &middot; ${monthOrders.length} ORDERS</div>
    <div class="r-footer">Generated: ${printDateStr}<br>This is a system-generated monthly statement. Retain for your records.</div>
  </div>
  <div class="tear tear-bottom"></div>
</div>
<div class="print-actions">
  <button class="btn btn-print" onclick="window.print()">&#9113; Print / Save PDF</button>
  <button class="btn btn-close" onclick="window.close()">&#10005; Close</button>
</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=720,height=960,scrollbars=yes,resizable=yes');
    if (!win) { showToast('Popup blocked — please allow popups for printing.', 'warn'); return; }
    win.document.write(html);
    win.document.close();
  };

  // ── Month options ──
  const monthOptions = useMemo(() => {
    const seen = new Set();
    projects.forEach(p => {
      const d = new Date(p.orderDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      seen.add(key);
    });
    return Array.from(seen).sort().reverse().map(k => {
      const [yr, mo] = k.split('-');
      const label = new Date(Number(yr), Number(mo) - 1, 1)
        .toLocaleString('default', { month: 'long', year: 'numeric' });
      return { key: k, label };
    });
  }, [projects]);

  // ── Monthly stats for in-app preview ──
  const monthStats = useMemo(() => {
    if (filterMonth === 'all') return null;
    const monthOrders = projects.filter(p => {
      const d = new Date(p.orderDate);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return k === filterMonth;
    });
    const totalInvoiced    = monthOrders.reduce((s, p) => s + (Number(p.amount)    || 0), 0);
    const totalReceived    = monthOrders.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
    const totalOutstanding = monthOrders.reduce((s, p) => s + effectiveBalance(p), 0);
    const cPaid    = monthOrders.filter(p => effectiveStatus(p) === 'paid').length;
    const cPartial = monthOrders.filter(p => effectiveStatus(p) === 'partial').length;
    const cUnpaid  = monthOrders.filter(p => effectiveStatus(p) === 'unpaid').length;
    const collectionRate = totalInvoiced > 0 ? (totalReceived / totalInvoiced) * 100 : 0;
    const [yr, mo] = filterMonth.split('-');
    const monthLabel = new Date(Number(yr), Number(mo) - 1, 1)
      .toLocaleString('en-KE', { month: 'long', year: 'numeric' });
    return { monthOrders, totalInvoiced, totalReceived, totalOutstanding, cPaid, cPartial, cUnpaid, collectionRate, monthLabel };
  }, [projects, filterMonth]);

  // ── Sorting ──
  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    setCurrentPage(1);
  };

  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col) return <FaSort style={{ opacity: 0.3 }} />;
    return sortConfig.direction === 'asc' ? <FaSortUp /> : <FaSortDown />;
  };

  // ── Filtered + Sorted + Partitioned ──
  const processed = useMemo(() => {
    let list = [...projects];

    if (filterMonth !== 'all') {
      list = list.filter(p => {
        const d = new Date(p.orderDate);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return k === filterMonth;
      });
    }

    if (filterStatus !== 'all') {
      list = list.filter(p => effectiveStatus(p) === filterStatus);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => Object.values(p).some(v => String(v).toLowerCase().includes(q)));
    }

    list.sort((a, b) => {
      const { key, direction } = sortConfig;
      const av = a[key] ?? '', bv = b[key] ?? '';
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else if (key === 'orderDate' || key === 'submissionDate') cmp = new Date(av) - new Date(bv);
      else cmp = String(av).localeCompare(String(bv));
      return direction === 'asc' ? cmp : -cmp;
    });

    const active = list.filter(p => effectiveStatus(p) !== 'paid');
    const paid   = list.filter(p => effectiveStatus(p) === 'paid');
    return { active, paid, all: [...active, ...paid] };
  }, [projects, search, filterStatus, filterMonth, sortConfig]);

  // ── Pagination ──
  const totalItems = processed.all.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage   = Math.min(currentPage, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return processed.all.slice(start, start + itemsPerPage);
  }, [processed.all, safePage, itemsPerPage]);

  const paidGlobalStart = processed.active.length;

  // ─────────────────────────────────────────────────────────────────────────────
  // ── STATS ─────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = projects;
    const totalInvoiced   = all.reduce((s, p) => s + (Number(p.amount)    || 0), 0);
    const totalReceived   = all.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
    const totalOutstanding = all.reduce((s, p) => s + effectiveBalance(p), 0);
    const cPaid    = all.filter(p => effectiveStatus(p) === 'paid').length;
    const cPartial = all.filter(p => effectiveStatus(p) === 'partial').length;
    const cUnpaid  = all.filter(p => effectiveStatus(p) === 'unpaid').length;
    return { total: totalInvoiced, paid: totalReceived, balance: totalOutstanding, cPaid, cPartial, cUnpaid };
  }, [projects]);

  // ── Sparkline data ──
  const sparkData = useMemo(() => {
    const months = {};
    projects.forEach(p => {
      if (!p.orderDate) return;
      const d = new Date(p.orderDate);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[k] = (months[k] || 0) + (Number(p.amountPaid) || 0);
    });
    return Object.keys(months).sort().slice(-6).map(k => months[k]);
  }, [projects]);

  const dirtyCount = Object.keys(editState).length;

  const bulkMonthCount = useMemo(() => {
    if (filterMonth === 'all') return 0;
    return projects.filter(p => {
      const d = new Date(p.orderDate);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return k === filterMonth;
    }).length;
  }, [projects, filterMonth]);

  const pageNumbers = useMemo(() => {
    const pages = [];
    const delta = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= safePage - delta && i <= safePage + delta)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  }, [totalPages, safePage]);

  // ── Receipt in-app preview helpers ──
  const getStampProps = (status) => {
    switch ((status || 'unpaid').toLowerCase()) {
      case 'paid':    return { c: '#1a6b3c', bg: '#d1fae5', text: 'PAID IN FULL', mark: '✓' };
      case 'partial': return { c: '#b45309', bg: '#fef3c7', text: 'PARTIAL',      mark: '◑' };
      default:        return { c: '#991b1b', bg: '#fee2e2', text: 'UNPAID',       mark: '✕' };
    }
  };

  // ── Rate bar color ──
  const rateColor = (rate) =>
    rate >= 80 ? '#1a6b3c' : rate >= 50 ? '#b45309' : '#991b1b';

  // ── Render ──
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle theme={theme} />
      <Page>
        <Inner>
          {/* ── Header ── */}
          <Header>
            <HeaderLeft>
              <Title>
                <FaMoneyBillWave />
                Payment Tracker
              </Title>
              <Subtitle>
                Track, update and carry forward balances across all orders
              </Subtitle>
              <LiveClock theme={theme}>{clock}</LiveClock>
            </HeaderLeft>

            <HeaderRight>
              <ThemeToggleBtn
                onClick={cycleTheme}
                whileHover={{ scale: 1.12, rotate: 15 }}
                whileTap={{ scale: 0.90 }}
                title="Switch theme"
              >
                {nextThemeIcon(activeThemeName)}
              </ThemeToggleBtn>
            </HeaderRight>
          </Header>

          {/* ── Stats Bar ── */}
          <StatsBar>
            {[
              {
                label: 'Total Invoiced', value: fmt(stats.total),
                sub: `${projects.length} orders`, $color: `${theme.primary}55`,
                valueColor: theme.primary, delay: 0.05, sparkColor: theme.primary,
              },
              {
                label: 'Amount Received', value: fmt(stats.paid),
                sub: `${stats.cPaid} fully paid`, $color: `${theme.success}55`,
                valueColor: theme.success, delay: 0.10, sparkColor: theme.success,
              },
              {
                label: 'Outstanding Balance', value: fmt(stats.balance),
                sub: `${stats.cPartial} partial`, $color: `${theme.warning}55`,
                valueColor: theme.warning, delay: 0.15, sparkColor: theme.warning,
              },
              {
                label: 'Unpaid Orders', value: stats.cUnpaid,
                sub: 'need collection', $color: `${theme.danger}55`,
                valueColor: theme.danger, delay: 0.20, sparkColor: theme.danger,
              },
            ].map(({ label, value, sub, $color, valueColor, delay, sparkColor }) => (
              <StatCard
                key={label}
                $color={$color}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay }}
              >
                <StatLabel>{label}</StatLabel>
                <StatValue $color={valueColor}>{value}</StatValue>
                <StatSub>{sub}</StatSub>
                {sparkData.length >= 2 && (
                  <SparklineWrap>
                    <Sparkline data={sparkData} color={sparkColor} />
                  </SparklineWrap>
                )}
              </StatCard>
            ))}
          </StatsBar>

          {/* ── Bulk Action Panel ── */}
          <AnimatePresence>
            {filterMonth !== 'all' && (
              <BulkPanel
                theme={theme}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <BulkLabel theme={theme}>
                  <FaBolt />
                  Bulk apply to month
                  <BulkCount theme={theme}>{bulkMonthCount}</BulkCount>
                </BulkLabel>

                <BulkDivider theme={theme} />

                <BulkBtn
                  $bg={`${theme.success}22`} $color={theme.success} $border={`${theme.success}44`}
                  onClick={() => applyBulkStatus('paid')} disabled={bulkRunning} whileTap={{ scale: 0.96 }}
                  title="Mark all orders in this month as fully paid"
                >
                  <FaCheckCircle /> Mark All Paid
                </BulkBtn>

                <BulkBtn
                  $bg={`${theme.warning}22`} $color={theme.warning} $border={`${theme.warning}44`}
                  onClick={() => applyBulkStatus('partial')} disabled={bulkRunning} whileTap={{ scale: 0.96 }}
                  title="Mark all orders in this month as partial"
                >
                  <FaHourglassHalf /> Mark All Partial
                </BulkBtn>

                <BulkBtn
                  $bg={`${theme.danger}18`} $color={theme.danger} $border={`${theme.danger}33`}
                  onClick={() => applyBulkStatus('unpaid')} disabled={bulkRunning} whileTap={{ scale: 0.96 }}
                  title="Mark all orders in this month as unpaid"
                >
                  <FaTimesCircle /> Mark All Unpaid
                </BulkBtn>

                {/* ── NEW: Monthly Statement button in Bulk Panel ── */}
                <BulkDivider theme={theme} />
                <BulkBtn
                  $bg={`${theme.primary}18`} $color={theme.primary} $border={`${theme.primary}33`}
                  onClick={() => setMonthReceiptOpen(true)} disabled={bulkRunning} whileTap={{ scale: 0.96 }}
                  title="Preview & print monthly statement"
                >
                  <FaFileInvoiceDollar /> Monthly Statement
                </BulkBtn>

                {bulkProgress && (
                  <BulkProgress theme={theme}>
                    {bulkProgress.done} / {bulkProgress.total} updated…
                  </BulkProgress>
                )}
              </BulkPanel>
            )}
          </AnimatePresence>

          {/* ── Controls ── */}
          <Controls>
            <SearchBox theme={theme}>
              <FaSearch />
              <input
                ref={searchRef}
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search topic, ref, client…"
              />
            </SearchBox>

            <FilterSelect
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              theme={theme}
            >
              <option value="all">All Statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </FilterSelect>

            <FilterSelect
              value={filterMonth}
              onChange={e => { setFilterMonth(e.target.value); setCurrentPage(1); }}
              theme={theme}
            >
              <option value="all">All Months</option>
              {monthOptions.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </FilterSelect>

            <FilterSelect
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              theme={theme}
            >
              {[10, 15, 25, 50, 100].map(n => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </FilterSelect>

            {(search || filterStatus !== 'all' || filterMonth !== 'all') && (
              <ActionBtn
                $outline
                onClick={() => { setSearch(''); setFilterStatus('all'); setFilterMonth('all'); setCurrentPage(1); }}
                whileTap={{ scale: 0.96 }}
                theme={theme}
              >
                <FaTimes /> Clear Filters
              </ActionBtn>
            )}

            <ActionBtn $color={theme.warning} onClick={openCarryForward} whileTap={{ scale: 0.96 }} theme={theme}>
              <FaForward /> Carry Forward
            </ActionBtn>

            {/* ── NEW: Monthly Statement button in Controls (visible when month is selected) ── */}
            {filterMonth !== 'all' && (
              <ActionBtn
                $color={theme.primary}
                onClick={() => setMonthReceiptOpen(true)}
                whileTap={{ scale: 0.96 }}
                theme={theme}
                title="Preview & print monthly statement"
              >
                <FaCalendarAlt /> Monthly Statement
              </ActionBtn>
            )}

            {dirtyCount > 0 && (
              <ActionBtn $color={theme.success} onClick={saveAll} whileTap={{ scale: 0.96 }} theme={theme}>
                <FaSave /> Save All ({dirtyCount})
              </ActionBtn>
            )}

            <ActionBtn $outline onClick={fetchProjects} whileTap={{ scale: 0.96 }} theme={theme}>
              <FaSync /> Refresh
            </ActionBtn>
          </Controls>

          {/* ── Table ── */}
          <TableWrap theme={theme}>
            {loading ? (
              <EmptyState theme={theme}>
                <FaHourglassHalf />
                Loading payment data…
              </EmptyState>
            ) : totalItems === 0 ? (
              <EmptyState theme={theme}>
                <FaTimesCircle />
                No orders match your filters.
              </EmptyState>
            ) : (
              <>
                <Table>
                  <THead theme={theme}>
                    <tr>
                      {[
                        { label: 'Date',    col: 'orderDate'    },
                        { label: 'Ref',     col: 'orderRefCode' },
                        { label: 'Topic',   col: 'topic'        },
                        { label: 'Type',    col: 'orderType'    },
                        { label: 'Total',   col: 'amount'       },
                        { label: 'Paid',    col: 'amountPaid'   },
                        { label: 'Balance', col: 'balance'      },
                        { label: 'Status',  col: 'paymentStatus'},
                        { label: 'Actions', col: null           },
                      ].map(({ label, col }) => (
                        <th key={label} onClick={col ? () => handleSort(col) : undefined}
                          style={!col ? { cursor: 'default' } : {}}>
                          <ThInner>
                            {label}
                            {col && <SortIcon col={col} />}
                          </ThInner>
                        </th>
                      ))}
                    </tr>
                  </THead>

                  <tbody>
                    {pageItems.map((p, idx) => {
                      const globalIdx       = (safePage - 1) * itemsPerPage + idx;
                      const effStatus       = effectiveStatus(p);
                      const effBalance      = effectiveBalance(p);
                      const showPaidDivider = globalIdx === paidGlobalStart && effStatus === 'paid';
                      const ed              = getEdit(p);
                      const isSaving        = !!saving[p.id];
                      const isDirty         = !!editState[p.id];
                      const paid            = effStatus === 'paid';
                      const rowClass        =
                        paid ? 'paid-row' :
                        effStatus === 'partial' ? 'partial-row' : 'unpaid-row';

                      return (
                        <React.Fragment key={p.id}>
                          {showPaidDivider && (
                            <PaidSectionDivider theme={theme}>
                              <td colSpan={9}>
                                <FaCheckCircle style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                                Fully Paid Orders
                              </td>
                            </PaidSectionDivider>
                          )}
                          <TRow
                            $even={idx % 2 === 0}
                            $paid={paid}
                            className={rowClass}
                            theme={theme}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: paid ? 0.62 : 1, y: 0 }}
                            transition={{ duration: 0.2, delay: idx * 0.012 }}
                          >
                            {/* Date */}
                            <td style={{ whiteSpace: 'nowrap', color: theme.muted, fontSize: '0.78rem' }}>
                              {new Date(p.orderDate).toLocaleDateString('en-KE', {
                                day: '2-digit', month: 'short', year: 'numeric'
                              })}
                            </td>

                            {/* Ref */}
                            <td style={{ color: theme.primary, fontWeight: 600, fontSize: '0.78rem' }}>
                              {p.orderRefCode || '—'}
                            </td>

                            {/* Topic */}
                            <td style={{ maxWidth: '220px' }}>
                              <div style={{
                                overflow: 'hidden', textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap', maxWidth: '220px'
                              }} title={p.topic}>
                                {p.topic || '—'}
                              </div>
                              {p.isCarryForward && (
                                <div style={{ fontSize: '0.65rem', color: theme.warning, marginTop: '2px' }}>
                                  ↩ carried forward
                                </div>
                              )}
                            </td>

                            {/* Type */}
                            <td style={{ color: theme.muted, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                              {p.orderType || '—'}
                            </td>

                            {/* Total */}
                            <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {fmt(p.amount)}
                            </td>

                            {/* Amount Paid */}
                            <td>
                              {paid ? (
                                <span style={{ color: theme.success, fontWeight: 600 }}>
                                  {fmt(p.amountPaid)}
                                </span>
                              ) : (
                                <AmtInput
                                  type="number"
                                  min="0"
                                  step="100"
                                  value={ed.amountPaid}
                                  onChange={e => setEdit(p.id, { amountPaid: e.target.value })}
                                  theme={theme}
                                  disabled={isSaving}
                                />
                              )}
                            </td>

                            {/* Balance */}
                            <td style={{
                              color: effBalance > 0 ? theme.warning : theme.success,
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}>
                              {fmt(effBalance)}
                            </td>

                            {/* Status pill */}
                            <td>
                              <StatusPill $s={ed.status} theme={theme}>
                                {statusIcon(ed.status, theme)}
                                {ed.status}
                              </StatusPill>
                            </td>

                            {/* Actions */}
                            <td>
                              {paid ? (
                                <PayEditor>
                                  <MiniBtn
                                    $c={`${theme.danger}cc`}
                                    onClick={() => markUnpaid(p)}
                                    whileTap={{ scale: 0.95 }}
                                    title="Revert to unpaid"
                                  >
                                    <FaTimes /> Revert
                                  </MiniBtn>
                                  <MiniBtn
                                    $c={theme.primary}
                                    onClick={() => setReceiptProject(p)}
                                    whileTap={{ scale: 0.95 }}
                                    title="View & print receipt"
                                    style={{ background: `${theme.primary}22`, color: theme.primary, border: `1px solid ${theme.primary}44` }}
                                  >
                                    <FaFileInvoiceDollar />
                                  </MiniBtn>
                                </PayEditor>
                              ) : (
                                <PayEditor>
                                  <MiniBtn $c={theme.success} onClick={() => markFull(p)}    whileTap={{ scale: 0.95 }} disabled={isSaving} title="Mark fully paid"><FaCheck /></MiniBtn>
                                  <MiniBtn $c={theme.warning} onClick={() => markPartial(p)} whileTap={{ scale: 0.95 }} disabled={isSaving} title="Mark partial"><FaHourglassHalf /></MiniBtn>
                                  <MiniBtn $c={theme.danger}  onClick={() => markUnpaid(p)}  whileTap={{ scale: 0.95 }} disabled={isSaving} title="Mark unpaid"><FaTimes /></MiniBtn>
                                  {isDirty && (
                                    <MiniBtn $c={theme.primary} onClick={() => saveRow(p)} whileTap={{ scale: 0.95 }} disabled={isSaving}>
                                      {isSaving ? '…' : <><FaSave /> Save</>}
                                    </MiniBtn>
                                  )}
                                  <MiniBtn
                                    $c={theme.primary}
                                    onClick={() => setReceiptProject(p)}
                                    whileTap={{ scale: 0.95 }}
                                    title="View & print receipt"
                                    style={{ background: `${theme.primary}18`, color: theme.primary, border: `1px solid ${theme.primary}33` }}
                                  >
                                    <FaFileInvoiceDollar />
                                  </MiniBtn>
                                </PayEditor>
                              )}
                            </td>
                          </TRow>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </Table>

                {/* ── Pagination ── */}
                <Pagination theme={theme}>
                  <PageInfo theme={theme}>
                    Showing {Math.min((safePage - 1) * itemsPerPage + 1, totalItems)}–
                    {Math.min(safePage * itemsPerPage, totalItems)} of {totalItems} orders
                    &nbsp;·&nbsp;
                    <span style={{ color: theme.danger }}>
                      {processed.active.filter(p => effectiveStatus(p) === 'unpaid').length} unpaid
                    </span>
                    &nbsp;·&nbsp;
                    <span style={{ color: theme.warning }}>
                      {processed.active.filter(p => effectiveStatus(p) === 'partial').length} partial
                    </span>
                    &nbsp;·&nbsp;
                    <span style={{ color: theme.success }}>
                      {processed.paid.length} paid
                    </span>
                  </PageInfo>

                  <PageBtns>
                    <PageBtn onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1} theme={theme}>
                      <FaChevronLeft />
                    </PageBtn>

                    {pageNumbers.map((pg, i) =>
                      pg === '...'
                        ? <PageBtn key={`e-${i}`} disabled theme={theme} style={{ border: 'none', background: 'transparent' }}>…</PageBtn>
                        : <PageBtn key={pg} $active={pg === safePage} onClick={() => setCurrentPage(pg)} theme={theme}>{pg}</PageBtn>
                    )}

                    <PageBtn onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} theme={theme}>
                      <FaChevronRight />
                    </PageBtn>
                  </PageBtns>
                </Pagination>
              </>
            )}
          </TableWrap>
        </Inner>

        {/* ── Carry-forward Modal ── */}
        <AnimatePresence>
          {cfModal && (
            <Overlay
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !cfRunning && setCfModal(false)}
            >
              <Modal
                onClick={e => e.stopPropagation()}
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1,    opacity: 1 }}
                exit={{ scale: 0.92,    opacity: 0 }}
                theme={theme}
              >
                <ModalTitle theme={theme}>
                  <FaExclamationTriangle /> Carry Forward Balances
                </ModalTitle>
                <ModalBody theme={theme}>
                  The following orders have outstanding balances from previous months.
                  Carrying forward will create new unpaid entries dated to the current month.
                </ModalBody>

                {cfCandidates.length === 0 ? (
                  <ModalBody theme={theme} style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    ✅ No pending balances to carry forward.
                  </ModalBody>
                ) : (
                  <ModalList theme={theme}>
                    {cfCandidates.map(p => (
                      <li key={p.id}>
                        <span>{p.topic?.slice(0, 35) || p.orderRefCode || 'Unknown'}</span>
                        <span>{fmt(effectiveBalance(p))}</span>
                      </li>
                    ))}
                  </ModalList>
                )}

                <ModalActions>
                  <ActionBtn $outline onClick={() => setCfModal(false)} disabled={cfRunning} whileTap={{ scale: 0.96 }} theme={theme}>
                    Cancel
                  </ActionBtn>
                  {cfCandidates.length > 0 && (
                    <ActionBtn $color={theme.warning} onClick={runCarryForward} disabled={cfRunning} whileTap={{ scale: 0.96 }} theme={theme}>
                      {cfRunning ? 'Processing…' : `Carry Forward ${cfCandidates.length} Order(s)`}
                    </ActionBtn>
                  )}
                </ModalActions>
              </Modal>
            </Overlay>
          )}
        </AnimatePresence>

        {/* ── Monthly Statement Preview Modal (NEW) ── */}
        <AnimatePresence>
          {monthReceiptOpen && monthStats && (() => {
            const { monthOrders, totalInvoiced, totalReceived, totalOutstanding,
                    cPaid, cPartial, cUnpaid, collectionRate, monthLabel } = monthStats;
            const rc = rateColor(collectionRate);
            const bars = genBars(filterMonth);

            // Top 5 orders by amount for the preview table
            const previewOrders = [...monthOrders]
              .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
              .slice(0, 8);

            return (
              <ReceiptOverlay
                key="month-receipt-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMonthReceiptOpen(false)}
              >
                <MonthReceiptWrapper
                  initial={{ scale: 0.88, opacity: 0, y: 28 }}
                  animate={{ scale: 1,    opacity: 1, y: 0  }}
                  exit={{ scale: 0.88,    opacity: 0, y: 20 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                  onClick={e => e.stopPropagation()}
                >
                  <ReceiptPreviewLabel>Monthly Statement — Esc to close</ReceiptPreviewLabel>

                  <ReceiptCard>
                    <ReceiptTear />

                    <ReceiptBody style={{ padding: '1.4rem 1.6rem 1rem' }}>
                      {/* Header */}
                      <ReceiptHeaderSec>
                        <ReceiptLogoRow>
                          <ReceiptLogoIcon><FaCalendarAlt /></ReceiptLogoIcon>
                          <div>
                            <ReceiptBrandName>Monthly Statement</ReceiptBrandName>
                            <ReceiptSubBrand>Freelance Order System</ReceiptSubBrand>
                          </div>
                        </ReceiptLogoRow>
                        <div style={{
                          display: 'inline-block', marginTop: '0.55rem',
                          background: '#1a1a2e', color: '#fafaf8',
                          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.14em',
                          textTransform: 'uppercase', padding: '0.3rem 1.1rem',
                          borderRadius: '2px',
                        }}>
                          {monthLabel}
                        </div>
                      </ReceiptHeaderSec>

                      {/* Summary cards */}
                      <MonthSummaryGrid>
                        <MonthSummaryCard $bg="#f0ece3" $border="#ddd8ce">
                          <div style={{ fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', marginBottom: '0.18rem' }}>Total Invoiced</div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1c1c1c' }}>{fmt(totalInvoiced)}</div>
                          <div style={{ fontSize: '0.56rem', color: '#888', marginTop: '0.08rem' }}>{monthOrders.length} orders</div>
                        </MonthSummaryCard>
                        <MonthSummaryCard $bg="#d1fae5" $border="#86efac">
                          <div style={{ fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#166534', marginBottom: '0.18rem' }}>Received</div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1a6b3c' }}>{fmt(totalReceived)}</div>
                          <div style={{ fontSize: '0.56rem', color: '#166534', marginTop: '0.08rem' }}>{cPaid} fully paid</div>
                        </MonthSummaryCard>
                        <MonthSummaryCard
                          $bg={totalOutstanding > 0 ? '#fee2e2' : '#d1fae5'}
                          $border={totalOutstanding > 0 ? '#fca5a5' : '#86efac'}
                        >
                          <div style={{ fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: totalOutstanding > 0 ? '#991b1b' : '#166534', marginBottom: '0.18rem' }}>Outstanding</div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: totalOutstanding > 0 ? '#991b1b' : '#1a6b3c' }}>{fmt(totalOutstanding)}</div>
                          <div style={{ fontSize: '0.56rem', color: totalOutstanding > 0 ? '#991b1b' : '#166534', marginTop: '0.08rem' }}>{cUnpaid} unpaid, {cPartial} partial</div>
                        </MonthSummaryCard>
                      </MonthSummaryGrid>

                      {/* Collection rate */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#888', marginBottom: '0.25rem' }}>
                          <span>Collection Rate</span>
                          <span style={{ fontWeight: 700, color: rc }}>{collectionRate.toFixed(1)}%</span>
                        </div>
                        <MonthRateBarBg>
                          <MonthRateBarFill $pct={Math.min(100, collectionRate)} $c={rc} />
                        </MonthRateBarBg>
                      </div>

                      {/* Status pills */}
                      <MonthStatusPills>
                        <MonthStatusPill $bg="#d1fae5" $c="#1a6b3c" $border="#86efac">✓ {cPaid} Paid</MonthStatusPill>
                        <MonthStatusPill $bg="#fef3c7" $c="#b45309" $border="#fcd34d">◑ {cPartial} Partial</MonthStatusPill>
                        <MonthStatusPill $bg="#fee2e2" $c="#991b1b" $border="#fca5a5">✕ {cUnpaid} Unpaid</MonthStatusPill>
                      </MonthStatusPills>

                      {/* Order breakdown (preview, capped at 8) */}
                      <ReceiptSectionHead>
                        Order Breakdown {monthOrders.length > 8 ? `(top 8 of ${monthOrders.length})` : `(${monthOrders.length} orders)`}
                      </ReceiptSectionHead>

                      <MonthOrderTable>
                        <thead>
                          <tr>
                            <th style={{ width: '60px' }}>Date</th>
                            <th style={{ width: '80px' }}>Ref</th>
                            <th>Topic</th>
                            <th style={{ width: '110px', textAlign: 'right' }}>Invoiced</th>
                            <th style={{ width: '100px', textAlign: 'right' }}>Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewOrders.map((p, i) => {
                            const effS = effectiveStatus(p);
                            const bal  = effectiveBalance(p);
                            const statusC = effS === 'paid' ? '#1a6b3c' : effS === 'partial' ? '#b45309' : '#991b1b';
                            return (
                              <tr key={p.id} style={{ background: i % 2 === 0 ? '#fafaf8' : '#f5f2eb' }}>
                                <td style={{ color: '#888', fontSize: '0.62rem', whiteSpace: 'nowrap' }}>
                                  {p.orderDate ? new Date(p.orderDate).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }) : '—'}
                                </td>
                                <td style={{ color: '#1a6b3c', fontWeight: 700, fontSize: '0.62rem' }}>
                                  {p.orderRefCode || '—'}
                                </td>
                                <td style={{ fontSize: '0.62rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.topic || 'No topic'}
                                  {p.isCarryForward && <span style={{ fontSize: '0.55rem', color: '#92400e', background: '#fef3c7', padding: '0 3px', borderRadius: '3px', marginLeft: '3px' }}>CF</span>}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.62rem', whiteSpace: 'nowrap' }}>
                                  {fmt(p.amount)}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.62rem', color: statusC, whiteSpace: 'nowrap' }}>
                                  {effS === 'paid' ? '✓ Settled' : fmt(bal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </MonthOrderTable>

                      {/* Totals */}
                      <ReceiptDividerLine $dashed style={{ margin: '0.75rem 0 0.4rem' }} />
                      <ReceiptTotalRow $big>
                        <span className="tl">TOTAL INVOICED</span>
                        <span className="tr">{fmt(totalInvoiced)}</span>
                      </ReceiptTotalRow>
                      <ReceiptTotalRow $color="#166534">
                        <span className="tl">Total Received</span>
                        <span className="tr">{fmt(totalReceived)}</span>
                      </ReceiptTotalRow>
                      <ReceiptTotalRow $color={totalOutstanding > 0 ? '#991b1b' : '#166534'}>
                        <span className="tl">Outstanding Balance</span>
                        <span className="tr">{fmt(totalOutstanding)}</span>
                      </ReceiptTotalRow>

                      {/* Barcode */}
                      <ReceiptBarcodeRow>
                        {bars.map((b, i) => (
                          <div key={i} style={{ background: '#2a2a2a', width: `${b.w}px`, height: `${b.h}px`, flexShrink: 0 }} />
                        ))}
                      </ReceiptBarcodeRow>
                      <ReceiptRefCode>STMT · {filterMonth.replace('-', '/')} · {monthOrders.length} ORDERS</ReceiptRefCode>

                      <ReceiptFooter>
                        Generated: {new Date().toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}<br />
                        System-generated monthly statement — retain for your records.
                      </ReceiptFooter>
                    </ReceiptBody>

                    <ReceiptTear $bottom />
                  </ReceiptCard>

                  <ReceiptActionsBar>
                    <ReceiptActionBtn
                      $primary
                      onClick={() => { printMonthlyReceipt(filterMonth); }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <FaPrint /> Print / Save PDF
                    </ReceiptActionBtn>
                    <ReceiptActionBtn
                      onClick={() => setMonthReceiptOpen(false)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <FaTimes /> Close
                    </ReceiptActionBtn>
                  </ReceiptActionsBar>
                </MonthReceiptWrapper>
              </ReceiptOverlay>
            );
          })()}
        </AnimatePresence>

        {/* ── Receipt Preview Modal (single order) ── */}
        <AnimatePresence>
          {receiptProject && (() => {
            const p        = receiptProject;
            const statusS  = effectiveStatus(p);
            const totalAmt = Number(p.amount)    || 0;
            const paidAmt  = Number(p.amountPaid) || 0;
            const balAmt   = effectiveBalance(p);
            const stamp    = getStampProps(statusS);
            const bars     = genBars(p.id || p.orderRefCode || 'receipt');

            const words      = Number(p.words)      || 0;
            const cpp        = Number(p.cpp)         || 0;
            const codeAmt    = p.hasCode             ? (Number(p.codeAmount) || 0) : 0;
            const slideCount = Number(p.slideCount)  || 0;
            const writingAmt = words && cpp ? words * cpp : 0;

            const orderDateStr = p.orderDate
              ? new Date(p.orderDate).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })
              : '—';

            const hasBreakdown = writingAmt > 0 || codeAmt > 0 || (p.hasPresentation && slideCount > 0);

            return (
              <ReceiptOverlay
                key="receipt-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setReceiptProject(null)}
              >
                <ReceiptWrapper
                  initial={{ scale: 0.88, opacity: 0, y: 28 }}
                  animate={{ scale: 1,    opacity: 1, y: 0  }}
                  exit={{ scale: 0.88,    opacity: 0, y: 20 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                  onClick={e => e.stopPropagation()}
                >
                  <ReceiptPreviewLabel>Receipt Preview — Esc to close</ReceiptPreviewLabel>

                  <ReceiptCard>
                    <ReceiptTear />

                    <ReceiptBody>
                      <ReceiptHeaderSec>
                        <ReceiptLogoRow>
                          <ReceiptLogoIcon><FaMoneyBillWave /></ReceiptLogoIcon>
                          <div>
                            <ReceiptBrandName>Payment Receipt</ReceiptBrandName>
                            <ReceiptSubBrand>Freelance Order System</ReceiptSubBrand>
                          </div>
                        </ReceiptLogoRow>
                      </ReceiptHeaderSec>

                      <ReceiptMetaGrid>
                        <ReceiptMetaItem>
                          <span className="r-lbl">Receipt No.</span>
                          <span className="r-val">{p.orderRefCode || '—'}</span>
                        </ReceiptMetaItem>
                        <ReceiptMetaItem>
                          <span className="r-lbl">Order Date</span>
                          <span className="r-val">{orderDateStr}</span>
                        </ReceiptMetaItem>
                        <ReceiptMetaItem>
                          <span className="r-lbl">Order Type</span>
                          <span className="r-val">{p.orderType || '—'}</span>
                        </ReceiptMetaItem>
                        <ReceiptMetaItem>
                          <span className="r-lbl">Status</span>
                          <span className="r-val" style={{ color: stamp.c, textTransform: 'uppercase' }}>{statusS}</span>
                        </ReceiptMetaItem>
                      </ReceiptMetaGrid>

                      <ReceiptSectionHead>Order Details</ReceiptSectionHead>
                      <ReceiptTopicBlock>
                        {p.topic || 'No topic specified'}
                        {p.isCarryForward && (
                          <div style={{ fontSize: '0.62rem', color: '#92400e', marginTop: '0.3rem',
                            background: '#fef3c7', display: 'inline-block',
                            padding: '0.1rem 0.45rem', borderRadius: '10px', marginLeft: '0.3rem' }}>
                            ↩ Carried Forward
                          </div>
                        )}
                      </ReceiptTopicBlock>

                      <ReceiptSectionHead>Payment Breakdown</ReceiptSectionHead>

                      {hasBreakdown ? (
                        <>
                          {writingAmt > 0 && (
                            <ReceiptLineRow>
                              <span className="ll">{words.toLocaleString()} words × KES {cpp}/w</span>
                              <span className="lr">{fmt(writingAmt)}</span>
                            </ReceiptLineRow>
                          )}
                          {p.hasCode && codeAmt > 0 && (
                            <ReceiptLineRow>
                              <span className="ll">Code supplement</span>
                              <span className="lr">{fmt(codeAmt)}</span>
                            </ReceiptLineRow>
                          )}
                          {p.hasPresentation && slideCount > 0 && (
                            <ReceiptLineRow>
                              <span className="ll">Presentation — {slideCount} slide{slideCount !== 1 ? 's' : ''}</span>
                              <span className="lr">—</span>
                            </ReceiptLineRow>
                          )}
                        </>
                      ) : (
                        <ReceiptLineRow>
                          <span className="ll">Order Amount</span>
                          <span className="lr">{fmt(totalAmt)}</span>
                        </ReceiptLineRow>
                      )}

                      <ReceiptDividerLine $dashed />

                      <ReceiptTotalRow $big>
                        <span className="tl">TOTAL INVOICED</span>
                        <span className="tr">{fmt(totalAmt)}</span>
                      </ReceiptTotalRow>
                      <ReceiptTotalRow $color="#166534">
                        <span className="tl">Amount Paid</span>
                        <span className="tr">{fmt(paidAmt)}</span>
                      </ReceiptTotalRow>
                      <ReceiptTotalRow $color={balAmt > 0 ? '#991b1b' : '#166534'}>
                        <span className="tl">Outstanding Balance</span>
                        <span className="tr">{fmt(balAmt)}</span>
                      </ReceiptTotalRow>

                      <ReceiptStampArea>
                        <ReceiptStamp $c={stamp.c} $bg={stamp.bg}>
                          {stamp.mark}&nbsp; {stamp.text}
                        </ReceiptStamp>
                      </ReceiptStampArea>

                      <ReceiptBarcodeRow>
                        {bars.map((b, i) => (
                          <div key={i} style={{ background: '#2a2a2a', width: `${b.w}px`, height: `${b.h}px`, flexShrink: 0 }} />
                        ))}
                      </ReceiptBarcodeRow>
                      <ReceiptRefCode>{(p.orderRefCode || p.id || '').toUpperCase()}</ReceiptRefCode>

                      <ReceiptFooter>
                        {p.lastUpdated && (
                          <>Last updated: {new Date(p.lastUpdated).toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}<br /></>
                        )}
                        Generated: {new Date().toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}<br />
                        System-generated receipt — retain for your records.
                      </ReceiptFooter>
                    </ReceiptBody>

                    <ReceiptTear $bottom />
                  </ReceiptCard>

                  <ReceiptActionsBar>
                    <ReceiptActionBtn
                      $primary
                      onClick={() => printReceiptToWindow(p)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <FaPrint /> Print / Save PDF
                    </ReceiptActionBtn>
                    <ReceiptActionBtn
                      onClick={() => setReceiptProject(null)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <FaTimes /> Close
                    </ReceiptActionBtn>
                  </ReceiptActionsBar>
                </ReceiptWrapper>
              </ReceiptOverlay>
            );
          })()}
        </AnimatePresence>

        {/* ── Toast ── */}
        <AnimatePresence>
          {toast && (
            <Toast
              $type={toast.type}
              theme={theme}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {toast.type === 'success' ? <FaCheckCircle color={theme.success} /> :
               toast.type === 'warn'    ? <FaExclamationTriangle color={theme.warning} /> :
                                          <FaTimesCircle color={theme.danger} />}
              {toast.msg}
            </Toast>
          )}
        </AnimatePresence>
      </Page>
    </ThemeProvider>
  );
}