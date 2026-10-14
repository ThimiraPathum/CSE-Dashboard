import cseLogo from '../assets/cse-official-logo.png';

export default function MarketIdentity({ updatedAt }) {
  const timestamp = updatedAt ? new Date(updatedAt) : null;
  const validDate = timestamp && !Number.isNaN(timestamp.getTime());

  return (
    <div className="market-identity">
      <div className="market-identity-left">
        <img 
          className="cse-official-logo" 
          src={cseLogo} 
          alt="Colombo Stock Exchange — Creating Wealth and Value" 
        />
        <div className="identity-divider" aria-hidden="true" />
        <div className="exchange-info">
          <span className="exchange-name">Colombo Stock Exchange</span>
          <span className="exchange-location">
            Sri Lanka <span aria-hidden="true">·</span> Listed equities <span aria-hidden="true">·</span> LKR
          </span>
        </div>
      </div>
      <div className="market-dateline">
        {validDate ? (
          <>
            <span className="dateline-date">
              {new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Colombo' }).format(timestamp)}
            </span>
            <span className="dateline-time">
              Updated {new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Colombo' }).format(timestamp)} · Sri Lanka time
            </span>
          </>
        ) : (
          <>
            <span className="dateline-date">Colombo Stock Exchange</span>
            <span className="dateline-time">Market updates in Sri Lanka time</span>
          </>
        )}
      </div>
    </div>
  );
}
