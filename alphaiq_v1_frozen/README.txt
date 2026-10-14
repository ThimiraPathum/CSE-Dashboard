CSE AlphaIQ V1 — Frozen Experimental Model

Models: XGBoost FULL34 and TOP25
Probabilities: Platt calibrated, 50/50 ensemble
Historical training: <=2024 only
Validated against 34752 frozen 2025 predictions

Load using:
from inference import AlphaIQModel
model = AlphaIQModel()
scores = model.predict(feature_dataframe)

IMPORTANT:
The input must contain the identical 34 as-of features.
Use a complete market-day candidate universe to build
cross-sectional features before requesting predictions.
Apply original trading eligibility and price-risk gates.
Historical 2025 performance was poor; do not label
these outputs as validated buy recommendations.
