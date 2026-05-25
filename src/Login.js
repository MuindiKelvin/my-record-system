import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import logo from './logo/logo.png';
import { motion, AnimatePresence } from 'framer-motion';
import styled, { createGlobalStyle } from 'styled-components';

/* Panel themes  */
const PANEL_THEMES = [
  {
    bg:         '#050a14',
    grid:       'rgba(0,200,255,.055)',
    orb1:       'radial-gradient(circle,rgba(0,80,255,.38),transparent)',
    orb2:       'radial-gradient(circle,rgba(0,200,255,.22),transparent)',
    orb3:       'radial-gradient(circle,rgba(120,0,255,.2),transparent)',
    accent:     '#00c8ff',
    accentRgb:  '0,200,255',
    accent2:    '#7c6fff',
    eyebrow:    'rgba(0,200,255,.6)',
    eyebrowText:'Freelance · Organized · Paid',
    heroSpan:   '#00c8ff',
    node1:      'rgba(0,200,255,0.4)',
    node1Fill:  'rgba(0,200,255,0.08)',
    node1Text:  '#00c8ff',
    node2:      'rgba(124,111,255,0.4)',
    node2Fill:  'rgba(124,111,255,0.08)',
    node2Text:  '#a78bfa',
    node3:      'rgba(245,158,11,0.4)',
    node3Fill:  'rgba(245,158,11,0.08)',
    node3Text:  '#f59e0b',
  },
  {
    bg:         '#0d0520',
    grid:       'rgba(159,122,234,.055)',
    orb1:       'radial-gradient(circle,rgba(120,0,200,.40),transparent)',
    orb2:       'radial-gradient(circle,rgba(237,100,166,.24),transparent)',
    orb3:       'radial-gradient(circle,rgba(245,158,11,.22),transparent)',
    accent:     '#a78bfa',
    accentRgb:  '167,139,250',
    accent2:    '#ed64a6',
    eyebrow:    'rgba(167,139,250,.6)',
    eyebrowText:'Write · Earn · Repeat',
    heroSpan:   '#a78bfa',
    node1:      'rgba(167,139,250,0.5)',
    node1Fill:  'rgba(167,139,250,0.1)',
    node1Text:  '#a78bfa',
    node2:      'rgba(237,100,166,0.5)',
    node2Fill:  'rgba(237,100,166,0.1)',
    node2Text:  '#ed64a6',
    node3:      'rgba(245,158,11,0.5)',
    node3Fill:  'rgba(245,158,11,0.1)',
    node3Text:  '#f59e0b',
  },
  {
    bg:         '#041610',
    grid:       'rgba(72,187,120,.055)',
    orb1:       'radial-gradient(circle,rgba(0,100,60,.40),transparent)',
    orb2:       'radial-gradient(circle,rgba(72,187,120,.24),transparent)',
    orb3:       'radial-gradient(circle,rgba(0,180,180,.22),transparent)',
    accent:     '#48bb78',
    accentRgb:  '72,187,120',
    accent2:    '#38b2ac',
    eyebrow:    'rgba(72,187,120,.6)',
    eyebrowText:'Track · Invoice · Collect',
    heroSpan:   '#48bb78',
    node1:      'rgba(72,187,120,0.5)',
    node1Fill:  'rgba(72,187,120,0.1)',
    node1Text:  '#48bb78',
    node2:      'rgba(56,178,172,0.5)',
    node2Fill:  'rgba(56,178,172,0.1)',
    node2Text:  '#38b2ac',
    node3:      'rgba(245,158,11,0.5)',
    node3Fill:  'rgba(245,158,11,0.1)',
    node3Text:  '#f59e0b',
  },
];

