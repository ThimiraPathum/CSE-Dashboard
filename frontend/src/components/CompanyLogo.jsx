/**
 * CompanyLogo Component
 * Locally bundled official CSE issuer logos with readable symbol fallbacks.
 */

import { useState } from 'react';
import logoManifest from '../assets/company-logos/manifest.json';

// Vite bundles these as same-origin assets, including in the FastAPI build.
const logoAssets = import.meta.glob('../assets/company-logos/*.{png,jpg,webp,gif}', {
  eager: true, query: '?url', import: 'default',
});

export const normalizeSymbol = (symbol) => String(symbol || '').trim().toUpperCase().replace(/\.[NXUP]\d+(?:\.CM)?$|\.CM$/g, '');

// Curated brand color palettes for prominent CSE blue chips
const BRAND_PALETTES = {
  JKH: { bg: 'linear-gradient(135deg, #1e3a8a, #0284c7)', color: '#ffffff', border: 'rgba(56, 189, 248, 0.4)' },
  COMB: { bg: 'linear-gradient(135deg, #0369a1, #f97316)', color: '#ffffff', border: 'rgba(249, 115, 22, 0.4)' },
  HNB: { bg: 'linear-gradient(135deg, #991b1b, #d97706)', color: '#ffffff', border: 'rgba(217, 119, 6, 0.4)' },
  SAMP: { bg: 'linear-gradient(135deg, #ea580c, #f59e0b)', color: '#ffffff', border: 'rgba(245, 158, 11, 0.4)' },
  DIAL: { bg: 'linear-gradient(135deg, #dc2626, #2563eb)', color: '#ffffff', border: 'rgba(220, 38, 38, 0.4)' },
  CTC: { bg: 'linear-gradient(135deg, #78350f, #d97706)', color: '#ffffff', border: 'rgba(217, 119, 6, 0.4)' },
  CARG: { bg: 'linear-gradient(135deg, #b91c1c, #ef4444)', color: '#ffffff', border: 'rgba(239, 68, 68, 0.4)' },
  DIPD: { bg: 'linear-gradient(135deg, #065f46, #059669)', color: '#ffffff', border: 'rgba(16, 185, 129, 0.4)' },
  TKYO: { bg: 'linear-gradient(135deg, #374151, #dc2626)', color: '#ffffff', border: 'rgba(220, 38, 38, 0.4)' },
  HAYL: { bg: 'linear-gradient(135deg, #047857, #10b981)', color: '#ffffff', border: 'rgba(52, 211, 153, 0.4)' },
  EXPO: { bg: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: '#ffffff', border: 'rgba(96, 165, 250, 0.4)' },
  LOLC: { bg: 'linear-gradient(135deg, #6d28d9, #8b5cf6)', color: '#ffffff', border: 'rgba(167, 139, 250, 0.4)' },
  DIST: { bg: 'linear-gradient(135deg, #831843, #be185d)', color: '#ffffff', border: 'rgba(244, 114, 182, 0.4)' },
  AITK: { bg: 'linear-gradient(135deg, #0f766e, #14b8a6)', color: '#ffffff', border: 'rgba(45, 212, 191, 0.4)' },
  RCL: { bg: 'linear-gradient(135deg, #c2410c, #ea580c)', color: '#ffffff', border: 'rgba(251, 146, 60, 0.4)' },
  CARS: { bg: 'linear-gradient(135deg, #1f2937, #4b5563)', color: '#ffffff', border: 'rgba(156, 163, 175, 0.4)' },
  SPEN: { bg: 'linear-gradient(135deg, #0369a1, #0284c7)', color: '#ffffff', border: 'rgba(56, 189, 248, 0.4)' },
  GREG: { bg: 'linear-gradient(135deg, #9a3412, #c2410c)', color: '#ffffff', border: 'rgba(251, 146, 60, 0.4)' },
  CCS: { bg: 'linear-gradient(135deg, #15803d, #22c55e)', color: '#ffffff', border: 'rgba(74, 222, 128, 0.4)' },
  TILE: { bg: 'linear-gradient(135deg, #b45309, #d97706)', color: '#ffffff', border: 'rgba(251, 191, 36, 0.4)' },
  LLUB: { bg: 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: '#ffffff', border: 'rgba(96, 165, 250, 0.4)' },
  NTB: { bg: 'linear-gradient(135deg, #0e7490, #06b6d4)', color: '#ffffff', border: 'rgba(34, 211, 238, 0.4)' },
  TESS: { bg: 'linear-gradient(135deg, #166534, #15803d)', color: '#ffffff', border: 'rgba(34, 197, 94, 0.4)' },
  AEL: { bg: 'linear-gradient(135deg, #4338ca, #6366f1)', color: '#ffffff', border: 'rgba(129, 140, 248, 0.4)' },
  ACL: { bg: 'linear-gradient(135deg, #be123c, #e11d48)', color: '#ffffff', border: 'rgba(251, 113, 133, 0.4)' },
  LGIL: { bg: 'linear-gradient(135deg, #7c2d12, #c2410c)', color: '#ffffff', border: 'rgba(249, 115, 22, 0.4)' },
};

