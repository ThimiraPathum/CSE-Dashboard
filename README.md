<p align="center">
  <img src="assets/ceylonquant-banner.png" alt="CeylonQuant Logo" width="520" />
</p>

<p align="center">
  <strong>AI-Powered Sri Lankan Stock Market Intelligence</strong><br />
  A Full-Stack Quantitative Research & Real-Time Analytics Terminal for the Colombo Stock Exchange (CSE)
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10%2B-blue?style=flat-square&logo=python" alt="Python 3.10+" />
  <img src="https://img.shields.io/badge/FastAPI-2.0.0-009688?style=flat-square&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react" alt="React 18" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/XGBoost-Ensemble-orange?style=flat-square" alt="XGBoost" />
  <img src="https://img.shields.io/badge/Tests-17%2F17%20Passed-brightgreen?style=flat-square" alt="Tests" />
  <img src="https://img.shields.io/badge/Market-Colombo%20(CSE)-102d50?style=flat-square" alt="CSE" />
</p>

---

<p align="center">
  <img src="assets/cse-logo.png" alt="Colombo Stock Exchange — Creating Wealth and Value" width="260" />
</p>

## Overview

**CeylonQuant** is an institutional-grade quantitative equity research and market intelligence terminal engineered specifically for the **Colombo Stock Exchange (CSE)** in Sri Lanka. 

It unifies real-time market data feeds, dynamic technical feature generation, and dual-calibrated **XGBoost machine learning ensembles** to deliver transparent, reproducible candidate screening across all active Sri Lankan equities.

---

## Key Features

### 1. 📈 Live Market Watch
- **280+ Listed CSE Equities**: Instant quotes, volume, turnover, day high/low, and price changes.
- **ASPI Real-Time Tracking**: All Share Price Index tracking with daily point shifts and percentage returns.
- **WebSocket Streaming**: Push-based live market price synchronizer with automatic reconnection and fallback resilience.

### 2. 🗺️ Interactive Market Heatmap
- Visualizes the entire Sri Lankan equity space using hierarchical sector treemaps.
- Dual color modes: Daily Price Performance (% Change) and Quantitative AI Conviction Scores.
- Real-time zoom and sector drill-down across Banking, Tourism, Manufacturing, Energy, and Diversified Holdings.

### 3. ⚡ AI Stock Screener (Dual XGBoost Ensemble)
- **Broad Scan (34 Features — 50% Weight)**: Evaluates complete market structure, breadth, cross-sectional rankings, and historical momentum.
- **Core Signals (25 Features — 50% Weight)**: High-conviction model focused on key technical drivers with redundant features pruned.
- **Combined AI Score**: Platt-calibrated ensemble probability, benchmarked against the calibrated **22.33% conviction threshold**.
- **Deep Feature Transparency**: Click any stock row to inspect all 34 raw and normalized technical inputs.

### 4. 📂 Offline CSV Universe Scoring & Export
- Score custom candidate universes by uploading CSV feature files.
- Built-in validation, input sanitization, and downloadable feature templates (`ceylonquant_feature_template.csv`).
- One-click CSV export of scored candidate datasets.

---

## 34-Feature Quantitative Architecture

CeylonQuant computes 34 engineered technical and cross-sectional features for every security:

