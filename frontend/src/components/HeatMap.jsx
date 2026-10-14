/**
 * HeatMap — Real-time Colombo Stock Exchange (CSE) Market Heat Map
 * Visualizes live price movements and AI prediction scores grouped by economic sector.
 */

import { useState, useMemo, useEffect } from 'react';
import CompanyLogo, { formatCompanyName, normalizeSymbol } from './CompanyLogo';
import { IconSearch, IconClose, IconTrending, IconZap, IconActivity } from './Icons';

// CSE sector categorization mapping
const SECTOR_MAPPINGS = {
  // Banks
  COMB: 'Banking & Financials', HNB: 'Banking & Financials', SAMP: 'Banking & Financials',
  NTB: 'Banking & Financials', NDB: 'Banking & Financials', PABC: 'Banking & Financials',
  DFCC: 'Banking & Financials', SEMB: 'Banking & Financials', SEYB: 'Banking & Financials',
  UBC: 'Banking & Financials', AFSL: 'Banking & Financials', CALC: 'Banking & Financials',
  LOLC: 'Banking & Financials', CFIN: 'Banking & Financials', PLC: 'Banking & Financials',

  // Capital Goods / Conglomerates
  JKH: 'Capital Goods & Holdings', HAYL: 'Capital Goods & Holdings', AITK: 'Capital Goods & Holdings',
  SPEN: 'Capital Goods & Holdings', HEMA: 'Capital Goods & Holdings', SFL: 'Capital Goods & Holdings',
  CARS: 'Capital Goods & Holdings', AEL: 'Capital Goods & Holdings',

  // Food, Beverage & Tobacco
  CTC: 'Food, Beverage & Tobacco', CARG: 'Food, Beverage & Tobacco', CCS: 'Food, Beverage & Tobacco',
  DIST: 'Food, Beverage & Tobacco', LION: 'Food, Beverage & Tobacco', NEST: 'Food, Beverage & Tobacco',
  KFP: 'Food, Beverage & Tobacco', BUKI: 'Food, Beverage & Tobacco',

  // Materials & Manufacturing
  TKYO: 'Materials & Manufacturing', RCL: 'Materials & Manufacturing', TILE: 'Materials & Manufacturing',
  DIPD: 'Materials & Manufacturing', GREG: 'Materials & Manufacturing', ACL: 'Materials & Manufacturing',
  APLA: 'Materials & Manufacturing', LLUB: 'Materials & Manufacturing', ACME: 'Materials & Manufacturing',
  ABAN: 'Materials & Manufacturing',

  // Telecom & Tech
  DIAL: 'Telecommunications', SLTL: 'Telecommunications',

  // Transportation
  EXPO: 'Transportation & Logistics',

  // Real Estate
  SLND: 'Real Estate & Properties', MDL: 'Real Estate & Properties', ONAL: 'Real Estate & Properties',
  RIL: 'Real Estate & Properties', ODEL: 'Real Estate & Properties',

  // Plantations & Agriculture
  TESS: 'Plantations & Agriculture', AGAL: 'Plantations & Agriculture', AGST: 'Plantations & Agriculture',
  HOPL: 'Plantations & Agriculture', BOPL: 'Plantations & Agriculture', ELP: 'Plantations & Agriculture',
  CTEA: 'Plantations & Agriculture',

  // Insurance
  LGIL: 'Insurance', CINS: 'Insurance', JAT: 'Insurance',
};

const num = (n) => new Intl.NumberFormat('en').format(n);
const pct = (n, digits = 2) => `${(n * 100).toFixed(digits)}%`;

