"""
Test script to verify server.py endpoints and XGBoost model integration.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
import server

client = TestClient(server.app)

print("1. Testing /api/health...")
h = client.get("/api/health")
print("Health status:", h.status_code, h.json().get("status"))
assert h.status_code == 200

print("2. Testing /api/model...")
m = client.get("/api/model")
print("Model name:", m.json().get("name"), "Features count:", len(m.json().get("feature_details", [])))
assert m.status_code == 200

print("3. Testing /api/demo...")
d = client.get("/api/demo")
print("Demo status:", d.status_code, "Candidates:", d.json().get("count"))
assert d.status_code == 200
assert len(d.json().get("rows", [])) == 24

print("4. Testing /api/market/live...")
live = client.get("/api/market/live")
print("Live prices status:", live.status_code, "Stocks count:", live.json().get("count"))
assert live.status_code == 200

print("5. Testing /api/market/summary...")
summary = client.get("/api/market/summary")
print("Market summary status:", summary.status_code, "ASPI value:", summary.json().get("aspi", {}).get("value"))
assert summary.status_code == 200

print("6. Testing /api/market/predict-live (Real-time XGBoost scoring)...")
pred = client.get("/api/market/predict-live")
print("Predict-live status:", pred.status_code, "Scored stocks:", pred.json().get("count"))
assert pred.status_code == 200
assert len(pred.json().get("rows", [])) > 0
top = pred.json().get("rows", [])[0]
score_pct = top["ensemble_p"] * 100
print(f"Top candidate: {top['symbol']} ({top.get('name')}) - Score: {score_pct:.2f}% - Threshold crossed: {top['above_frozen_threshold']}")

print("\n>>> ALL BACKEND & MODEL PREDICTION CHECKS PASSED PERFECTLY! <<<")