| # | Feature Key | Category | Description & Formula |
|---|---|---|---|
| **1** | `stock_return_1` | Short-Term Return | 1-session price percentage change: $(P_t - P_{t-1}) / P_{t-1}$ |
| **2** | `stock_return_5` | Medium Return | 5-session rolling cumulative return |
| **3** | `stock_return_10` | Medium Return | 10-session rolling cumulative return |
| **4** | `stock_return_20` | Monthly Return | 20-session (~1 trading month) rolling cumulative return |
| **5** | `aspi_return_1` | Market Benchmark | 1-session ASPI index percentage return |
| **6** | `aspi_return_5` | Market Benchmark | 5-session ASPI index percentage return |
| **7** | `aspi_return_10` | Market Benchmark | 10-session ASPI index percentage return |
| **8** | `aspi_return_20` | Market Benchmark | 20-session ASPI index percentage return |
| **9** | `relative_strength_5` | Relative Alpha | Stock 5-session return minus ASPI 5-session return |
| **10** | `relative_strength_10` | Relative Alpha | Stock 10-session return minus ASPI 10-session return |
| **11** | `relative_strength_20` | Relative Alpha | Stock 20-session return minus ASPI 20-session return |
| **12** | `close_vs_sma_5` | Trend Deviation | Relative distance of price from 5-day Simple Moving Average |
| **13** | `close_vs_sma_20` | Trend Deviation | Relative distance of price from 20-day Simple Moving Average |
| **14** | `stock_volatility_20` | Risk / Dispersion | 20-session annualized standard deviation of daily returns |
| **15** | `log_volume_avg_20` | Liquidity | $\ln(1 + \text{mean volume}_{20})$ over past 20 trading sessions |
| **16** | `log_turnover_avg_20` | Liquidity | $\ln(1 + \text{mean turnover}_{20})$ over past 20 trading sessions |
| **17** | `volume_ratio_5_20` | Volume Surge | Ratio of 5-day average volume to 20-day average volume |
| **18** | `turnover_ratio_5_20` | Capital Flow | Ratio of 5-day average turnover to 20-day average turnover |
| **19** | `xs_rs20_rank` | Cross-Sectional | Percentile rank of 20-day Relative Strength across the active universe $[0, 1]$ |
| **20** | `xs_stock5_rank` | Cross-Sectional | Percentile rank of 5-day stock return across the universe $[0, 1]$ |
| **21** | `xs_stock20_rank` | Cross-Sectional | Percentile rank of 20-day stock return across the universe $[0, 1]$ |
| **22** | `xs_turnover_rank` | Cross-Sectional | Percentile rank of trading turnover across the universe $[0, 1]$ |
| **23** | `xs_volatility_rank` | Cross-Sectional | Percentile rank of return volatility across the universe $[0, 1]$ |
| **24** | `xs_volume_ratio_rank`| Cross-Sectional | Percentile rank of 5/20 volume expansion ratio $[0, 1]$ |
| **25** | `xs_sma20_rank` | Cross-Sectional | Percentile rank of SMA-20 deviation across the universe $[0, 1]$ |
| **26** | `xs_sma5_rank` | Cross-Sectional | Percentile rank of SMA-5 deviation across the universe $[0, 1]$ |
| **27** | `market_breadth5` | Market Regime | Percentage of CSE universe stocks with positive 5-day return |
| **28** | `market_breadth20` | Market Regime | Percentage of CSE universe stocks with positive 20-day return |
| **29** | `market_median_stock20` | Market Regime | Median 20-day return across all active equities |
| **30** | `market_dispersion_stock20` | Market Regime | Cross-sectional standard deviation of 20-day returns |
| **31** | `market_candidate_count_log` | Universe Depth | $\ln(\text{number of eligible securities})$ in the trading session |
| **32** | `aspi_volatility20` | Macro Volatility | 20-session standard deviation of ASPI index returns |
| **33** | `aspi_drawdown60` | Macro Drawdown | Maximum drawdown percentage of ASPI over preceding 60 trading days |
| **34** | `aspi_momentum60` | Macro Trend | 60-session rate of change of the benchmark index |

---

## Quantitative Verification & Model Integrity Audit

A comprehensive mathematical and computational audit of the model pipelines verified the system against the original CSE research data:

- **Mathematical Inference Parity**: Verified with `verify_xgboost.py`. Direct model calculation matches server API outputs with **$0.0$ Mean Absolute Error**.
- **Dynamic Historical Feature Computation**: Rolling returns, moving averages, and volatility windows are dynamically extracted from historical price records (`stock_prices.csv`).
- **Truthful Data Provenance**: If live exchange connections are unreachable, simulated fallbacks are explicitly tagged (`is_live = False`, `is_synthetic = True`), ensuring simulated data is never presented as live exchange feeds.
- **Duplicate Ticker Resolution**: Non-voting share classes (e.g., `COMB.N0000` vs `COMB.X0000`) are mapped distinctly as `COMB` and `COMB.X`, preventing duplicate key collisions.
- **Automated Test Coverage**: 17 unit tests in `tests/test_app.py` pass cleanly, covering file validation, out-of-order column robustness, probability boundaries, and payload size constraints.

---

## Project Structure