// Deterministic fallback color generation for any other CSE listed stock
function getDeterministicPalette(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40) % 360;
  return {
    bg: `linear-gradient(135deg, hsl(${h1}, 70%, 25%), hsl(${h2}, 75%, 40%))`,
    color: '#ffffff',
    border: `hsl(${h1}, 80%, 60%, 0.4)`,
  };
}

export function formatCompanyName(name, symbol) {
  if (!name || name === symbol) return symbol;
  if (name !== name.toUpperCase()) return name;
  const acronyms = new Set(['PLC', 'CSE', 'HNB', 'NDB', 'DFCC', 'LOLC', 'ACL', 'CWE', 'LB', 'SMB', 'CT', 'JAT']);
  return name.replace(/[A-Z]+/g, word => acronyms.has(word) ? word : word[0] + word.slice(1).toLowerCase());
}

export default function CompanyLogo({ symbol, name, size = 'md', className = '' }) {
  const cleanSymbol = normalizeSymbol(symbol);
  const logoFile = logoManifest[cleanSymbol]?.file;
  const logoSrc = logoAssets[`../assets/company-logos/${logoFile}`];
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = logoSrc && failedSrc !== logoSrc;
  const palette = BRAND_PALETTES[cleanSymbol] || getDeterministicPalette(cleanSymbol || 'CSE');
  
  const sizeMap = {
    xs: { width: 24, height: 24, fontSize: 10, borderRadius: 6 },
    sm: { width: 32, height: 32, fontSize: 11, borderRadius: 8 },
    md: { width: 40, height: 40, fontSize: 13, borderRadius: 10 },
    lg: { width: 50, height: 50, fontSize: 16, borderRadius: 12 },
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const monogram = cleanSymbol.slice(0, 4) || 'CSE';

  return (
    <div
      className={`company-logo-avatar ${className}`}
      title={name || symbol}
      role="img"
      aria-label={`${name || cleanSymbol || 'Company'} ${showImage ? 'logo' : 'symbol'}`}
      style={{
        width: currentSize.width,
        height: currentSize.height,
        minWidth: currentSize.width,
        background: showImage ? '#ffffff' : palette.bg,
        color: palette.color,
        border: `1px solid ${showImage ? '#e3e8ef' : palette.border}`,
        borderRadius: currentSize.borderRadius,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: monogram.length > 3 ? currentSize.fontSize - 2 : currentSize.fontSize,
        fontFamily: 'var(--font-mono, monospace)',
        letterSpacing: '-0.02em',
        boxShadow: '0 1px 3px rgba(16,45,80,0.05)',
        userSelect: 'none',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {showImage ? (
        <img src={logoSrc} alt="" loading="lazy" decoding="async"
          onError={() => setFailedSrc(logoSrc)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
      ) : monogram}
    </div>
  );
}
