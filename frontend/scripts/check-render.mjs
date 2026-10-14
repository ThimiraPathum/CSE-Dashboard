import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { default: CompanyLogo, formatCompanyName } = await server.ssrLoadModule('/src/components/CompanyLogo.jsx');
  const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
  assert.match(render(CompanyLogo, { symbol: 'comb.X0000', name: 'Commercial Bank' }), /<img[^>]+COMB/);
  assert.doesNotMatch(render(CompanyLogo, { symbol: 'UNKNOWN' }), /<img/);
  assert.match(render(CompanyLogo, { symbol: '' }), /CSE/);
  assert.equal(formatCompanyName('CARGILLS (CEYLON) PLC', 'CARG'), 'Cargills (Ceylon) PLC');
  assert.equal(formatCompanyName('LOLC HOLDINGS PLC', 'LOLC'), 'LOLC Holdings PLC');
  for (const [component, props] of [
    ['LiveMarket', { liveData: null }],
    ['HeatMap', { liveData: null, dataset: null }],
    ['Sidebar', { activeView: 'market', officialFeed: false, feedLabel: 'Simulated Data' }],
  ]) {
    const { default: Component } = await server.ssrLoadModule(`/src/components/${component}.jsx`);
    const html = render(Component, props);
    assert.ok(html.length > 0);
    if (component === 'Sidebar') {
      assert.match(html, /Simulated Data/);
      assert.doesNotMatch(html, /Feed · Connected/);
    } else assert.match(html, /Market data is unavailable/);
  }
  const { default: LiveMarket } = await server.ssrLoadModule('/src/components/LiveMarket.jsx');
  const html = render(LiveMarket, { liveData: { stocks: [
    { symbol: 'COMB', raw_symbol: 'COMB.X0000', name: 'COMMERCIAL BANK OF CEYLON PLC', close: 200, change: -2, change_pct: -1, volume: 5000, turnover: 1000000, sector: 'Banks' },
  ] } });
  assert.match(html, /COMB · X0000/);
  assert.match(html, /<img[^>]+COMB/);
  console.log('Frontend render checks passed: logos, symbol suffixes, names, empty states, feed status, stock cards.');
} finally {
  await server.close();
}
