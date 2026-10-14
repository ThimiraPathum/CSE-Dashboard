/**
 * Stock Screener — full paginated/filterable table of scored candidates
 * with detail modal.
 */
import { useState, useMemo, useCallback } from 'react';
import { IconSearch, IconDownload, IconArrow, IconClose } from './Icons';
import CompanyLogo, { formatCompanyName } from './CompanyLogo';

const pct = (n, digits = 2) => `${(n * 100).toFixed(digits)}%`;
const num = (n) => new Intl.NumberFormat('en').format(n);
const escapeCSV = (v) => {
  let t = String(v ?? '');
  if (typeof v === 'string' && /^[\s]*[=+\-@]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
};

const PAGE_SIZE = 15;

export default function Screener({ dataset, predicting = false }) {
  const [search, setSearch] = useState('');
  const [aboveOnly, setAboveOnly] = useState(false);
  const [sortKey, setSortKey] = useState('score-desc');
  const [page, setPage] = useState(1);
  const [selectedSymbol, setSelectedSymbol] = useState(null);

  const rows = dataset?.rows || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = rows.filter(r =>
      (!q || `${r.symbol} ${r.name || ''}`.toLowerCase().includes(q)) &&
      (!aboveOnly || r.above_frozen_threshold)
    );
    result.sort((a, b) => {
      if (sortKey === 'symbol') return a.symbol.localeCompare(b.symbol);
      if (sortKey === 'score-asc') return a.ensemble_p - b.ensemble_p;
      return b.ensemble_p - a.ensemble_p;
    });
    return result;
  }, [rows, search, aboveOnly, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  const selectedRow = selectedSymbol ? rows.find(r => r.symbol === selectedSymbol) : null;

  const handleExport = useCallback(() => {
    if (!filtered.length) return;
    const headers = ['date', 'symbol', 'name', 'p_FULL34', 'p_FULL_TOP25', 'ensemble_p', 'above_frozen_threshold', 'frozen_threshold', 'data_source', 'is_synthetic'];
    const data = filtered.map(r => [r.date, r.symbol, r.name, r.p_FULL34, r.p_FULL_TOP25, r.ensemble_p, r.above_frozen_threshold, dataset.threshold, dataset.source, dataset.is_synthetic]);
    const csv = '\uFEFF' + [headers, ...data].map(row => row.map(escapeCSV).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ceylonquant_${dataset.is_synthetic ? 'SYNTHETIC_' : ''}scores_${dataset.as_of}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [filtered, dataset]);

  if (!dataset) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <div className="empty-state-title">{predicting ? 'Scoring CSE Universe...' : 'No screener data available'}</div>
        <div className="empty-state-desc">{predicting ? 'Evaluating active equities with the dual XGBoost ensemble...' : 'Click "Run AI Screener" to score active CSE equities.'}</div>
      </div>
    );
  }

  return (
    <>
      <div className="table-panel">
        {/* Header */}
        <div className="table-header">
          <div>
            <div className="card-title">
              Candidate Scores <span className="nav-badge" style={{ marginLeft: 8 }}>{num(filtered.length)}</span>
            </div>
            <div className="card-subtitle">Ranked by calibrated ensemble probability</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleExport} disabled={!filtered.length}>
            <IconDownload style={{ width: 14, height: 14 }} />
            Export Results
          </button>
        </div>

        {/* Toolbar */}
        <div className="table-toolbar">
          <div className="search-input">
            <IconSearch style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search by symbol or name…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <label className="checkbox-filter">
            <input type="checkbox" checked={aboveOnly} onChange={e => { setAboveOnly(e.target.checked); setPage(1); }} />
            Above threshold
          </label>
          <select className="filter-select" value={sortKey} onChange={e => { setSortKey(e.target.value); setPage(1); }}>
            <option value="score-desc">Highest score first</option>
            <option value="score-asc">Lowest score first</option>
            <option value="symbol">Symbol A–Z</option>
          </select>
        </div>

        {/* Table */}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Candidate</th>
                <th title="Broad Scan: Scores all 34 technical, liquidity, and market features (50% weight)">
                  Broad Scan (34F) <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.6 }}>50%</span>
                </th>
                <th title="Core Signals: Scores the top 25 high-conviction key market drivers (50% weight)">
                  Core Signals (25F) <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.6 }}>50%</span>
                </th>
                <th title="Combined AI Score: Equal 50/50 blend of Broad Scan and Core Signals">
                  Combined AI Score
                </th>
                <th>Status</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                    {rows.length ? 'No candidates match these filters.' : 'No candidates loaded.'}
                  </td>
                </tr>
              ) : pageRows.map((row, i) => (
                <tr key={row.symbol}>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 12 }}>
                    {String(start + i + 1).padStart(2, '0')}
                  </td>
                  <td>
                    <div className="candidate-cell" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CompanyLogo symbol={row.symbol} name={row.name} size="sm" />
                      <div className="candidate-info">
                        <span className="candidate-symbol" style={{ fontWeight: 800 }}>{row.symbol}</span>
                        <span className="candidate-name" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {formatCompanyName(row.name, row.symbol)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{pct(row.p_FULL34)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{pct(row.p_FULL_TOP25)}</td>
                  <td>
                    <div className="score-cell">
                      <span className="score-value">{pct(row.ensemble_p)}</span>
                      <span className="score-bar">
                        <span className="score-bar-fill" style={{ width: `${Math.min(100, row.ensemble_p * 100 * 2)}%` }} />
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-chip ${row.above_frozen_threshold ? 'above' : 'below'}`}>
                      {row.above_frozen_threshold ? 'Above' : 'Below'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-icon" onClick={() => setSelectedSymbol(row.symbol)} title={`View ${row.symbol} details`}>
                      <IconArrow style={{ width: 16, height: 16 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="table-footer">
          <span>
            {filtered.length ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${num(filtered.length)} candidates` : '0 candidates'}
            {dataset.is_synthetic ? ' · synthetic data' : dataset.is_live ? ' · live data' : ''}
          </span>
          <div className="pagination">
            <button className="page-btn" disabled={currentPage <= 1} onClick={() => setPage(p => p - 1)}>←</button>
            <span className="page-info">{currentPage} / {totalPages}</span>
            <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => setPage(p => p + 1)}>→</button>
          </div>
        </div>
      </div>

      {/* Candidate Detail Modal */}
      {selectedRow && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedSymbol(null); }}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <CompanyLogo symbol={selectedRow.symbol} name={selectedRow.name} size="md" />
                <div>
                  <div className="page-eyebrow">CANDIDATE INTELLIGENCE</div>
                  <h2 style={{ fontSize: 20, fontWeight: 800 }}>{selectedRow.symbol}</h2>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatCompanyName(selectedRow.name, selectedRow.symbol)} · {selectedRow.date}
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedSymbol(null)}>
                <IconClose style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div className="modal-body">
              {/* Scores */}
              <div className="detail-scores">
                <div className="detail-score" title="Broad Scan: Probability based on all 34 technical, liquidity, and market features">
                  <div className="detail-score-label">Broad Scan (34F)</div>
                  <div className="detail-score-value">{pct(selectedRow.p_FULL34)}</div>
                </div>
                <div className="detail-score" title="Core Signals: Probability based on top 25 highest-conviction key drivers">
                  <div className="detail-score-label">Core Signals (25F)</div>
                  <div className="detail-score-value">{pct(selectedRow.p_FULL_TOP25)}</div>
                </div>
                <div className="detail-score" title="Combined AI Score: 50/50 weighted ensemble average">
                  <div className="detail-score-label">Combined AI Score</div>
                  <div className="detail-score-value" style={{ color: 'var(--accent)' }}>{pct(selectedRow.ensemble_p)}</div>
                </div>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                {selectedRow.above_frozen_threshold ? 'Above' : 'Below'} the {pct(dataset.threshold)} frozen threshold.
                Trading eligibility and price-risk gates have not been applied.
              </div>

              {/* Feature Values */}
              <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Input Features
              </h3>
              <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <table className="feature-values-table">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th style={{ textAlign: 'right' }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selectedRow.features || {}).map(([key, value]) => (
                      <tr key={key}>
                        <td>{key}</td>
                        <td>{Number(value).toPrecision(7)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
