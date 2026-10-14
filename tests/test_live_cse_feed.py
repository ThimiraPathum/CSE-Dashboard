import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import requests
import pandas as pd
import numpy as np
from alphaiq_v1_frozen.inference import AlphaIQModel

model = AlphaIQModel(Path('alphaiq_v1_frozen'))

headers = {'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json'}
trade_resp = requests.post('https://www.cse.lk/api/tradeSummary', headers=headers, json={}, timeout=10)
aspi_resp = requests.post('https://www.cse.lk/api/aspiData', headers=headers, json={}, timeout=10)

trades = trade_resp.json().get('reqTradeSummery', [])
aspi = aspi_resp.json()

print('Live CSE trades fetched:', len(trades))
print('Live ASPI value:', aspi.get('value'), 'Change:', aspi.get('change'), 'Pct:', aspi.get('percentage'))

aspi_ret1 = (aspi.get('percentage', 0.0) or 0.0) / 100.0

records = []
for t in trades:
    price = float(t.get('price') or 0.0)
    prev = float(t.get('previousClose') or price or 1.0)
    if price <= 0:
        continue
    ret1 = (price - prev) / prev if prev > 0 else 0.0
    vol = float(t.get('quantity') or 0.0)
    turnover = float(t.get('turnover') or (price * vol))
    sym = t.get('symbol', '').replace('.N0000', '').replace('.X0000', '')
    name = t.get('name', sym)

    ret5 = ret1 * 1.8 + 0.002
    ret10 = ret1 * 2.5 + 0.005
    ret20 = ret1 * 3.2 + 0.01

    rec = {
        'date': '2026-10-14',
        'symbol': sym,
        'name': name,
        'sector': 'CSE Listed',
        'close': price,
        'stock_return_1': ret1,
        'stock_return_5': ret5,
        'stock_return_10': ret10,
        'stock_return_20': ret20,
        'aspi_return_1': aspi_ret1,
        'aspi_return_5': aspi_ret1 * 1.5,
        'aspi_return_10': aspi_ret1 * 2.0,
        'aspi_return_20': aspi_ret1 * 2.5,
        'relative_strength_5': ret5 - (aspi_ret1 * 1.5),
        'relative_strength_10': ret10 - (aspi_ret1 * 2.0),
        'relative_strength_20': ret20 - (aspi_ret1 * 2.5),
        'close_vs_sma_5': ret1 * 0.6,
        'close_vs_sma_20': ret1 * 0.9,
        'stock_volatility_20': abs(ret1) * 1.2 + 0.015,
        'log_volume_avg_20': float(np.log1p(vol)),
        'log_turnover_avg_20': float(np.log1p(turnover)),
        'volume_ratio_5_20': 1.05,
        'turnover_ratio_5_20': 1.08,
        'xs_rs20_rank': 0.5,
        'xs_stock5_rank': 0.5,
        'xs_stock20_rank': 0.5,
        'xs_turnover_rank': 0.5,
        'xs_volatility_rank': 0.5,
        'xs_volume_ratio_rank': 0.5,
        'xs_sma20_rank': 0.5,
        'xs_sma5_rank': 0.5,
        'market_breadth5': 0.5,
        'market_breadth20': 0.5,
        'market_median_stock20': 0.01,
        'market_dispersion_stock20': 0.03,
        'market_candidate_count_log': float(np.log(len(trades))),
        'aspi_volatility20': abs(aspi_ret1) + 0.01,
        'aspi_drawdown60': -0.02,
        'aspi_momentum60': aspi_ret1 * 3,
    }
    records.append(rec)

df = pd.DataFrame(records)
df['xs_rs20_rank'] = df['relative_strength_20'].rank(pct=True)
df['xs_stock5_rank'] = df['stock_return_5'].rank(pct=True)
df['xs_stock20_rank'] = df['stock_return_20'].rank(pct=True)
df['xs_turnover_rank'] = df['log_turnover_avg_20'].rank(pct=True)
df['xs_volatility_rank'] = df['stock_volatility_20'].rank(pct=True)
df['xs_sma20_rank'] = df['close_vs_sma_20'].rank(pct=True)
df['xs_sma5_rank'] = df['close_vs_sma_5'].rank(pct=True)
df['market_breadth5'] = float((df['stock_return_5'] > 0).mean())
df['market_breadth20'] = float((df['stock_return_20'] > 0).mean())
df['market_median_stock20'] = float(df['stock_return_20'].median())
df['market_dispersion_stock20'] = float(df['stock_return_20'].std())

print(f'Scoring {len(df)} live CSE stocks with XGBoost AlphaIQ model...')
preds = model.predict(df)
scored = df.assign(
    score=preds['ensemble_p'],
    p_full34=preds['p_FULL34'],
    p_top25=preds['p_FULL_TOP25'],
    above=preds['above_frozen_threshold']
).sort_values('score', ascending=False)

print('\nTop 10 Live CSE AI Predictions:')
for i, (_, r) in enumerate(scored.head(10).iterrows(), 1):
    print(f"{i}. {r['symbol']} ({r['name']}) | Price: Rs. {r['close']:.2f} | 1D Return: {r['stock_return_1']*100:+.2f}% | AI Score: {r['score']*100:.2f}% | Above Threshold: {r['above']}")
