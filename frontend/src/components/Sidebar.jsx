import { IconGrid, IconList, IconModel, IconTrending, IconHeatMap } from './Icons';
import brandLogo from '../assets/ceylonquant-full.png';

const NAV_ITEMS = [
  { id: 'market', label: 'Live Market', icon: IconTrending },
  { id: 'heatmap', label: 'Market Heatmap', icon: IconHeatMap },
  { id: 'screener', label: 'AI Stock Screener', icon: IconList },
  { id: 'overview', label: 'Market Overview', icon: IconGrid },
  { id: 'model', label: 'Model Explorer', icon: IconModel },
];

export default function Sidebar({ activeView, onViewChange, stockCount, modelReady, feedLabel, officialFeed }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <a href="#market" className="brand-logo" onClick={(e) => { e.preventDefault(); onViewChange('market'); }} title="CeylonQuant — AI-Powered Sri Lankan Stock Market Intelligence">
          <img 
            className="brand-full-logo" 
            src={brandLogo} 
            alt="CeylonQuant — AI-Powered Sri Lankan Stock Market Intelligence" 
          />
        </a>
      </div>

      <nav className="sidebar-nav" aria-label="Dashboard navigation">
        <div className="nav-section-label">Your market workspace</div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => onViewChange(item.id)}
              aria-current={activeView === item.id ? 'page' : undefined}
            >
              <Icon className="nav-icon" />
              {item.label}
              {item.id === 'market' && (
                <span className="nav-badge" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#08794d' }}>LIVE</span>
              )}
              {item.id === 'heatmap' && (
                <span className="nav-badge" style={{ background: 'rgba(249, 115, 22, 0.15)', color: '#976b16' }}>MAP</span>
              )}
              {item.id === 'screener' && stockCount > 0 && (
                <span className="nav-badge">{stockCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-market-note">
        <span className="sidebar-market-kicker">THE COLOMBO MARKET</span>
        <strong>Local market.<br />Clearer perspective.</strong>
        <span lang="si">කොළඹ කොටස් වෙළෙඳපොළ</span>
        <span className="sidebar-market-rule" />
        <p>Equities, market movements<br />and research in one place.</p>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-status" style={{ marginBottom: 6 }}>
          <span className={`status-dot ${officialFeed ? '' : 'warning'}`} />
          {feedLabel}
        </div>
        <div className="sidebar-status">
          <span className={`status-dot ${modelReady ? '' : 'offline'}`} />
          {modelReady ? 'XGBoost AI Model · Ready' : 'Model disconnected'}
        </div>
      </div>
      <div className="sidebar-disclaimer">Independent research dashboard</div>
    </aside>
  );
}