/* Global CSS  */
const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; }

  @keyframes orb-drift {
    0%,100% { transform: translate(0,0); }
    40%      { transform: translate(14px,-20px); }
    70%      { transform: translate(-10px,12px); }
  }
  @keyframes btn-shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }
  @keyframes dot-blink {
    0%,100% { opacity:1; } 50% { opacity:0; }
  }
  @keyframes node-pop {
    from { opacity:0; transform: scale(0.4); }
    to   { opacity:1; transform: scale(1); }
  }
  @keyframes check-pop {
    from { opacity:0; transform: scale(0.3); }
    to   { opacity:1; transform: scale(1); }
  }
  @keyframes ring-pulse {
    0%   { transform: scale(0.75); opacity: 0.75; }
    100% { transform: scale(2.7);  opacity: 0; }
  }
  @keyframes sparkline-draw {
    from { stroke-dashoffset: 520; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes area-glow {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes tick-pop {
    from { opacity: 0; transform: scaleY(0); }
    to   { opacity: 1; transform: scaleY(1); }
  }
  @keyframes badge-float {
    0%,100% { transform: translateY(0px); }
    50%      { transform: translateY(-5px); }
  }

  .orb { border-radius:50%; filter:blur(90px); animation: orb-drift 10s ease-in-out infinite; }
  .orb-a { animation-duration:12s; }
  .orb-b { animation-duration:9s;  animation-delay:3s; }
  .orb-c { animation-duration:15s; animation-delay:1.5s; }

  .secure-dot::before {
    content:''; display:inline-block;
    width:6px; height:6px; border-radius:50%; background:#16b364;
    animation: dot-blink 2s ease-in-out infinite;
    margin-right:.4rem;
  }

  .node-1 { animation: node-pop 0.4s ease 0.3s both; }
  .node-2 { animation: node-pop 0.4s ease 0.6s both; }
  .node-3 { animation: node-pop 0.4s ease 0.9s both; }
  .check  { animation: check-pop 0.35s ease 1.1s both; }

  .ring-pulse {
    transform-box: fill-box;
    transform-origin: center;
    animation: ring-pulse 2.9s ease-out infinite;
  }
  .ring-1 { animation-delay: 0s; }
  .ring-2 { animation-delay: 1s; }
  .ring-3 { animation-delay: 2s; }

  .sparkline-path {
    stroke-dasharray: 520;
    stroke-dashoffset: 520;
    animation: sparkline-draw 1.5s ease 1.3s both;
  }
  .sparkline-area { animation: area-glow 1s ease 1.6s both; }

  .tick { transform-origin: bottom; }
  .tick-1 { animation: tick-pop 0.35s ease 1.4s both; }
  .tick-2 { animation: tick-pop 0.35s ease 1.52s both; }
  .tick-3 { animation: tick-pop 0.35s ease 1.64s both; }
  .tick-4 { animation: tick-pop 0.35s ease 1.76s both; }
  .tick-5 { animation: tick-pop 0.35s ease 1.88s both; }
  .tick-6 { animation: tick-pop 0.35s ease 2.0s both; }

  .badge-float { animation: badge-float 3.2s ease-in-out infinite; }

  .btn-shimmer::after {
    content:''; position:absolute; inset:0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent);
    background-size: 400px 100%;
    animation: btn-shimmer 2.2s infinite;
  }
`;

/* Layout  */
const Shell = styled.div`
  height:100vh; display:grid; grid-template-columns:1fr 1fr; overflow:hidden;
  @media(max-width:768px){ grid-template-columns:1fr; }
`;

/* LEFT dark panel */
const LeftPanel = styled.div`
  position:relative;
  background: ${p => p.$bg || '#050a14'};
  transition: background 1.8s ease;
  display:flex; flex-direction:column; justify-content:flex-start;
  padding:3.5rem; overflow:hidden;
`;
const GridBg = styled.div`
  position:absolute; inset:0;
  background-image:
    linear-gradient(${p => p.$grid || 'rgba(0,200,255,.055)'} 1px, transparent 1px),
    linear-gradient(90deg, ${p => p.$grid || 'rgba(0,200,255,.055)'} 1px, transparent 1px);
  background-size:44px 44px;
`;
const Orb     = styled.div`position:absolute; transition: background 1.8s ease;`;
const TopText = styled(motion.div)`position:relative; z-index:2;`;
const Eyebrow = styled.p`
  font-family:'Syne',sans-serif; font-size:.68rem; font-weight:700;
  letter-spacing:.22em; text-transform:uppercase; margin-bottom:.9rem;
  transition: color 1.8s ease;
`;
const HeroH = styled.h1`
  font-family:'Syne',sans-serif; font-size:clamp(2rem,3.2vw,2.9rem);
  font-weight:800; line-height:1.1; color:#fff; margin-bottom:1rem;
`;
const HeroP = styled.p`
  font-size:.88rem; font-weight:300; line-height:1.7;
  color:rgba(255,255,255,.38); max-width:300px;
`;
const IlloWrap = styled(motion.div)`
  position:absolute; bottom:0; left:0; right:0; z-index:2;
  filter:drop-shadow(0 20px 50px rgba(0,140,255,.2));
`;
const ThemeDots = styled.div`
  position:absolute; bottom:2.6rem; right:2.4rem; z-index:10;
  display:flex; gap:6px; align-items:center;
`;
const ThemePill = styled.div`
  height:5px;
  width: ${p => p.$active ? '20px' : '5px'};
  border-radius:3px;
  background: ${p => p.$active ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.2)'};
  transition: all .55s cubic-bezier(.4,0,.2,1);
`;

/* RIGHT form */
const RightPanel  = styled.div`
  background:#f8f9fc; display:flex; flex-direction:column; justify-content:center;
  padding:3.5rem clamp(2rem,5vw,5rem); position:relative; overflow-y:auto;
`;
const SecureBadge = styled.div`
  position:absolute; top:1.8rem; right:2rem;
  display:flex; align-items:center;
  font-size:.63rem; font-weight:700; letter-spacing:.16em; text-transform:uppercase;
  color:#16b364; background:rgba(22,179,100,.08); border:1px solid rgba(22,179,100,.25);
  border-radius:20px; padding:.3rem .8rem;
`;

/* Updated BrandRow — centered */
const BrandRow  = styled.div`
  display:flex; align-items:center; justify-content:center;
  gap:.7rem; margin-bottom:1.2rem;
`;
const LogoImg   = styled.img`width:80px; height:80px; border-radius:16px; object-fit:cover;`;
const BrandName = styled.span`
  font-family:'Syne',sans-serif; font-size:.7rem; font-weight:700;
  letter-spacing:.18em; text-transform:uppercase; color:#1a1a2e;
`;
const FormH   = styled.h2`
  font-family:'Syne',sans-serif; font-size:clamp(1.55rem,2.3vw,2rem);
  font-weight:800; color:#0d0d1a; margin-bottom:.45rem; text-align:center;
`;
const FormSub = styled.p`font-size:.87rem; font-weight:300; color:#7a7a9a; margin-bottom:1.8rem; text-align:center;`;
const FGroup  = styled.div`display:flex; flex-direction:column; gap:1rem; margin-bottom:1.5rem;`;
const FL      = styled.label`
  font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
  color:#3a3a5a; margin-bottom:.35rem; display:block;
`;
const FW      = styled.div`position:relative;`;
const FIcon   = styled.span`
  position:absolute; left:1rem; top:50%; transform:translateY(-50%);
  color:#aab; font-size:.88rem; pointer-events:none;
`;
const Input   = styled.input`
  width:100%; padding:.82rem 1rem .82rem 2.5rem;
  border:1.5px solid ${p => p.$f ? '#1a1aff' : '#e0e0f0'};
  border-radius:10px; font-family:'DM Sans',sans-serif; font-size:.88rem;
  color:#0d0d1a; background:${p => p.$f ? '#fff' : '#f3f4fb'};
  transition:all .2s; outline:none;
  box-shadow:${p => p.$f ? '0 0 0 3px rgba(26,26,255,.1)' : 'none'};
  &::placeholder { color:#bbbbd0; }
`;
const ErrBox  = styled(motion.div)`
  background:rgba(255,50,50,.07); border:1px solid rgba(255,50,50,.2);
  border-radius:8px; padding:.6rem 1rem; font-size:.81rem; color:#d63030; margin-bottom:1.1rem;
`;
const Btn     = styled(motion.button)`
  width:100%; padding:.92rem; border:none; border-radius:10px;
  background:linear-gradient(135deg,#1a1aff 0%,#0099ff 100%);
  color:#fff; font-family:'Syne',sans-serif; font-size:.83rem; font-weight:700;
  letter-spacing:.1em; text-transform:uppercase; cursor:pointer;
  display:flex; align-items:center; justify-content:center; gap:.5rem;
  position:relative; overflow:hidden;
  &:disabled { opacity:.7; cursor:not-allowed; }
`;
const Divider = styled.div`
  display:flex; align-items:center; gap:1rem; margin:1.3rem 0;
  color:#ccc; font-size:.76rem; font-weight:300; letter-spacing:.08em;
  &::before,&::after { content:''; flex:1; height:1px; background:#e4e4f0; }
`;
const Foot    = styled.p`
  text-align:center; font-size:.83rem; color:#888;
  a { color:#1a1aff; font-weight:600; text-decoration:none; &:hover{text-decoration:underline;} }
`;
const Copyright = styled.p`
  position:absolute; bottom:1.4rem; left:0; right:0;
  text-align:center; font-size:.65rem; color:#bbbbd0; letter-spacing:.06em;
  a { color:#aab; text-decoration:none; &:hover{ color:#1a1aff; text-decoration:underline; } }
`;

/* Mini bar tick heights */
const TICKS = [
  { h:22, x:18 },
  { h:34, x:34 },
  { h:18, x:50 },
  { h:40, x:66 },
  { h:28, x:82 },
  { h:46, x:98 },
];

/* Themed Onboarding Illustration */
const OnboardIllo = ({
  accent, accentRgb, accent2,
  node1, node1Fill, node1Text,
  node2, node2Fill, node2Text,
  node3, node3Fill, node3Text,
  themeIdx,
}) => (
  <IlloWrap
    initial={{ opacity:0, y:28 }}
    animate={{ opacity:1, y:0 }}
    transition={{ duration:.8, delay:.4 }}
  >
    <AnimatePresence mode="wait">
      <motion.div
        key={themeIdx}
        initial={{ opacity:0 }}
        animate={{ opacity:1 }}
        exit={{ opacity:0 }}
        transition={{ duration:.7 }}
        style={{ display:'block' }}
      >
        <svg viewBox="0 0 460 300" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ width:'100%', maxWidth:'none', display:'block' }}>

          <defs>
            <linearGradient id={`sparkGrad_L${themeIdx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={`rgba(${accentRgb},0.16)`}/>
              <stop offset="100%" stopColor={`rgba(${accentRgb},0)`}/>
            </linearGradient>
            <clipPath id={`cardClip_L${themeIdx}`}>
              <rect x="0" y="0" width="460" height="300" rx="14"/>
            </clipPath>
            <radialGradient id={`nodeGlow_L${themeIdx}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={`rgba(${accentRgb},0.18)`}/>
              <stop offset="100%" stopColor={`rgba(${accentRgb},0)`}/>
            </radialGradient>
          </defs>

          {/* Background sparkline */}
          <g clipPath={`url(#cardClip_L${themeIdx})`}>
            <path
              d="M0 300 L40 278 L80 285 L125 262 L170 245 L218 224 L265 204 L310 182 L355 158 L400 134 L445 110 L460 102 L460 300 Z"
              fill={`url(#sparkGrad_L${themeIdx})`}
              className="sparkline-area"
            />
            <path
              d="M0 300 L40 278 L80 285 L125 262 L170 245 L218 224 L265 204 L310 182 L355 158 L400 134 L445 110 L460 102"
              stroke={`rgba(${accentRgb},0.18)`} strokeWidth="1.8" fill="none"
              strokeLinecap="round" strokeLinejoin="round"
              className="sparkline-path"
            />
          </g>

          {/* Outer card */}
          <rect x="1" y="1" width="458" height="298" rx="14"
            fill="rgba(255,255,255,0.028)" stroke={`rgba(${accentRgb},0.12)`} strokeWidth="1"/>

          {/* Connector path */}
          <path d="M80 72 Q80 94 160 94 Q240 94 240 140 Q240 184 320 184 Q390 184 390 224"
            stroke={`rgba(${accentRgb},0.2)`} strokeWidth="1.5" strokeDasharray="5 4"/>

          {/* Pulse rings */}
          <circle cx="80"  cy="64"  r="46" className="ring-pulse ring-1" fill="none" stroke={node1} strokeWidth="1.5"/>
          <circle cx="240" cy="156" r="46" className="ring-pulse ring-2" fill="none" stroke={node2} strokeWidth="1.5"/>
          <circle cx="390" cy="240" r="46" className="ring-pulse ring-3" fill="none" stroke={node3} strokeWidth="1.5"/>

          {/* Glow haloes */}
          <ellipse cx="80"  cy="64"  rx="60" ry="60" fill={`url(#nodeGlow_L${themeIdx})`}/>
          <ellipse cx="240" cy="156" rx="60" ry="60" fill={`url(#nodeGlow_L${themeIdx})`}/>
          <ellipse cx="390" cy="240" rx="60" ry="60" fill={`url(#nodeGlow_L${themeIdx})`}/>

          {/* Node 1 */}
          <circle cx="80" cy="64" r="30" className="node-1" fill={node1Fill} stroke={node1} strokeWidth="1.5"/>
          <text x="80" y="60" textAnchor="middle" fill={node1Text} fontSize="10" fontFamily="sans-serif" fontWeight="700">01</text>
          <text x="80" y="74" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7.5" fontFamily="sans-serif">Sign in</text>

          {/* Node 1 card */}
          <rect x="124" y="30" width="140" height="72" rx="9"
            fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
          <text x="136" y="48" fill="rgba(255,255,255,0.3)" fontSize="7.5" fontFamily="sans-serif">Email</text>
          <rect x="136" y="53" width="116" height="11" rx="4" fill="rgba(255,255,255,0.06)"/>
          <rect x="136" y="53" width="64"  height="11" rx="4" fill={`rgba(${accentRgb},0.18)`}/>
          <text x="136" y="76" fill="rgba(255,255,255,0.3)" fontSize="7.5" fontFamily="sans-serif">Password</text>
          <rect x="136" y="81" width="116" height="11" rx="4" fill="rgba(255,255,255,0.06)"/>
          <text x="138" y="89" fill="rgba(255,255,255,0.22)" fontSize="7" fontFamily="monospace">••••••••</text>

          {/* Checkmark badge */}
          <circle cx="258" cy="30" r="11" className="check" fill="#16b364"/>
          <path d="M252 30 L256 34 L264 25" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

          {/* Node 2 */}
          <circle cx="240" cy="156" r="30" className="node-2" fill={node2Fill} stroke={node2} strokeWidth="1.5"/>
          <text x="240" y="152" textAnchor="middle" fill={node2Text} fontSize="10" fontFamily="sans-serif" fontWeight="700">02</text>
          <text x="240" y="166" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7.5" fontFamily="sans-serif">Manage</text>

          {/* Node 2 card */}
          <rect x="282" y="122" width="152" height="68" rx="9"
            fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
          <text x="294" y="140" fill="rgba(255,255,255,0.3)" fontSize="7.5" fontFamily="sans-serif">Active projects</text>
          {[['Orders', accent, true],['Invoices','rgba(255,255,255,0.12)',false],['Payments','rgba(255,255,255,0.12)',false]].map(([t, bg, active], i) => (
            <g key={i}>
              <rect x={294+i*47} y="146" width="43" height="15" rx="7" fill={bg}/>
              <text x={315+i*47} y="156.5" textAnchor="middle"
                fill={active ? '#050a14' : 'rgba(255,255,255,0.4)'}
                fontSize="6.5" fontFamily="sans-serif">{t}</text>
            </g>
          ))}
          <text x="294" y="176" fill="rgba(255,255,255,0.3)" fontSize="7.5" fontFamily="sans-serif">Completion rate</text>
          <rect x="294" y="181" width="130" height="5" rx="2.5" fill="rgba(255,255,255,0.08)"/>
          <rect x="294" y="181" width="90"  height="5" rx="2.5" fill={`rgba(${accentRgb},0.5)`}/>

          {/* Node 3 */}
          <circle cx="390" cy="240" r="30" className="node-3" fill={node3Fill} stroke={node3} strokeWidth="1.5"/>
          <text x="390" y="236" textAnchor="middle" fill={node3Text} fontSize="10" fontFamily="sans-serif" fontWeight="700">03</text>
          <text x="390" y="250" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7.5" fontFamily="sans-serif">Get paid</text>

          {/* Node 3 card */}
          <rect x="16" y="208" width="148" height="76" rx="9"
            fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
          <text x="28" y="224" fill="rgba(255,255,255,0.28)" fontSize="7" fontFamily="monospace">invoice_may_2026.xlsx</text>
          {[0,1,2,3].map(i => (
            <g key={i}>
              <rect x="28" y={230+i*12} width="124" height="10" rx="2.5"
                fill={i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent'}/>
              <rect x="30" y={232+i*12} width={40+i*8} height="5" rx="2" fill="rgba(255,255,255,0.1)"/>
              <rect x="118" y={232+i*12} width="28" height="5" rx="2"
                fill={i===0 ? `rgba(${accentRgb},0.55)` : i===2 ? 'rgba(245,158,11,0.45)' : 'rgba(22,179,100,0.45)'}/>
            </g>
          ))}
          <rect x="118" y="273" width="36" height="10" rx="3" fill="#16b364"/>
          <text x="136" y="280" textAnchor="middle" fill="white" fontSize="7" fontWeight="700" fontFamily="monospace">XLSX</text>

          {/* Floating earnings badge */}
          <g className="badge-float">
            <rect x="170" y="212" width="72" height="30" rx="7"
              fill="rgba(22,179,100,0.12)" stroke="rgba(22,179,100,0.3)" strokeWidth="1"/>
            <text x="182" y="224" fill="rgba(255,255,255,0.35)" fontSize="6.5" fontFamily="sans-serif">This month</text>
            <text x="182" y="236" fill="#16b364" fontSize="9" fontWeight="700" fontFamily="monospace">+Ksh 12k</text>
            <polyline points="247,234 251,228 255,231 259,224 263,220 267,217 271,213"
              stroke="#16b364" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </g>

          {/* Mini bar chart strip */}
          <g>
            <text x="310" y="200" fill="rgba(255,255,255,0.15)" fontSize="6.5" fontFamily="monospace" letterSpacing="1">WEEKLY</text>
            {TICKS.map(({ h, x }, i) => (
              <rect
                key={i}
                x={310 + x} y={265 - h} width="10" height={h} rx="2"
                fill={i % 2 === 1 ? accent : `rgba(${accentRgb},0.45)`}
                className={`tick tick-${i+1}`}
              />
            ))}
            <line x1="310" y1="265" x2="428" y2="265" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
          </g>

          {/* Bottom tagline */}
          <text x="229" y="293" textAnchor="middle"
            fill="rgba(255,255,255,0.13)" fontSize="8" fontFamily="sans-serif" letterSpacing="3">
            SIGN IN · TRACK · COLLECT
          </text>

        </svg>
      </motion.div>
    </AnimatePresence>
  </IlloWrap>
);

/* Component  */
const Login = () => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [focus,    setFocus]    = useState(null);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [themeIdx, setThemeIdx] = useState(0);
  const navigate = useNavigate();

  const pt = PANEL_THEMES[themeIdx];

  useEffect(() => {
    const t = setInterval(() => setThemeIdx(i => (i + 1) % PANEL_THEMES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!email || !password) throw new Error('Please fill in all fields');
      if (!/\S+@\S+\.\S+/.test(email)) throw new Error('Invalid email format');
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/projects', { state: { welcomeAnimation: true } });
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <GlobalStyle />
      <Shell>

        {/* LEFT dark panel */}
        <LeftPanel $bg={pt.bg}>
          <GridBg $grid={pt.grid} />

          <Orb className="orb orb-a" style={{ width:360, height:360, background:pt.orb1, top:'-8%',  left:'-10%' }}/>
          <Orb className="orb orb-b" style={{ width:200, height:200, background:pt.orb2, bottom:'18%', right:'2%' }}/>
          <Orb className="orb orb-c" style={{ width:140, height:140, background:pt.orb3, top:'42%',  left:'54%' }}/>

          <TopText
            initial={{ opacity:0, y:26 }}
            animate={{ opacity:1, y:0 }}
            transition={{ duration:.65, delay:.15 }}
          >
            <Eyebrow style={{ color: pt.eyebrow }}>{pt.eyebrowText}</Eyebrow>
            <HeroH>
              Write. Invoice.<br/>
              Get paid{' '}
              <span style={{ color: pt.heroSpan, transition: 'color 1.8s ease' }}>on repeat.</span>
            </HeroH>
            <HeroP>No more spreadsheet guesswork. Track word counts, CPP rates, and carry-forwards the moment a new order lands.</HeroP>
          </TopText>

          <ThemeDots>
            {PANEL_THEMES.map((_, i) => (
              <ThemePill key={i} $active={i === themeIdx} />
            ))}
          </ThemeDots>

          <OnboardIllo
            accent={pt.accent}
            accentRgb={pt.accentRgb}
            accent2={pt.accent2}
            node1={pt.node1}     node1Fill={pt.node1Fill} node1Text={pt.node1Text}
            node2={pt.node2}     node2Fill={pt.node2Fill} node2Text={pt.node2Text}
            node3={pt.node3}     node3Fill={pt.node3Fill} node3Text={pt.node3Text}
            themeIdx={themeIdx}
          />
        </LeftPanel>

        {/* RIGHT form */}
        <RightPanel>
          <SecureBadge><span className="secure-dot" />Secure</SecureBadge>

          <motion.div
            initial={{ opacity:0, x:22 }}
            animate={{ opacity:1, x:0 }}
            transition={{ duration:.5, ease:'easeOut' }}
          >
            {/* Logo centered above heading */}
            <BrandRow>
              <LogoImg src={logo} alt="Logo" />
            </BrandRow>

            {/* Heading & subtitle */}
            <FormH>Welcome back</FormH>
            <FormSub>Sign in to manage your projects and track payments.</FormSub>

            <form onSubmit={handleLogin}>
              <FGroup>
                <div>
                  <FL htmlFor="email">Email address</FL>
                  <FW>
                    <FIcon>✉</FIcon>
                    <Input id="email" type="email" placeholder="you@example.com"
                      value={email} $f={focus==='email'}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setFocus('email')} onBlur={() => setFocus(null)}/>
                  </FW>
                </div>
                <div>
                  <FL htmlFor="password">Password</FL>
                  <FW>
                    <FIcon>🔒</FIcon>
                    <Input id="password" type="password" placeholder="••••••••"
                      value={password} $f={focus==='password'}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocus('password')} onBlur={() => setFocus(null)}/>
                  </FW>
                </div>
              </FGroup>

              <AnimatePresence>
                {error && (
                  <ErrBox initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                    {error}
                  </ErrBox>
                )}
              </AnimatePresence>

              <Btn type="submit" disabled={loading} className="btn-shimmer"
                whileHover={{ scale:1.02 }} whileTap={{ scale:.98 }}>
                {loading ? 'Signing In…' : 'Sign In →'}
              </Btn>
            </form>

            <Divider>or</Divider>
            <Foot>New here? <a href="/register">Create an account</a></Foot>
          </motion.div>

          <Copyright>
            © {new Date().getFullYear()} Kelvin Muindi &nbsp;·&nbsp;{' '}
            <a href="https://muindikelvin.github.io" target="_blank" rel="noopener noreferrer">
              muindikelvin.github.io
            </a>
          </Copyright>
        </RightPanel>

      </Shell>
    </>
  );
};

export default Login;