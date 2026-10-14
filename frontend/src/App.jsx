import { useState, useEffect, useCallback, useRef } from 'react';
import { api, createMarketSocket } from './api';
import Sidebar from './components/Sidebar';
import Overview from './components/Overview';
import LiveMarket from './components/LiveMarket';
import HeatMap from './components/HeatMap';
import Screener from './components/Screener';
import ModelExplorer from './components/ModelExplorer';
import MarketIdentity from './components/MarketIdentity';
import { IconZap, IconRefresh, IconHeatMap } from './components/Icons';

export default function App() {
  const [activeView, setActiveView] = useState('market');
  const [dataset, setDataset] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [marketSummary, setMarketSummary] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [livePredictions, setLivePredictions] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [predictingLive, setPredictingLive] = useState(false);
  const [notification, setNotification] = useState(null);

  const socketRef = useRef(null);

  // Show auto-dismiss toast notification
  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  }, []);

  // Fetch live market data & summary
  const fetchMarketData = useCallback(async () => {
    try {
      const [prices, summary] = await Promise.all([
        api.liveMarket(),
        api.marketSummary(),
      ]);
      setLiveData(prices);
      setMarketSummary(summary);
      return { prices, summary };
    } catch (err) {
      console.warn('Market data fetch error:', err.message);
      showNotification(`Market refresh failed: ${err.message}`, 'error');
    }
  }, [showNotification]);

  // Run live XGBoost prediction on real-time market data
  const handleRunLivePredictions = useCallback(async (quiet = false) => {
    setPredictingLive(true);
    try {
      const result = await api.predictLive();
      setLivePredictions(result);
      setDataset(result);
      if (!quiet) {
        showNotification(`Live XGBoost prediction complete: ${result.count} CSE stocks evaluated!`, 'success');
      }
      return result;
    } catch (err) {
      if (!quiet) {
        showNotification(`Live prediction failed: ${err.message}`, 'error');
      }
      console.error('Prediction failed:', err);
    } finally {
      setPredictingLive(false);
    }
  }, [showNotification]);

  // Initial load: Fetch real-time CSE data & run initial live prediction
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const [model, prices, summary] = await Promise.all([
          api.model().catch(err => { console.warn('Model fetch failed:', err); return null; }),
          api.liveMarket().catch(err => { console.warn('Live market failed:', err); return null; }),
          api.marketSummary().catch(err => { console.warn('Market summary failed:', err); return null; }),
        ]);

        if (!isMounted) return;
        if (model) setModelInfo(model);
        if (prices) setLiveData(prices);
        if (summary) setMarketSummary(summary);
        // Quotes can be displayed while the slower model scoring runs.
        setLoadingInitial(false);
        if (!prices) showNotification('Market data is unavailable. Use Refresh to retry.', 'error');
        setPredictingLive(true);

        // Automatically run live AI prediction on real-time CSE data
        try {
          const scored = await api.predictLive();
          if (isMounted && scored) {
            setLivePredictions(scored);
            setDataset(scored);
          }
        } catch (e) {
          console.warn('Initial live prediction caught:', e);
        }
      } catch (err) {
        console.error('Initial load failure:', err);
      } finally {
        if (isMounted) {
          setLoadingInitial(false);
          setPredictingLive(false);
        }
      }
    }

    init();

    // Setup WebSocket for continuous live market streaming
    try {
      socketRef.current = createMarketSocket(
        (data) => {
          if (!isMounted) return;
          if (data.type === 'market_update') {
            setWsConnected(true);
            if (data.prices) setLiveData(data.prices);
            if (data.summary) setMarketSummary(data.summary);
          }
        },
        () => {
          if (isMounted) setWsConnected(false);
        }
      );
    } catch (e) {
      console.warn('WebSocket init exception:', e);
    }

    return () => {
      isMounted = false;
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (_) {}
      }
    };
  }, []);

  const viewTitles = {
    market: {
      eyebrow: 'THE SRI LANKAN EQUITY MARKET',
      title: 'Colombo Market Watch',
      subtitle: 'Follow Sri Lankan companies, market movements and the All Share Price Index.'
    },
    heatmap: {
      eyebrow: 'CSE SECTOR PERFORMANCE',
      title: 'Market Heat Map',
      subtitle: 'Explore Sri Lankan equities by sector, daily price change and research score.'
    },
    screener: {
      eyebrow: 'CSE QUANTITATIVE SCREENER',
      title: 'AI Stock Screener',
      subtitle: 'Active CSE equities evaluated against the calibrated 22.33% threshold with live feature ranking.'
    },
    overview: {
      eyebrow: 'Market & AI Analytics',
      title: 'Market Overview',
      subtitle: 'Real-time Colombo Stock Exchange intelligence powered by dual XGBoost ensemble models.'
    },
    model: {
      eyebrow: 'Model Transparency & Verification',
      title: 'Model Explorer',
      subtitle: 'Complete 34-feature catalog, XGBoost architecture parameters, and frozen-bundle verification report.'
    }
  };

  const currentMeta = viewTitles[activeView] || viewTitles.market;
  const officialFeed = liveData?.source === 'cse_official_live';
  const feedLabel = officialFeed ? 'CSE Official Feed' : liveData ? 'Simulated Data' : 'Feed Unavailable';

  return (
    <div className="app-layout">
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 24,
          zIndex: 9999,
          background: notification.type === 'error' ? '#ba3542' : notification.type === 'success' ? '#10b981' : '#3b82f6',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-lg)',
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          animation: 'fadeIn 0.25s ease'
        }}>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        stockCount={dataset?.count || liveData?.count || 0}
        modelReady={modelInfo?.model_ready ?? false}
        feedLabel={feedLabel}
        officialFeed={officialFeed}
      />

      {/* Main Layout Area */}
      <div className="main-content">
        {/* Top Sticky Bar */}
        <header className="topbar">
          <div className="breadcrumb">
            <span className="topbar-market">CSE <span className="topbar-country">SRI LANKA</span></span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{currentMeta.title}</span>
          </div>

          <div className="topbar-right">
            {/* Live CSE Feed Status */}
            <div className={`status-pill ${officialFeed ? '' : 'status-pill-warning'}`} title={liveData?.fetched_at ? `Last received: ${new Date(liveData.fetched_at).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })} (Sri Lanka)` : 'No market data received'}>
              <span className={`status-dot ${officialFeed ? '' : 'warning'}`} />
              {feedLabel}
            </div>

            {/* Live WS indicator */}
            <div className="status-pill" style={{ background: 'rgba(96, 165, 250, 0.1)', color: '#245ca0' }}>
              <span className={`status-dot ${wsConnected ? '' : 'warning'}`} />
              {wsConnected ? 'Real-Time Sync' : 'Reconnecting'}
            </div>

            {/* Refresh Market Data */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={fetchMarketData}
              title="Refresh live prices from exchange"
            >
              <IconRefresh style={{ width: 14, height: 14 }} />
              Refresh
            </button>

            {/* Run Live AI Prediction */}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleRunLivePredictions(false)}
              disabled={predictingLive}
              title="Score live CSE market data using dual XGBoost models"
            >
              <IconZap style={{ width: 14, height: 14 }} />
              {predictingLive ? 'Scoring...' : 'Run AI Screener'}
            </button>

          </div>
        </header>

        {/* Page Container */}
        <main className="page-container">
          <MarketIdentity updatedAt={liveData?.fetched_at} />
          {/* Page Header */}
          <div className="page-header">
            <div className="page-header-text">
              <div className="page-eyebrow">{currentMeta.eyebrow}</div>
              <h1 className="page-title">{currentMeta.title}</h1>
              <p className="page-subtitle">{currentMeta.subtitle}</p>
            </div>

            <div className="page-actions">
              {activeView === 'market' && (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveView('heatmap')}
                  >
                    <IconHeatMap style={{ width: 14, height: 14, color: '#976b16' }} />
                    Open Heat Map
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      handleRunLivePredictions(false);
                      setActiveView('screener');
                    }}
                  >
                    <IconZap style={{ width: 14, height: 14, color: 'var(--accent)' }} />
                    View AI Screener
                  </button>
                </>
              )}

              {activeView === 'heatmap' && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveView('market')}
                >
                  View Terminal Grid
                </button>
              )}

              {activeView === 'overview' && (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={() => setActiveView('heatmap')}>
                    <IconHeatMap style={{ width: 14, height: 14, color: '#976b16' }} />
                    Open Heat Map
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setActiveView('screener')}>
                    Open Screener
                  </button>
                </>
              )}

              {activeView === 'screener' && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleRunLivePredictions(false)}
                  disabled={predictingLive}
                >
                  <IconZap style={{ width: 14, height: 14 }} />
                  {predictingLive ? 'Scoring...' : 'Re-Score Live Market'}
                </button>
              )}
            </div>
          </div>

          {/* Active View Component */}
          {loadingInitial ? (
            <div className="loading-overlay">
              <div className="spinner" />
              Connecting to Colombo Stock Exchange live feed & scoring equities...
            </div>
          ) : (
            <>
              {activeView === 'market' && (
                <LiveMarket
                  liveData={liveData}
                  marketSummary={marketSummary}
                  onRefreshMarket={fetchMarketData}
                  onRunLivePredictions={handleRunLivePredictions}
                  livePredictions={livePredictions}
                  predictingLive={predictingLive}
                />
              )}

              {activeView === 'heatmap' && (
                <HeatMap
                  liveData={liveData}
                  dataset={dataset}
                />
              )}

              {activeView === 'overview' && (
                <Overview
                  dataset={dataset}
                  marketSummary={marketSummary}
                  onViewChange={setActiveView}
                />
              )}

              {activeView === 'screener' && (
                <Screener dataset={dataset} predicting={predictingLive} />
              )}

              {activeView === 'model' && (
                <ModelExplorer modelInfo={modelInfo} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
