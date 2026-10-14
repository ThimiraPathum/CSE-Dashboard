from pathlib import Path
import json
import numpy as np
import pandas as pd
import joblib
from xgboost import XGBClassifier


class AlphaIQModel:

    def __init__(self, model_dir=None):

        folder = (
            Path(model_dir)
            if model_dir is not None
            else Path(__file__).resolve().parent
        )

        with (folder / "config.json").open(
            encoding="utf-8"
        ) as f:
            self.config = json.load(f)

        self.prep = joblib.load(
            folder / "preprocessor.joblib"
        )

        self.calibrators = joblib.load(
            folder / "calibrators.joblib"
        )

        self.full = XGBClassifier()
        self.full.load_model(
            str(folder / "full34.json")
        )

        self.top25 = XGBClassifier()
        self.top25.load_model(
            str(folder / "top25.json")
        )

        self.features = self.config["features"]

        self.indices = np.asarray(
            self.config["top25_indices"],
            dtype=int
        )

    @staticmethod
    def logit(p):
        p = np.clip(
            np.asarray(p),
            1e-6,
            1 - 1e-6
        )
        return np.log(p / (1 - p))

    def predict(self, feature_dataframe):

        missing = set(self.features) - set(
            feature_dataframe.columns
        )

        if missing:
            raise ValueError(
                "Missing features: "
                + ", ".join(sorted(missing))
            )

        x = (
            feature_dataframe[self.features]
            .apply(pd.to_numeric, errors="coerce")
            .to_numpy(dtype=np.float64)
        )

        x = np.where(
            np.isfinite(x),
            x,
            self.prep["median"]
        )

        x = np.clip(
            x,
            self.prep["low"],
            self.prep["high"]
        )

        x = self.prep["scaler"].transform(x)

        x = np.clip(
            x, -10, 10
        ).astype(np.float32)

        raw34 = self.full.predict_proba(x)[:, 1]

        raw25 = self.top25.predict_proba(
            x[:, self.indices]
        )[:, 1]

        p34 = self.calibrators[
            "FULL34"
        ].predict_proba(
            self.logit(raw34).reshape(-1, 1)
        )[:, 1]

        p25 = self.calibrators[
            "FULL_TOP25"
        ].predict_proba(
            self.logit(raw25).reshape(-1, 1)
        )[:, 1]

        result = pd.DataFrame(
            index=feature_dataframe.index
        )

        for key in ["date", "symbol"]:
            if key in feature_dataframe.columns:
                result[key] = feature_dataframe[key]

        result["p_FULL34"] = p34
        result["p_FULL_TOP25"] = p25

        result["ensemble_p"] = (
            p34 + p25
        ) / 2

        result["above_frozen_threshold"] = (
            result["ensemble_p"]
            >= self.config["threshold"]
        )

        # Score threshold alone is NOT a valid
        # trading signal. Liquidity, market regime,
        # universe readiness, and as-of price-risk
        # filters must be applied separately.

        return result
