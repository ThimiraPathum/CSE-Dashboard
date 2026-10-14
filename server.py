"""
CSE AlphaIQ Dashboard — Enhanced Backend API
Serves both the React frontend and the model prediction API,
with live CSE market data from Yahoo Finance.
"""

from __future__ import annotations

import csv
import importlib.metadata
import importlib.util
import io
import json
import math
import re
import threading
import warnings
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

import asyncio
import logging

from backend.market_data import MarketDataService, CSE_UNIVERSE

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("alphaiq")

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "alphaiq_v1_frozen"
WEB_DIR = BASE_DIR / "web"
FRONTEND_DIR = BASE_DIR / "frontend" / "dist"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_ROWS = 5000
MAX_COLUMNS = 128
NUMERIC_PATTERN = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$")
SYMBOL_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9._/-]{0,39}$")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

RESEARCH_WARNINGS = [
    "Experimental research model. Historical 2025 performance was poor; outputs are not validated buy recommendations.",
    "The original trading eligibility, liquidity, market-regime, and price-risk gates are not included or applied. A threshold crossing is only a model score.",
]

with (MODEL_DIR / "config.json").open(encoding="utf-8") as config_file:
    CONFIG = json.load(config_file)
with (MODEL_DIR / "verification.json").open(encoding="utf-8") as verification_file:
    VERIFICATION_REPORT = json.load(verification_file)

FEATURES = tuple(CONFIG["features"])
FEATURE_DESCRIPTIONS = {
    "stock_return_1": "Stock return over 1 session.",
    "stock_return_5": "Stock return over 5 sessions.",
    "stock_return_10": "Stock return over 10 sessions.",
    "stock_return_20": "Stock return over 20 sessions.",
    "aspi_return_1": "ASPI return over 1 session.",
    "aspi_return_5": "ASPI return over 5 sessions.",
    "aspi_return_10": "ASPI return over 10 sessions.",
    "aspi_return_20": "ASPI return over 20 sessions.",
    "relative_strength_5": "Stock performance relative to ASPI over 5 sessions.",
    "relative_strength_10": "Stock performance relative to ASPI over 10 sessions.",
    "relative_strength_20": "Stock performance relative to ASPI over 20 sessions.",
    "close_vs_sma_5": "Closing price position relative to the 5-session simple moving average.",
    "close_vs_sma_20": "Closing price position relative to the 20-session simple moving average.",
    "stock_volatility_20": "Stock price volatility over 20 sessions.",
    "log_volume_avg_20": "Log-transformed average trading volume over 20 sessions.",
    "log_turnover_avg_20": "Log-transformed average turnover over 20 sessions.",
    "volume_ratio_5_20": "Ratio comparing 5-session and 20-session average trading volume.",
    "turnover_ratio_5_20": "Ratio comparing 5-session and 20-session average turnover.",
    "xs_rs20_rank": "Percentile rank of 20-session relative strength across the candidate universe.",
    "xs_stock5_rank": "Percentile rank of 5-session stock return across the candidate universe.",
    "xs_stock20_rank": "Percentile rank of 20-session stock return across the candidate universe.",
    "xs_turnover_rank": "Percentile rank of turnover across the candidate universe.",
    "xs_volatility_rank": "Percentile rank of volatility across the candidate universe.",
    "xs_volume_ratio_rank": "Percentile rank of the volume ratio across the candidate universe.",
    "xs_sma20_rank": "Percentile rank of price position relative to the 20-session moving average.",
    "xs_sma5_rank": "Percentile rank of price position relative to the 5-session moving average.",
    "market_breadth5": "Fraction of the candidate universe with positive 5-session stock returns.",
    "market_breadth20": "Fraction of the candidate universe with positive 20-session stock returns.",
    "market_median_stock20": "Median 20-session stock return across the candidate universe.",
    "market_dispersion_stock20": "Dispersion of 20-session stock returns across the candidate universe.",
    "market_candidate_count_log": "Log-transformed count of eligible market candidates.",
    "aspi_volatility20": "ASPI volatility over 20 sessions.",
    "aspi_drawdown60": "ASPI drawdown over 60 sessions.",
    "aspi_momentum60": "ASPI momentum over 60 sessions.",
}

_model: Any = None
_model_attempted = False
_model_error: str | None = None
_model_warnings: list[str] = []
_model_lock = threading.Lock()
_prediction_lock = threading.Lock()

# Market data service
market_service = MarketDataService(cache_ttl_seconds=60)

# WebSocket connections for live updates
ws_connections: list[WebSocket] = []


