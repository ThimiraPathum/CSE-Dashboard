/**
 * API client for the CSE AlphaIQ Dashboard backend.
 */

const BASE_URL = '';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, options);
  } catch {
    throw new Error('Cannot reach the dashboard server. Check that the backend is running on port 8000.');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail || `Request failed (${response.status}). Please try again.`);
  }
  if (!payload) {
    throw new Error('The server returned an unreadable response. Restart the dashboard.');
  }
  return payload;
}

export const api = {
  // Health & Model
  health: () => request('/api/health'),
  model: () => request('/api/model'),

  // Predictions
  demo: () => request('/api/demo'),
  predict: (file, universeConfirmed) => {
    const form = new FormData();
    form.append('file', file);
    form.append('universe_confirmed', universeConfirmed ? 'true' : 'false');
    return request('/api/predict', { method: 'POST', body: form });
  },
  predictLive: () => request('/api/market/predict-live'),

  // Live Market Data
  liveMarket: () => request('/api/market/live'),
  marketSummary: () => request('/api/market/summary'),
  stockHistory: (symbol, period = '6mo') => request(`/api/market/history/${symbol}?period=${period}`),
  universe: () => request('/api/market/universe'),

  // Template CSV
  templateUrl: '/api/template.csv',
};

/**
 * Create a WebSocket connection for real-time market updates.
 */
export function createMarketSocket(onMessage, onError) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  let ws;
  let reconnectTimer;
  let stopped = false;

  function connect() {
    if (stopped) return;
    ws = new WebSocket(`${protocol}://${host}/ws/market`);

    ws.onmessage = (event) => {
      if (stopped) return;
      try {
        onMessage(JSON.parse(event.data));
      } catch (e) {
        console.error('WebSocket parse error:', e);
      }
    };

    ws.onerror = (event) => {
      if (stopped) return;
      console.error('WebSocket error:', event);
      onError?.(event);
    };

    ws.onclose = () => {
      if (stopped) return;
      onError?.();
      reconnectTimer = setTimeout(connect, 5000);
    };
  }

  connect();

  return {
    close() {
      stopped = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