```
CSE Dashboard/
├── assets/                          # Official brand assets & logos
│   ├── ceylonquant-banner.png       # High-res CeylonQuant brand lockup
│   ├── ceylonquant-icon.png         # 3D metallic CQ emblem
│   └── cse-logo.png                 # Official Colombo Stock Exchange logo
│
├── alphaiq_v1_frozen/               # Frozen trained model bundle
│   ├── config.json                  # 34-feature contract & 22.33% threshold
│   ├── model.joblib                 # Calibrated XGBoost models (FULL34 & TOP25)
│   ├── prep.joblib                  # Column transformers, imputers & scalers
│   ├── verification.json            # Reference parity audit baseline
│   └── inference.py                 # Core model inference engine
│
├── backend/                         # Backend Python services
│   ├── __init__.py
│   └── market_data.py               # Live CSE feed client & feature builder
│
├── frontend/                        # Modern React 18 + Vite UI
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx          # CeylonQuant brand navigation drawer
│   │   │   ├── MarketIdentity.jsx   # Official CSE logo & Sri Lanka dateline
│   │   │   ├── LiveMarket.jsx       # Real-time equity watch table
│   │   │   ├── HeatMap.jsx          # Interactive market treemap
│   │   │   ├── Screener.jsx         # AI Stock Screener & candidate ranking
│   │   │   ├── Overview.jsx         # ASPI overview & ensemble architecture
│   │   │   ├── ModelExplorer.jsx    # Complete feature catalog & weights
│   │   │   └── CompanyLogo.jsx      # Curated brand badges for CSE equities
│   │   ├── App.jsx                  # Main application state & real-time sync
│   │   └── index.css                # Polished institutional dark/light theme
│   ├── index.html                   # HTML entry with CeylonQuant metadata
│   └── vite.config.js               # Proxy configuration (/api and /ws)
│
├── server.py                        # Enhanced FastAPI production server
├── start-dashboard.cmd              # One-click Windows starter script
├── start-dashboard.ps1              # PowerShell startup orchestrator
├── scripts/
│   └── verify_xgboost.py            # Comprehensive 14-point audit script
├── tests/
│   └── test_app.py                  # Unit and integration test suite
└── requirements.txt                 # Python dependencies
```

---

## Quick Start (Windows)

### 1. One-Click Launch

Run the included launcher in PowerShell or double-click `start-dashboard.cmd`:

```powershell
.\start-dashboard.cmd
```

The application will start the backend, verify the XGBoost ensemble, and open your browser at **http://127.0.0.1:8000**.

> **First-time setup:** Run `.\start-dashboard.cmd -Setup` to automatically install all dependencies.

### 2. Manual Launch (Production Build)

```powershell
# Activate your Python virtual environment if applicable
python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

### 3. Developer Mode (Vite Hot Module Replacement)

For UI development with instant hot reloading:

```powershell
# Terminal 1: Backend API
python -m uvicorn server:app --host 127.0.0.1 --port 8000

# Terminal 2: Vite Dev Server
cd frontend
npm run dev
```

Navigate to **http://localhost:5173**. Vite proxies all `/api` and `/ws` calls directly to port 8000.

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/` | `GET` | Serves compiled CeylonQuant React application |
| `/api/health` | `GET` | System health, model readiness, and library versions |
| `/api/model` | `GET` | XGBoost ensemble metadata, thresholds, and feature catalog |
| `/api/template.csv` | `GET` | Download official 34-feature CSV template |
| `/api/predict` | `POST` | Upload CSV candidate dataset for offline XGBoost scoring |
| `/api/market/live` | `GET` | Latest real-time equity quotes from CSE |
| `/api/market/summary` | `GET` | ASPI index performance, turnover, and market breadth |
| `/api/market/predict-live`| `GET` | Compute 34 live features and score all active equities |
| `/api/market/history/{sym}`| `GET` | Historical OHLCV price series for a given ticker |
| `/ws/market` | `WebSocket` | Real-time streaming market prices and ASPI updates |

---

## Testing & Verification

Run the automated test suite:

```powershell
python -m pytest
```

Execute the full 14-point mathematical and model verification check:

```powershell
python scripts/verify_xgboost.py
```

---

## Disclaimer

**CeylonQuant** is an independent quantitative research, educational, and analytical platform. Outputs generated by machine learning models represent statistical inferences based on historical price and volume behavior and **do not constitute financial advice, buy/sell recommendations, or investment endorsements**. Always consult a licensed investment advisor before trading on the Colombo Stock Exchange.
