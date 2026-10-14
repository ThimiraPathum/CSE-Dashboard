"""Exercise the real frozen model and the dashboard's upload boundary.

Run from the project folder with: python -m unittest discover -s tests -v
"""

from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd
from fastapi import HTTPException
from fastapi.testclient import TestClient

import app as dashboard
from alphaiq_v1_frozen.inference import AlphaIQModel


MODEL_DIR = Path(__file__).resolve().parents[1] / "alphaiq_v1_frozen"


class DashboardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = AlphaIQModel(MODEL_DIR)
        cls.client_context = TestClient(dashboard.app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_context.__exit__(None, None, None)

    def frame(self):
        frame = pd.DataFrame(
            [self.model.prep["median"].copy(), self.model.prep["median"].copy()],
            columns=self.model.features,
        )
        # Include differing observations to detect row/score misalignment.
        frame.loc[1, "stock_return_20"] = 0.12
        frame.loc[1, "close_vs_sma_20"] = 0.08
        frame.insert(0, "symbol", ["TEST1.N0000", "TEST2.N0000"])
        frame.insert(0, "date", ["2026-10-13", "2026-10-13"])
        return frame

    def upload(self, frame=None, raw=None, confirmed="true"):
        if raw is None:
            raw = (self.frame() if frame is None else frame).to_csv(index=False).encode("utf-8")
        fields = {} if confirmed is None else {"universe_confirmed": confirmed}
        return self.client.post(
            "/api/predict",
            files={"file": ("candidate-features.csv", raw, "text/csv")},
            data=fields,
        )

    def assert_rejected(self, response):
        self.assertIn(response.status_code, (400, 422), response.text)
        payload = response.json()
        self.assertIn("detail", payload)
        self.assertNotIn("rows", payload)
        self.assertNotIn("summary", payload)
        self.assertNotIn("ensemble_p", payload)

    def assert_scores_match_model(self, response, frame):
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        expected = self.model.predict(frame).set_index("symbol")
        actual = {row["symbol"]: row for row in payload["rows"]}
        self.assertEqual(set(actual), set(expected.index))
        self.assertEqual(payload["count"], len(frame))
        self.assertEqual(payload["threshold"], self.model.config["threshold"])
        for symbol, score in expected.iterrows():
            row = actual[symbol]
            for key in ("p_FULL34", "p_FULL_TOP25", "ensemble_p"):
                self.assertAlmostEqual(row[key], float(score[key]), delta=1e-7)
            self.assertEqual(row["above_frozen_threshold"], bool(score["above_frozen_threshold"]))
        return payload

    def test_model_configuration_matches_bundled_estimators(self):
        self.assertEqual(list(self.model.prep["features"]), self.model.features)
        self.assertEqual(
            [self.model.features[i] for i in self.model.indices],
            self.model.config["top25_features"],
        )
        self.assertEqual(self.model.full.n_features_in_, 34)
        self.assertEqual(self.model.top25.n_features_in_, 25)

    def test_health_and_model_metadata_report_real_model(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()["model_ready"])
        metadata = self.client.get("/api/model")
        self.assertEqual(metadata.status_code, 200, metadata.text)
        data = metadata.json()
        self.assertEqual(data["features"], self.model.features)
        self.assertEqual(data["threshold"], self.model.config["threshold"])
        self.assertFalse(data["risk_gates_applied"])

    def test_demo_uses_real_model_and_is_identified_as_synthetic(self):
        frame = dashboard.generate_demo_frame(self.model)
        payload = self.assert_scores_match_model(self.client.get("/api/demo"), frame)
        self.assertEqual(payload["source"], "demo")
        self.assertTrue(payload["is_synthetic"])
        self.assertFalse(payload["risk_gates_applied"])
        self.assertTrue(all(row["symbol"].startswith("DEMO") for row in payload["rows"]))

    def test_complete_csv_returns_original_model_scores(self):
        frame = self.frame()
        payload = self.assert_scores_match_model(self.upload(frame), frame)
        self.assertEqual(payload["source"], "uploaded")
        self.assertFalse(payload["is_synthetic"])
        self.assertTrue(payload["universe_confirmed"])
        self.assertFalse(payload["risk_gates_applied"])
        self.assertEqual(payload["as_of"], "2026-10-13")
        self.assertEqual(payload["summary"]["above_threshold"], sum(
            row["above_frozen_threshold"] for row in payload["rows"]
        ))

    def test_feature_column_order_does_not_change_predictions(self):
        frame = self.frame()
        self.assert_scores_match_model(self.upload(frame[frame.columns[::-1]]), frame)

    def test_utf8_bom_csv_is_supported(self):
        frame = self.frame()
        self.assert_scores_match_model(self.upload(raw=frame.to_csv(index=False).encode("utf-8-sig")), frame)

    def test_optional_labels_and_close_can_be_mixed_with_blanks(self):
        frame = self.frame()
        frame["name"] = ["Example company", ""]
        frame["sector"] = ["", "Example sector"]
        frame["close"] = ["12.50", ""]
        payload = self.assert_scores_match_model(self.upload(frame), frame)
        rows = {row["symbol"]: row for row in payload["rows"]}
        self.assertEqual(rows["TEST1.N0000"]["name"], "Example company")
        self.assertIsNone(rows["TEST1.N0000"]["sector"])
        self.assertEqual(rows["TEST1.N0000"]["close"], 12.5)
        self.assertIsNone(rows["TEST2.N0000"]["name"])
        self.assertEqual(rows["TEST2.N0000"]["sector"], "Example sector")
        self.assertIsNone(rows["TEST2.N0000"]["close"])

    def test_requires_market_universe_confirmation(self):
        for confirmation in (None, "false"):
            with self.subTest(confirmation=confirmation):
                self.assert_rejected(self.upload(confirmed=confirmation))

    def test_requires_file_and_all_input_columns(self):
        self.assert_rejected(self.client.post("/api/predict", data={"universe_confirmed": "true"}))
        for missing in ("symbol", "date", self.model.features[-1]):
            with self.subTest(missing=missing):
                self.assert_rejected(self.upload(self.frame().drop(columns=[missing])))

    def test_rejects_empty_csv_and_header_only_csv(self):
        for raw in (b"", self.frame().head(0).to_csv(index=False).encode()):
            with self.subTest(raw=raw[:30]):
                self.assert_rejected(self.upload(raw=raw))

    def test_rejects_invalid_numeric_features(self):
        for value in ("not-a-number", "", "NaN", "inf", "-inf", "1e999"):
            frame = self.frame()
            frame[self.model.features[0]] = frame[self.model.features[0]].astype(object)
            frame.loc[0, self.model.features[0]] = value
            with self.subTest(value=value):
                self.assert_rejected(self.upload(frame))

    def test_rejects_invalid_or_ambiguous_dates(self):
        for value in ("", "2026-02-30", "13/10/2026", "2026-10-13T00:00:00", "2026-1-3"):
            frame = self.frame()
            frame.loc[0, "date"] = value
            with self.subTest(value=value):
                self.assert_rejected(self.upload(frame))

    def test_rejects_mixed_market_dates(self):
        frame = self.frame()
        frame.loc[1, "date"] = "2026-10-12"
        self.assert_rejected(self.upload(frame))

    def test_rejects_duplicate_symbols_after_normalization(self):
        frame = self.frame()
        frame.loc[1, "symbol"] = " test1.n0000 "
        self.assert_rejected(self.upload(frame))

    def test_rejects_blank_symbols(self):
        frame = self.frame()
        frame.loc[0, "symbol"] = "   "
        self.assert_rejected(self.upload(frame))

    def test_unavailable_model_does_not_return_fabricated_scores(self):
        with patch.object(dashboard, "get_model", side_effect=HTTPException(503, "Model unavailable for test")):
            for response in (self.client.get("/api/demo"), self.upload()):
                self.assertEqual(response.status_code, 503, response.text)
                self.assertIn("detail", response.json())
                self.assertNotIn("rows", response.json())
                self.assertNotIn("summary", response.json())

    def test_inference_failure_does_not_return_fabricated_scores(self):
        with patch.object(dashboard, "get_model", return_value=self.model):
            with patch.object(self.model, "predict", side_effect=RuntimeError("Intentional inference failure")):
                response = self.upload()
        self.assertEqual(response.status_code, 503, response.text)
        self.assertIn("detail", response.json())
        self.assertNotIn("rows", response.json())
        self.assertNotIn("summary", response.json())


if __name__ == "__main__":
    unittest.main()
