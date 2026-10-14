/**
 * Overview page — shows stat cards, ASPI banner, distribution chart,
 * and the top predictions table.
 */
import { useEffect, useRef } from 'react';
import { IconGrid, IconModel, IconArrow, IconList, IconInfo, IconActivity, IconZap, IconTrending } from './Icons';

const pct = (n, digits = 2) => `${(n * 100).toFixed(digits)}%`;
const num = (n) => new Intl.NumberFormat('en').format(n);

export default function Overview({ dataset, marketSummary, onViewChange }) {
  const distRef = useRef(null);

  useEffect(() => {
    if (dataset && distRef.current) {
      renderDistribution(dataset, distRef.current);
    }
  }, [dataset]);

  const summary = dataset?.summary;
  const aspi = marketSummary?.aspi;

  return (
    <>
      {/* ASPI Banner */}
      {aspi && (
        <div className="aspi-banner">
          <div>
            <div className="aspi-label">CSE All Share Price Index (ASPI)</div>
            <div className="aspi-value">{num(aspi.value)}</div>
          </div>
          <div className="aspi-change">
            <span className={`stat-change ${aspi.change >= 0 ? 'positive' : 'negative'}`}>
              {aspi.change >= 0 ? '▲' : '▼'} {Math.abs(aspi.change).toFixed(2)} ({Math.abs(aspi.change_pct).toFixed(2)}%)
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>vs. previous close</span>
          </div>
          <div className="aspi-market-status">
            {marketSummary.market_status === 'open' && <><span className="status-dot" /><span className="market-open">Market Open</span></>}
            {marketSummary.market_status === 'closed' && <><span className="status-dot offline" /><span className="market-closed">Market Closed</span></>}
            {marketSummary.market_status === 'pre_market' && <><span className="status-dot warning" /><span className="market-pre">Pre-Market</span></>}
          </div>
        </div>
      )}

      {/* Notice */}
      <div className="notice">
        <IconInfo style={{ width: 18, height: 18, color: 'var(--yellow)', flexShrink: 0 }} />
        <div className="notice-text">
          <strong>Experimental model.</strong> Historical 2025 performance was poor. Scores are research outputs; trading eligibility and price-risk gates are not applied.
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => onViewChange('model')}>
            Model details ↗
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-label">
            Candidate Universe
            <IconGrid style={{ width: 16, height: 16 }} />
          </div>
          <div className="stat-value">{summary ? num(dataset.count) : '—'}</div>
          <div className="stat-meta">
            <span className="status-dot" style={{ width: 5, height: 5 }} />
            {dataset?.is_synthetic ? 'Synthetic demo data' : dataset?.is_live ? 'Live market data' : summary ? 'Uploaded dataset' : 'Waiting for data'}
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-label">
            Mean Ensemble Score
            <IconModel style={{ width: 16, height: 16 }} />
          </div>
          <div className="stat-value">
            {summary ? <>{(summary.mean_probability * 100).toFixed(2)}<span className="unit">%</span></> : '—'}
          </div>
          <div className="stat-meta">50% FULL34 + 50% TOP25</div>
        </article>

        <article className="stat-card">
          <div className="stat-label">
            Above Threshold
            <IconArrow style={{ width: 16, height: 16 }} />
          </div>
          <div className="stat-value">{summary ? num(summary.above_threshold) : '—'}</div>
          <div className="stat-meta">
            <span className="card-chip" style={{ fontSize: 9 }}>{dataset ? pct(dataset.threshold) : '22.33%'} threshold</span>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-label">
            Highest Score
            <IconZap style={{ width: 16, height: 16 }} />
          </div>
          <div className="stat-value">
            {summary ? <>{(summary.max_probability * 100).toFixed(2)}<span className="unit">%</span></> : '—'}
          </div>
          <div className="stat-meta">
            {dataset?.rows?.[0] ? `${dataset.rows[0].symbol} · top scorer` : 'No data loaded'}
          </div>
        </article>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Distribution Chart */}
        <div className="card card-glow">
          <div className="card-header">
            <div>
              <div className="card-title">Score Distribution</div>
              <div className="card-subtitle">How the candidate universe is scored</div>
            </div>
            <span className="card-chip">ENSEMBLE</span>
          </div>
          <div className="card-body">
            <div ref={distRef} className="histogram">
              {!dataset && (
                <div className="empty-state" style={{ padding: '32px 0' }}>
                  <div className="empty-state-desc">Your score distribution will appear here.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Model Card */}
        <div className="card card-glow">
          <div className="card-header">
            <div>
              <div className="card-title">The Model Behind the Scores</div>
              <div className="card-subtitle">Frozen weights · Reproducible inference</div>
            </div>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconModel style={{ width: 20, height: 20, color: 'var(--accent)' }} />
            </span>
          </div>
          <div className="card-body">
            <div className="model-ensemble-visual">
              <div className="ensemble-block" title="Broad Scan: Model trained on all 34 macro, liquidity, and technical market indicators">
                <div className="ensemble-block-title">Broad Scan</div>
                <div className="ensemble-block-sub">34 indicators</div>
              </div>
              <span className="ensemble-op">+</span>
              <div className="ensemble-block" title="Core Signals: Model focused on the 25 highest-conviction key drivers">
                <div className="ensemble-block-title">Core Signals</div>
                <div className="ensemble-block-sub">25 key drivers</div>
              </div>
              <span className="ensemble-op">=</span>
              <div className="ensemble-result" title="Combined CeylonQuant AI Score: 50/50 weighted blend">
                <div className="ensemble-block-title" style={{ color: 'var(--accent)' }}>CeylonQuant AI</div>
                <div className="ensemble-block-sub">50/50 blend</div>
              </div>
            </div>
            <div className="provenance-list" style={{ marginTop: 16 }}>
              <div className="provenance-item">
                <span className="provenance-label">Architecture</span>
                <span className="provenance-value">XGBoost ensemble</span>
              </div>
              <div className="provenance-item">
                <span className="provenance-label">Calibration</span>
                <span className="provenance-value">Platt scaling</span>
              </div>
              <div className="provenance-item">
                <span className="provenance-label">Training cutoff</span>
                <span className="provenance-value">2024 <span className="card-chip" style={{ marginLeft: 6 }}>FROZEN</span></span>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => onViewChange('model')}>
              Explore model & feature inputs <IconArrow style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function renderDistribution(dataset, container) {
  if (!dataset?.rows) return;
  const scores = dataset.rows.map(r => r.ensemble_p);
  let min = Math.max(0, Math.floor(Math.min(...scores) / .025) * .025);
  let max = Math.min(1, Math.ceil(Math.max(...scores) / .025) * .025);
  if (max <= min) { min = Math.max(0, min - .025); max = Math.min(1, max + .025); }
  const bins = Array.from({ length: 10 }, () => 0);
  scores.forEach(s => bins[Math.min(9, Math.floor((s - min) / (max - min) * 10))]++);
  const peak = Math.max(...bins, 1);
  const chartTop = 12, chartBottom = 150, chartLeft = 36, chartRight = 520;
  const width = chartRight - chartLeft;
  
  const lines = [0, .5, 1].map(f => {
    const y = chartBottom - f * (chartBottom - chartTop);
    return `<line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" stroke="rgba(20, 45, 75, 0.06)" stroke-dasharray="3 4"/>
    <text x="${chartLeft - 6}" y="${y + 3}" text-anchor="end" style="fill:var(--text-muted);font-size:9px;font-family:var(--font-mono)">${Math.round(peak * f)}</text>`;
  }).join('');

  const bars = bins.map((count, i) => {
    const barHeight = (count / peak) * (chartBottom - chartTop);
    const lower = min + i / 10 * (max - min);
    const upper = min + (i + 1) / 10 * (max - min);
    return `<rect x="${chartLeft + i * width / 10 + 4}" y="${chartBottom - Math.max(barHeight, 2)}" width="${width / 10 - 8}" height="${Math.max(barHeight, 2)}" rx="4" fill="${count ? 'url(#bar-gradient)' : 'rgba(20, 45, 75, 0.04)'}">
      <title>${pct(lower, 1)}–${pct(upper, 1)}: ${count} candidates</title>
    </rect>`;
  }).join('');

  const labels = [0, .25, .5, .75, 1].map(f => 
    `<text x="${chartLeft + f * width}" y="${chartBottom + 18}" text-anchor="middle" style="fill:var(--text-muted);font-size:9px;font-family:var(--font-mono)">${pct(min + f * (max - min), 1)}</text>`
  ).join('');

  const thresholdX = chartLeft + (dataset.threshold - min) / (max - min) * width;
  const thresholdLine = dataset.threshold > min && dataset.threshold < max
    ? `<line x1="${thresholdX}" y1="${chartTop - 2}" x2="${thresholdX}" y2="${chartBottom}" stroke="#976b16" stroke-dasharray="4 3" stroke-width="1.5"/>
       <text x="${thresholdX}" y="${chartTop - 6}" text-anchor="middle" style="fill:#976b16;font-size:8px;font-weight:600">Threshold</text>`
    : '';

  container.innerHTML = `<svg viewBox="0 0 540 ${chartBottom + 28}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:180px">
    <defs>
      <linearGradient id="bar-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#08794d"/>
        <stop offset="1" stop-color="#06b6d4" stop-opacity="0.6"/>
      </linearGradient>
    </defs>
    ${lines}${bars}${labels}${thresholdLine}
  </svg>`;
}
