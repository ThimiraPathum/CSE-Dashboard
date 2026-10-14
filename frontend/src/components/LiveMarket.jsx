/**
 * Live Market page — displays real-time CSE stock prices with company logos,
 * auto-refresh, formatted company names, and live XGBoost prediction integration.
 */
import { useState, useCallback } from 'react';
import CompanyLogo, { formatCompanyName } from './CompanyLogo';
import { IconRefresh, IconTrending, IconZap } from './Icons';

const num = (n) => new Intl.NumberFormat('en').format(n);

export default function LiveMarket({ liveData, marketSummary, onRefreshMarket, onRunLivePredictions, livePredictions, predictingLive }) {
  const [refreshing, setRefreshing] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [sortBy, setSortBy] = useState('turnover');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefreshMarket();
    } finally {
      setRefreshing(false);
    }
  }, [onRefreshMarket]);

  const handlePredict = useCallback(async () => {
    setPredicting(true);
    try {
      await onRunLivePredictions();
    } finally {
      setPredicting(false);
    }
  }, [onRunLivePredictions]);

  const stocks = liveData?.stocks || [];
  const aspi = marketSummary?.aspi;
  const advances = stocks.filter(stock => stock.change > 0).length;
  const declines = stocks.filter(stock => stock.change < 0).length;
  const unchanged = stocks.filter(stock => stock.change === 0).length;
  const turnover = stocks.reduce((total, stock) => total + (Number(stock.turnover) || 0), 0);
  const compact = value => new Intl.NumberFormat('en-LK', { notation: 'compact', maximumFractionDigits: 2 }).format(value);

  // Map predictions by symbol for fast lookup
  const predictionMap = {};
  if (livePredictions?.rows) {
    livePredictions.rows.forEach(r => {
      predictionMap[r.symbol] = r;
    });
  }

  const getPrediction = (symbol) => {
    const clean = symbol.replace('.N0000', '').replace('.X0000', '').replace('.U0000', '');
    return predictionMap[clean] || predictionMap[symbol];
  };

  // Filter and sort
  const filtered = stocks.filter(s => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return s.symbol.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q) || (s.sector || '').toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortBy === 'turnover') diff = (b.turnover || 0) - (a.turnover || 0);
    else if (sortBy === 'change_pct') diff = b.change_pct - a.change_pct;
    else if (sortBy === 'close') diff = b.close - a.close;
    else if (sortBy === 'volume') diff = b.volume - a.volume;
    else if (sortBy === 'symbol') diff = b.symbol.localeCompare(a.symbol);
    return sortDir === 'asc' ? -diff : diff;
  });

  return (
    <div>
      {/* Market Summary Banner */}
      {aspi && (
        <div className="aspi-banner">
          <div>
            <div className="aspi-label"><span className="index-ticker">ASPI</span> All Share Price Index</div>
            <div className="aspi-value">{num(aspi.value)}</div>
          </div>
          <div className="aspi-change">
            <span className={`stat-change ${aspi.change >= 0 ? 'positive' : 'negative'}`}>
              {aspi.change >= 0 ? '▲ +' : '▼ '}{Math.abs(aspi.change).toFixed(2)} ({Math.abs(aspi.change_pct).toFixed(2)}%)
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Session Range: {aspi.low} – {aspi.high}</span>
          </div>
          <div className="aspi-market-status">
            {marketSummary.market_status === 'open' && (
              <>
                <span className="status-dot" style={{ background: '#08794d' }} />
                <span className="market-open">{marketSummary.market_status_text || 'Regular Trading'}</span>
              </>
            )}
            {marketSummary.market_status !== 'open' && (
              <>
                <span className="status-dot offline" />
                <span className="market-closed">{marketSummary.market_status_text || 'Market Closed'}</span>
              </>
            )}
          </div>
        </div>
      )}

      {stocks.length > 0 && <div className="market-breadth" aria-label="Market summary for loaded securities">
        <div><span className="breadth-label">Securities</span><strong>{num(stocks.length)}</strong><span className="breadth-note">In the current feed</span></div>
        <div><span className="breadth-label">Reported turnover</span><strong><small>LKR</small> {compact(turnover)}</strong><span className="breadth-note">Across loaded securities</span></div>
        <div><span className="breadth-label">Advances / declines</span><strong><span className="price-up">{advances}</span><span className="breadth-divider">/</span><span className="price-down">{declines}</span></strong><span className="breadth-note">{unchanged} unchanged</span></div>
        <div><span className="breadth-label">Market breadth</span><div className="breadth-track" role="img" aria-label={`${advances} advancing, ${declines} declining, ${unchanged} unchanged`}><span style={{ flex: advances, background: 'var(--accent)' }} /><span style={{ flex: declines, background: 'var(--red)' }} /><span style={{ flex: unchanged, background: '#c8d2df' }} /></div><span className="breadth-note">Advancing · Declining · Unchanged</span></div>
      </div>}

      <div className="market-section-heading"><div><h2>Listed companies</h2><p>Quotes in Sri Lankan rupees · LKR</p></div><span className="market-section-tag">CSE EQUITIES</span></div>

      {/* Controls Bar */}
      <div className="market-controls" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleRefresh} disabled={refreshing}>
          <IconRefresh className="nav-icon" style={{ width: 14, height: 14, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Updating...' : 'Sync CSE Feed'}
        </button>

        <button className="btn btn-primary btn-sm" onClick={handlePredict} disabled={predicting || predictingLive} title="Score all active CSE stocks using dual XGBoost models">
          <IconZap style={{ width: 14, height: 14 }} />
          {predicting || predictingLive ? 'Scoring Universe...' : 'Run AI Screener'}
        </button>

        <input
          type="search"
          placeholder="Search company or symbol..."
          aria-label="Filter stocks"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '7px 12px',
            fontSize: 12,
            outline: 'none',
            minWidth: 160
          }}
        />

        <select
          className="filter-select"
          aria-label="Sort stocks"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '7px 12px',
            fontSize: 12
          }}
        >
          <option value="turnover">Sort by Turnover</option>
          <option value="change_pct">Sort by Change %</option>
          <option value="close">Sort by Price</option>
          <option value="volume">Sort by Volume</option>
          <option value="symbol">Sort by Symbol</option>
        </select>

        <button className="btn btn-ghost btn-sm" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
          {sortDir === 'desc' ? '↓ Desc' : '↑ Asc'}
        </button>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {sorted.length} Active CSE Equities
        </span>
      </div>

      {/* Stock Cards Grid */}
      {stocks.length === 0 ? (
        <div className="empty-state">
          <IconTrending className="empty-state-icon" style={{ width: 48, height: 48, opacity: 0.3 }} />
          <div className="empty-state-title">Market data is unavailable</div>
          <div className="empty-state-desc">Use Sync CSE Feed to retry loading quotes.</div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No stocks match your search</div>
          <div className="empty-state-desc">Try a company name, symbol, or sector.</div>
          <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>Clear search</button>
        </div>
      ) : (
        <div className="market-grid">
          {sorted.map((stock) => {
            const prediction = getPrediction(stock.symbol);
            const formattedName = formatCompanyName(stock.name, stock.symbol);

            return (
              <div key={stock.raw_symbol || stock.symbol} className="market-card">
                {/* Header with Company Logo Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <CompanyLogo symbol={stock.symbol} name={stock.name} size="md" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="market-card-identity">
                      <span className="market-card-symbol" title={stock.raw_symbol}>{stock.symbol}{stock.raw_symbol && !stock.raw_symbol.endsWith('.N0000') ? ` · ${stock.raw_symbol.split('.')[1]}` : ''}</span>
                      <span className="market-card-sector" title={stock.sector}>{stock.sector}</span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: 1
                      }}
                      title={stock.name}
                    >
                      {formattedName}
                    </div>
                  </div>
                </div>

                {/* Price & Change */}
                <div className="market-card-quote">
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>LKR </span>
                    <span className="market-card-price" style={{ fontSize: 20 }}>
                      {stock.close.toFixed(2)}
                    </span>
                  </div>

                  <div className="market-card-change" style={{ margin: 0 }}>
                    <span style={{
                      color: stock.change >= 0 ? 'var(--accent)' : 'var(--red)',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                {/* AI Score Badge if scored */}
                {prediction && (
                  <div style={{
                    padding: '6px 10px',
                    background: prediction.above_frozen_threshold ? 'rgba(52, 211, 153, 0.12)' : 'rgba(20, 45, 75, 0.03)',
                    border: `1px solid ${prediction.above_frozen_threshold ? 'rgba(52, 211, 153, 0.3)' : 'rgba(20, 45, 75, 0.05)'}`,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      AI Score
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: prediction.above_frozen_threshold ? 'var(--accent)' : 'var(--text-primary)'
                    }}>
                      {(prediction.ensemble_p * 100).toFixed(2)}%
                    </span>
                  </div>
                )}

                {/* Turnover & Volume */}
                <div className="market-card-metrics">
                  <span>Vol: {num(stock.volume)}</span>
                  <span>Turnover: Rs. {stock.turnover ? num(Math.round(stock.turnover)) : '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