export default function HeatMap({ liveData, dataset }) {
  const [colorMode, setColorMode] = useState('change'); // 'change' or 'ai_score'
  const [selectedSector, setSelectedSector] = useState('all');
  const [search, setSearch] = useState('');
  const [activeStock, setActiveStock] = useState(null);

  useEffect(() => {
    if (!activeStock) return;
    const closeOnEscape = event => { if (event.key === 'Escape') setActiveStock(null); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [activeStock]);

  // Combine live prices with AI scores if available
  const stocks = useMemo(() => {
    const rawList = liveData?.stocks || [];
    const aiMap = new Map();
    (dataset?.rows || []).forEach(r => aiMap.set(r.symbol, r));

    return rawList.map(s => {
      const cleanSym = normalizeSymbol(s.symbol);
      const aiData = aiMap.get(cleanSym) || aiMap.get(s.symbol);
      const sector = SECTOR_MAPPINGS[cleanSym] || s.sector || 'Diversified Listed';

      return {
        ...s,
        cleanSymbol: cleanSym,
        sector,
        formattedName: formatCompanyName(s.name, cleanSym),
        aiScore: aiData?.ensemble_p ?? null,
        aboveThreshold: aiData?.above_frozen_threshold ?? false,
        aiFeatures: aiData?.features ?? null,
      };
    });
  }, [liveData, dataset]);

  // Group stocks by sector
  const sectorGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = stocks.filter(s => {
      const matchQ = !q || `${s.cleanSymbol} ${s.name} ${s.sector}`.toLowerCase().includes(q);
      const matchSector = selectedSector === 'all' || s.sector === selectedSector;
      return matchQ && matchSector;
    });

    const groups = {};
    filtered.forEach(s => {
      if (!groups[s.sector]) {
        groups[s.sector] = [];
      }
      groups[s.sector].push(s);
    });

    // Sort stocks inside each group by turnover/volume
    Object.keys(groups).forEach(k => {
      groups[k].sort((a, b) => (b.turnover || b.volume) - (a.turnover || a.volume));
    });

    return groups;
  }, [stocks, search, selectedSector]);

  // Unique sector list
  const sectors = useMemo(() => {
    return ['all', ...new Set(stocks.map(s => s.sector))];
  }, [stocks]);

  // Heat map tile color calculation
  const getTileColor = (stock) => {
    if (colorMode === 'ai_score') {
      if (stock.aiScore == null) return { bg: 'rgba(20, 45, 75, 0.05)', border: 'rgba(20, 45, 75, 0.1)', text: '#62748a' };
      const score = stock.aiScore;
      if (score >= 0.2233) {
        return { bg: 'rgba(52, 211, 153, 0.25)', border: 'rgba(52, 211, 153, 0.6)', text: '#08794d', glow: 'rgba(52, 211, 153, 0.3)' };
      }
      if (score >= 0.18) {
        return { bg: 'rgba(6, 182, 212, 0.2)', border: 'rgba(6, 182, 212, 0.45)', text: '#126d80', glow: 'rgba(6, 182, 212, 0.2)' };
      }
      if (score >= 0.14) {
        return { bg: 'rgba(99, 102, 241, 0.18)', border: 'rgba(99, 102, 241, 0.35)', text: '#5945a0' };
      }
      return { bg: 'rgba(20, 45, 75, 0.04)', border: 'rgba(20, 45, 75, 0.08)', text: '#62748a' };
    }

    // Default: Price change %
    const chg = stock.change_pct;
    if (chg >= 5.0) return { bg: 'rgba(16, 185, 129, 0.35)', border: 'rgba(52, 211, 153, 0.7)', text: '#08794d' };
    if (chg >= 2.0) return { bg: 'rgba(16, 185, 129, 0.22)', border: 'rgba(52, 211, 153, 0.45)', text: '#08794d' };
    if (chg > 0.0) return { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(52, 211, 153, 0.3)', text: '#08794d' };
    if (chg === 0.0) return { bg: 'rgba(20, 45, 75, 0.04)', border: 'rgba(20, 45, 75, 0.08)', text: '#62748a' };
    if (chg > -2.0) return { bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(248, 113, 113, 0.3)', text: '#a52636' };
    if (chg > -5.0) return { bg: 'rgba(239, 68, 68, 0.24)', border: 'rgba(248, 113, 113, 0.5)', text: '#ba3542' };
    return { bg: 'rgba(220, 38, 38, 0.35)', border: 'rgba(239, 68, 68, 0.7)', text: '#ba3542' };
  };

  return (
    <div className="heatmap-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Heatmap Control Bar */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Mode Switcher */}
          <div className="heatmap-mode-switch" style={{ display: 'flex', background: 'rgba(20, 45, 75, 0.04)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
            <button
              className={`btn btn-sm ${colorMode === 'change' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 14px', fontSize: 12 }}
              onClick={() => setColorMode('change')}
            >
              <IconTrending style={{ width: 14, height: 14 }} />
              Price Change (1D %)
            </button>
            <button
              className={`btn btn-sm ${colorMode === 'ai_score' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 14px', fontSize: 12 }}
              onClick={() => setColorMode('ai_score')}
            >
              <IconZap style={{ width: 14, height: 14 }} />
              AI Research Score
            </button>
          </div>

          {/* Sector Filter */}
          <select
            aria-label="Filter by sector"
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {sectors.map(sec => (
              <option key={sec} value={sec}>
                {sec === 'all' ? 'All Economic Sectors' : sec}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="search-input" style={{ maxWidth: 280, height: 36 }}>
          <IconSearch style={{ width: 15, height: 15 }} />
          <input
            type="search"
            placeholder="Search symbol or company..."
            aria-label="Search heatmap"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: 12 }}
          />
        </div>
      </div>

      {/* Heatmap Legend */}
      <div className="heatmap-legend" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', fontSize: 11, color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{colorMode === 'change' ? 'Performance Legend:' : 'AI Confidence Legend:'}</span>
          {colorMode === 'change' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.35)', color: '#a52636', fontWeight: 600 }}>≤ -5%</span>
              <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.18)', color: '#ba3542' }}>-1%</span>
              <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(20, 45, 75, 0.05)', color: '#62748a' }}>0%</span>
              <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.18)', color: '#08794d' }}>+1%</span>
              <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.35)', color: '#08794d', fontWeight: 600 }}>≥ +5%</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(20, 45, 75, 0.04)', color: '#62748a' }}>Low (&lt;14%)</span>
              <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(99, 102, 241, 0.2)', color: '#5945a0' }}>Moderate (14-18%)</span>
              <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(6, 182, 212, 0.25)', color: '#126d80' }}>High (18–22.33%)</span>
              <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(52, 211, 153, 0.3)', color: '#08794d', fontWeight: 700 }}>Above Threshold (&ge;22.33%)</span>
            </div>
          )}
        </div>
        <div>
          Showing {Object.values(sectorGroups).reduce((acc, g) => acc + g.length, 0)} Active CSE Equities
        </div>
      </div>

      {/* Heatmap Sector Grid */}
      {Object.keys(sectorGroups).length === 0 && (
        <div className="empty-state card">
          <div className="empty-state-title">{stocks.length ? 'No stocks match these filters' : 'Market data is unavailable'}</div>
          <div className="empty-state-desc">{stocks.length ? 'Try another company or sector.' : 'Refresh the market feed to load the heatmap.'}</div>
          {stocks.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setSelectedSector('all'); }}>Clear filters</button>}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {Object.entries(sectorGroups).map(([sectorName, groupStocks]) => {
          const avgChange = groupStocks.reduce((sum, s) => sum + s.change_pct, 0) / (groupStocks.length || 1);

          return (
            <div
              key={sectorName}
              className="card card-glow"
              style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}
            >
              {/* Sector Header */}
              <div className="heatmap-sector-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: avgChange >= 0 ? 'var(--accent)' : 'var(--red)' }} />
                  <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                    {sectorName}
                  </span>
                  <span className="nav-badge" style={{ fontSize: 10 }}>{groupStocks.length} stocks</span>
                </div>

                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  Sector Avg: <span style={{ color: avgChange >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                    {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Stock Tiles Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))',
                gap: 12
              }}>
                {groupStocks.map((stock) => {
                  const colors = getTileColor(stock);
                  return (
                    <div
                      key={stock.raw_symbol || stock.symbol}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${stock.name || stock.symbol} details`}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveStock(stock); } }}
                      onClick={() => setActiveStock(stock)}
                      style={{
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 10,
                        boxShadow: colors.glow ? `0 0 16px ${colors.glow}` : 'none',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(16,45,80,0.10)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = colors.glow ? `0 0 16px ${colors.glow}` : 'none';
                      }}
                    >
                      {/* Top Row: Logo & Symbol + Change Pill */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <CompanyLogo symbol={stock.cleanSymbol} name={stock.name} size="sm" />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                              {stock.cleanSymbol}{stock.raw_symbol && !stock.raw_symbol.endsWith('.N0000') ? ` · ${stock.raw_symbol.split('.')[1]}` : ''}
                            </div>
                            <div style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 140
                            }}>
                              {stock.formattedName}
                            </div>
                          </div>
                        </div>

                        {/* Price Change Pill */}
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: stock.change_pct >= 0 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                          color: stock.change_pct >= 0 ? 'var(--accent)' : 'var(--red)',
                          fontFamily: 'var(--font-mono, monospace)',
                          whiteSpace: 'nowrap'
                        }}>
                          {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                        </span>
                      </div>

                      {/* Bottom Row: Price & AI Score */}
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderTop: '1px solid rgba(20, 45, 75, 0.06)', paddingTop: 8 }}>
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>LKR </span>
                          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {stock.close.toFixed(2)}
                          </span>
                        </div>

                        {stock.aiScore != null && (
                          <div style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: 'var(--text-muted)' }}>AI:</span>
                            <span style={{
                              fontWeight: 700,
                              color: stock.aboveThreshold ? 'var(--accent)' : colors.text,
                              fontFamily: 'var(--font-mono)'
                            }}>
                              {(stock.aiScore * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stock Detail Modal */}
      {activeStock && (
        <div className="modal-overlay" onClick={() => setActiveStock(null)}>
          <div className="modal modal-detail" role="dialog" aria-modal="true" aria-label={`${activeStock.cleanSymbol} stock details`} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <CompanyLogo symbol={activeStock.cleanSymbol} name={activeStock.name} size="md" />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>{activeStock.cleanSymbol}</span>
                    <span className="nav-badge">{activeStock.sector}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeStock.formattedName}</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" aria-label="Close stock details" autoFocus onClick={() => setActiveStock(null)}>
                <IconClose style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px' }}>
              {/* Price & Change Banner */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(20, 45, 75, 0.03)',
                border: '1px solid var(--border)',
                marginBottom: 16
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Current Price</div>
                  <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                    Rs. {activeStock.close.toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Session Change</div>
                  <div style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: activeStock.change_pct >= 0 ? 'var(--accent)' : 'var(--red)'
                  }}>
                    {activeStock.change_pct >= 0 ? '▲ +' : '▼ '}{activeStock.change_pct.toFixed(2)}%
                    <span style={{ fontSize: 12, marginLeft: 6 }}>({activeStock.change >= 0 ? '+' : ''}{activeStock.change.toFixed(2)})</span>
                  </div>
                </div>
              </div>

              {/* Traded Metrics */}
              <div className="detail-scores" style={{ gap: 10, marginBottom: 20 }}>
                <div className="detail-score" style={{ padding: 10 }}>
                  <div className="detail-score-label">Turnover</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Rs. {num(activeStock.turnover)}</div>
                </div>
                <div className="detail-score" style={{ padding: 10 }}>
                  <div className="detail-score-label">Volume</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{num(activeStock.volume)}</div>
                </div>
                <div className="detail-score" style={{ padding: 10 }}>
                  <div className="detail-score-label">High / Low</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{activeStock.high} / {activeStock.low}</div>
                </div>
              </div>

              {/* AI Prediction Section */}
              {activeStock.aiScore != null && (
                <div style={{
                  padding: 16,
                  borderRadius: 'var(--radius-sm)',
                  background: activeStock.aboveThreshold ? 'rgba(52, 211, 153, 0.08)' : 'rgba(20, 45, 75, 0.02)',
                  border: `1px solid ${activeStock.aboveThreshold ? 'rgba(52, 211, 153, 0.3)' : 'var(--border)'}`,
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      <IconZap style={{ width: 14, height: 14, color: 'var(--accent)' }} />
                      XGBoost Model Ensemble
                    </div>
                    <span className="card-chip" style={{ color: activeStock.aboveThreshold ? 'var(--accent)' : 'inherit' }}>
                      {activeStock.aboveThreshold ? 'ABOVE THRESHOLD' : 'BELOW THRESHOLD'}
                    </span>
                  </div>

                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                    {(activeStock.aiScore * 100).toFixed(2)}%
                    <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                      confidence score
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Evaluated against the 22.33% frozen benchmark. Platt calibrated probabilities.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