def runtime_versions() -> dict[str, str | None]:
    packages = {"sklearn": "scikit-learn", "xgboost": "xgboost", "pandas": "pandas", "numpy": "numpy", "joblib": "joblib"}
    result = {}
    for key, package in packages.items():
        try:
            result[key] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            result[key] = None
    return result


def _load_model_once() -> None:
    global _model, _model_attempted, _model_error, _model_warnings
    if _model_attempted:
        return
    with _model_lock:
        if _model_attempted:
            return
        versions = runtime_versions()
        _model_warnings = [
            f"Runtime {package} {versions.get(package) or 'missing'} differs from the bundle's recorded {recorded}; frozen-reference parity has not been reverified in this runtime."
            for package, recorded in CONFIG.get("versions", {}).items()
            if versions.get(package) != recorded
        ]
        try:
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                spec = importlib.util.spec_from_file_location("alphaiq_frozen_inference", MODEL_DIR / "inference.py")
                if spec is None or spec.loader is None:
                    raise RuntimeError("Cannot import the supplied inference module.")
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                model = module.AlphaIQModel(MODEL_DIR)
                import numpy as np
                import pandas as pd

                median = np.asarray(model.prep["median"], dtype=float)
                if median.shape != (len(FEATURES),) or not np.isfinite(median).all():
                    raise ValueError("The bundled preprocessor has invalid feature medians.")
                smoke = model.predict(pd.DataFrame([median], columns=FEATURES))
                values = smoke[["p_FULL34", "p_FULL_TOP25", "ensemble_p"]].to_numpy()
                if not np.isfinite(values).all() or (values < 0).any() or (values > 1).any():
                    raise ValueError("The model did not produce valid probabilities in its startup check.")
                _model = model
            _model_warnings.extend(dict.fromkeys(str(item.message) for item in caught))
        except Exception as exc:
            _model = None
            _model_error = f"Model unavailable: {type(exc).__name__}: {exc}. Check the local dependencies and frozen bundle, then restart the dashboard."
        finally:
            _model_attempted = True


def get_model() -> Any:
    """Load the trusted bundle once; fail explicitly instead of fabricating scores."""
    _load_model_once()
    if _model is None:
        raise HTTPException(status_code=503, detail=_model_error or "The model is unavailable.")
    return _model


def model_status() -> dict[str, Any]:
    _load_model_once()
    return {
        "model_ready": _model is not None,
        "runtime_versions": runtime_versions(),
        "warnings": [*RESEARCH_WARNINGS, *_model_warnings],
        "error": _model_error,
    }


def feature_details() -> list[dict[str, Any]]:
    details = []
    for index, name in enumerate(FEATURES):
        if name.startswith("xs_"):
            group = "Cross-sectional ranks"
        elif name.startswith("aspi_") or name.startswith("market_"):
            group = "Market context"
        elif "volume" in name or "turnover" in name:
            group = "Trading activity"
        else:
            group = "Price and momentum"
        details.append({
            "name": name,
            "label": name.replace("_", " "),
            "group": group,
            "is_top25": name in CONFIG["top25_features"],
            "description": FEATURE_DESCRIPTIONS[name],
            "kind": "original" if index < 18 else "engineered",
        })
    return details


def _finite_number(value: str, column: str, row_number: int) -> float:
    cleaned = value.strip()
    if not NUMERIC_PATTERN.fullmatch(cleaned):
        raise HTTPException(422, f"Row {row_number}: '{column}' must contain a finite number; blanks, NaN, and infinity are not accepted.")
    number = float(cleaned)
    if not math.isfinite(number):
        raise HTTPException(422, f"Row {row_number}: '{column}' must contain a finite number.")
    return number


def parse_csv(raw: bytes):
    """Validate all model inputs before the original preprocessor can coerce them."""
    if not raw:
        raise HTTPException(422, "The CSV file is empty.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "The CSV is too large. Upload a file of 5 MB or less.")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(422, "The CSV must use UTF-8 encoding.") from exc
    if "\x00" in text:
        raise HTTPException(422, "The CSV contains invalid null characters.")
    reader = csv.reader(io.StringIO(text, newline=""), strict=True)
    try:
        header = next(reader, None)
        if not header:
            raise HTTPException(422, "The CSV is empty. Include a header and at least one data row.")
        if len(header) > MAX_COLUMNS:
            raise HTTPException(422, f"The CSV has too many columns. The limit is {MAX_COLUMNS}.")
        if any(not name or name != name.strip() for name in header):
            raise HTTPException(422, "Column headers must be nonempty and have no leading or trailing spaces.")
        if len(set(header)) != len(header):
            raise HTTPException(422, "The CSV contains duplicate column headers.")
        missing = sorted(set(["date", "symbol", *FEATURES]) - set(header))
        if missing:
            raise HTTPException(422, "Missing required columns: " + ", ".join(missing))
        records = []
        seen: set[tuple[str, str]] = set()
        as_of = None
        for row_number, cells in enumerate(reader, start=2):
            if not cells:
                continue
            if len(records) >= MAX_ROWS:
                raise HTTPException(422, f"The CSV has too many rows. The limit is {MAX_ROWS:,}.")
            if len(cells) != len(header):
                raise HTTPException(422, f"Row {row_number} has {len(cells)} cells; the header has {len(header)} columns.")
            raw_record = dict(zip(header, cells))
            as_of_value = raw_record["date"]
            try:
                if not DATE_PATTERN.fullmatch(as_of_value):
                    raise ValueError("Not ISO format")
                date.fromisoformat(as_of_value)
            except ValueError as exc:
                raise HTTPException(422, f"Row {row_number}: 'date' must be a valid ISO date in YYYY-MM-DD format.") from exc
            if as_of is None:
                as_of = as_of_value
            elif as_of != as_of_value:
                raise HTTPException(422, "Upload one complete market-day candidate universe at a time. All rows must use the same as-of date.")
            symbol = raw_record["symbol"].strip().upper()
            if not SYMBOL_PATTERN.fullmatch(symbol):
                raise HTTPException(422, f"Row {row_number}: 'symbol' must be 1-40 letters, digits, dots, underscores, hyphens, or slashes, starting with a letter or digit.")
            key = (as_of_value, symbol)
            if key in seen:
                raise HTTPException(422, f"Row {row_number}: duplicate symbol/date pair for {symbol} on {as_of_value}.")
            seen.add(key)
            record = {name: _finite_number(raw_record[name], name, row_number) for name in FEATURES}
            record.update({"date": as_of_value, "symbol": symbol})
            for field in ["name", "sector"]:
                value = raw_record.get(field, "").strip()
                if len(value) > 200 or any(ord(char) < 32 for char in value):
                    raise HTTPException(422, f"Row {row_number}: '{field}' must be a single-line label of 200 characters or fewer.")
                record[field] = value or None
            raw_close = raw_record.get("close", "").strip()
            record["close"] = _finite_number(raw_close, "close", row_number) if raw_close else None
            records.append(record)
    except csv.Error as exc:
        raise HTTPException(422, f"Invalid CSV format: {exc}.") from exc
    if not records:
        raise HTTPException(422, "The CSV contains a header but no data rows.")
    import pandas as pd

    return pd.DataFrame(records)


def generate_demo_frame(model: Any):
    """Synthetic features for UI exploration; never a purported market snapshot."""
    import numpy as np
    import pandas as pd

    rng = np.random.default_rng(20261014)
    count = 24
    median = np.asarray(model.prep["median"], dtype=float)
    scale = np.asarray(model.prep["scaler"].scale_, dtype=float)
    data = median + rng.normal(0, 0.65, size=(count, len(FEATURES))) * scale
    # Share the synthetic market context across this illustrative universe.
    for index, feature in enumerate(FEATURES):
        if feature.startswith(("market_", "aspi_")):
            data[:, index] = median[index] + 0.15 * scale[index]
    data = np.clip(data, model.prep["low"], model.prep["high"])
    frame = pd.DataFrame(data, columns=FEATURES)
    frame["date"] = "2025-01-02"
    frame["symbol"] = [f"DEMO{index + 1:02}" for index in range(count)]
    frame["name"] = [f"Synthetic company {index + 1:02}" for index in range(count)]
    frame["sector"] = [f"Synthetic group {index % 4 + 1}" for index in range(count)]
    frame["close"] = None
    return frame


def build_prediction_response(frame, source: str, filename: str | None = None, universe_confirmed: bool = False) -> dict[str, Any]:
    import numpy as np

    model = get_model()
    try:
        with _prediction_lock:
            predictions = model.predict(frame)
        values = predictions[["p_FULL34", "p_FULL_TOP25", "ensemble_p"]].to_numpy()
        if len(predictions) != len(frame) or not np.isfinite(values).all() or (values < 0).any() or (values > 1).any():
            raise ValueError("The model returned invalid probabilities.")
    except Exception as exc:
        raise HTTPException(503, f"The model could not score this dataset: {type(exc).__name__}: {exc}") from exc
    rows = []
    for (_, original), (_, prediction) in zip(frame.iterrows(), predictions.iterrows()):
        raw_close = original.get("close")
        close = float(raw_close) if raw_close is not None and math.isfinite(float(raw_close)) else None
        rows.append({
            "symbol": original["symbol"],
            "date": original["date"],
            "name": original.get("name") if isinstance(original.get("name"), str) else None,
            "sector": original.get("sector") if isinstance(original.get("sector"), str) else None,
            "close": close,
            "p_FULL34": float(prediction["p_FULL34"]),
            "p_FULL_TOP25": float(prediction["p_FULL_TOP25"]),
            "ensemble_p": float(prediction["ensemble_p"]),
            "above_frozen_threshold": bool(prediction["above_frozen_threshold"]),
            "input_return_1": float(original["stock_return_1"]),
            "input_return_5": float(original["stock_return_5"]),
            "input_return_20": float(original["stock_return_20"]),
            "features": {name: float(original[name]) for name in FEATURES},
        })
    rows.sort(key=lambda row: (-row["ensemble_p"], row["symbol"]))
    probabilities = [row["ensemble_p"] for row in rows]
    above = sum(row["above_frozen_threshold"] for row in rows)
    result_warnings = [*RESEARCH_WARNINGS, *_model_warnings]
    if source == "demo":
        result_warnings.insert(0, "Synthetic demonstration: fictional DEMO symbols and generated features scored by the actual frozen model. The date is illustrative; this is not live or historical market data.")
    elif source == "live":
        result_warnings.insert(0, "Live market data: features computed from CSE real-time exchange data.")
    elif source == "simulated_fallback":
        result_warnings.insert(0, "Offline simulation fallback: official exchange was unreachable. Generated features used for demonstration, not real market data.")
    else:
        result_warnings.append("Universe completeness and identical as-of feature construction were acknowledged by the uploader; the dashboard cannot independently verify them.")
    return {
        "source": source,
        "is_synthetic": source in ("demo", "simulated_fallback"),
        "is_live": source == "live",
        "filename": filename,
        "as_of": str(frame.iloc[0]["date"]),
        "count": len(rows),
        "threshold": CONFIG["threshold"],
        "model_name": CONFIG["name"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "universe_confirmed": universe_confirmed,
        "risk_gates_applied": False,
        "warnings": result_warnings,
        "summary": {
            "above_threshold": above,
            "below_threshold": len(rows) - above,
            "mean_probability": sum(probabilities) / len(probabilities),
            "max_probability": max(probabilities),
            "min_probability": min(probabilities),
        },
        "rows": rows,
    }


# ─── FastAPI Application ──────────────────────────────────────────────

app = FastAPI(
    title="CeylonQuant — AI-Powered Sri Lankan Stock Market Intelligence",
    version="2.0.0",
    description="CeylonQuant CSE Stock Market Intelligence with Dual XGBoost Machine Learning Models",
    docs_url="/docs",
    redoc_url=None,
)

# CORS for React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def response_headers_and_upload_limit(request: Request, call_next):
    if request.url.path == "/api/predict":
        raw_length = request.headers.get("content-length")
        if raw_length:
            try:
                if int(raw_length) > MAX_UPLOAD_BYTES + 64 * 1024:
                    return JSONResponse({"detail": "The upload is too large. Upload a CSV of 5 MB or less."}, status_code=413)
            except ValueError:
                return JSONResponse({"detail": "Invalid Content-Length header."}, status_code=400)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse({"detail": str(exc.detail)}, status_code=exc.status_code, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(request: Request, exc: RequestValidationError):
    missing = [str(error["loc"][-1]) for error in exc.errors()]
    return JSONResponse({"detail": "Invalid request. Check required fields: " + ", ".join(missing)}, status_code=422)


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse({"detail": "The dashboard could not complete this request. Check the local server output and try again."}, status_code=500)


# ─── Health & Model Endpoints ─────────────────────────────────────────

@app.get("/api/health")
def health():
    state = model_status()
    return {"app": "ceylonquant-dashboard", "legacy_app": "alphaiq-dashboard", "version": "2.0.0", "status": "ok" if state["model_ready"] else "degraded", **state}


@app.get("/api/model")
def model_information():
    return {
        **CONFIG,
        **model_status(),
        "feature_details": feature_details(),
        "verification_report": VERIFICATION_REPORT,
        "verification_note": "Archived bundle verification metadata, not a new validation run or evidence of profitable performance.",
        "limits": {"max_upload_bytes": MAX_UPLOAD_BYTES, "max_rows": MAX_ROWS},
        "risk_gates_applied": False,
    }


# ─── Demo & CSV Prediction Endpoints ──────────────────────────────────

@app.get("/api/demo")
def demo():
    model = get_model()
    return build_prediction_response(generate_demo_frame(model), source="demo")


@app.get("/api/template.csv")
def csv_template():
    output = io.StringIO(newline="")
    csv.writer(output).writerow(["date", "symbol", *FEATURES, "name", "sector", "close"])
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="ceylonquant_feature_template.csv"'})


@app.post("/api/predict")
def predict(file: UploadFile = File(...), universe_confirmed: str = Form("false")):
    try:
        if universe_confirmed != "true":
            raise HTTPException(422, "Confirm that the uploaded file contains the complete market-day candidate universe with the original 34 as-of features prepared before scoring.")
        filename = (file.filename or "upload.csv").replace("\\", "/").split("/")[-1]
        if not filename.lower().endswith(".csv"):
            raise HTTPException(422, "Upload a .csv file containing the original 34 model features.")
        raw = file.file.read(MAX_UPLOAD_BYTES + 1)
        get_model()
        frame = parse_csv(raw)
        return build_prediction_response(frame, source="uploaded", filename=filename[:200], universe_confirmed=True)
    finally:
        file.file.close()


# ─── Live Market Data Endpoints ────────────────────────────────────────

@app.get("/api/market/live")
def live_prices():
    """Get live/simulated prices for all CSE universe stocks."""
    return market_service.get_live_prices()


@app.get("/api/market/summary")
def market_summary():
    """Get ASPI index and market summary."""
    return market_service.get_market_summary()


@app.get("/api/market/history/{symbol}")
def stock_history(symbol: str, period: str = "6mo"):
    """Get historical OHLCV data for a specific stock."""
    allowed_periods = ["1mo", "3mo", "6mo", "1y", "2y"]
    if period not in allowed_periods:
        raise HTTPException(400, f"Period must be one of: {', '.join(allowed_periods)}")
    return market_service.get_historical_data(symbol, period)


@app.get("/api/market/universe")
def market_universe():
    """Get the list of tracked CSE stocks."""
    return {
        "stocks": [
            {"symbol": sym.replace(".CM", ""), "yahoo_symbol": sym, **info}
            for sym, info in CSE_UNIVERSE.items()
        ],
        "count": len(CSE_UNIVERSE),
    }


@app.get("/api/market/predict-live")
def predict_live():
    """
    Compute features from live market data and run XGBoost predictions.
    This is the real-time prediction endpoint.
    """
    import pandas as pd

    model = get_model()

    # Determine whether prices are live official or simulated fallback
    prices_data = market_service.get_live_prices()
    price_source = prices_data.get("source", "cse_official_live")
    is_fallback = (price_source == "simulated_fallback")
    prediction_source = "simulated_fallback" if is_fallback else "live"

    # Compute features for the entire universe
    features_df = market_service.compute_universe_features()

    if features_df is None or features_df.empty:
        raise HTTPException(503, "Could not compute features from live market data. Try again in a moment.")

    return build_prediction_response(features_df, source=prediction_source)


# ─── WebSocket for Real-Time Updates ──────────────────────────────────

@app.websocket("/ws/market")
async def websocket_market(websocket: WebSocket):
    """WebSocket endpoint for real-time market data push."""
    await websocket.accept()
    ws_connections.append(websocket)
    logger.info(f"WebSocket connected. Active connections: {len(ws_connections)}")

    try:
        while True:
            # Send live prices every 30 seconds
            try:
                data = market_service.get_live_prices()
                summary = market_service.get_market_summary()
                await websocket.send_json({
                    "type": "market_update",
                    "prices": data,
                    "summary": summary,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
            except Exception as e:
                logger.error(f"WebSocket send error: {e}")

            await asyncio.sleep(30)
    except WebSocketDisconnect:
        ws_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Active connections: {len(ws_connections)}")
    except Exception as e:
        if websocket in ws_connections:
            ws_connections.remove(websocket)
        logger.error(f"WebSocket error: {e}")


# ─── Serve React Frontend (Production) ─────────────────────────────────

@app.get("/")
def index():
    """Serve the React app's index.html."""
    # Try React build first, then fallback to legacy web dir
    if (FRONTEND_DIR / "index.html").is_file():
        return FileResponse(FRONTEND_DIR / "index.html")
    if (WEB_DIR / "index.html").is_file():
        return FileResponse(WEB_DIR / "index.html")
    raise HTTPException(503, "The dashboard interface is not available. Run 'npm run build' in the frontend directory.")


# Mount static files last (so API routes take priority)
if FRONTEND_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets" if (FRONTEND_DIR / "assets").is_dir() else FRONTEND_DIR), name="frontend_assets")
    app.mount("/static", StaticFiles(directory=WEB_DIR, check_dir=False), name="static")
else:
    app.mount("/static", StaticFiles(directory=WEB_DIR, check_dir=False), name="static")
