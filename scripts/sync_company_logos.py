"""Bundle public CSE issuer logos locally; run from the repository root."""
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "frontend/src/assets/company-logos"
CDN = "https://cdn.cse.lk/cmt/"


def main():
    response = requests.post("https://www.cse.lk/api/tradeSummary", json={}, timeout=30)
    response.raise_for_status()
    issuers = {}
    for item in response.json()["reqTradeSummery"]:
        symbol = item["symbol"].split(".")[0]
        if item.get("logoUrl") and re.fullmatch(r"[A-Z0-9]+", symbol):
            issuers[symbol] = item
    DEST.mkdir(parents=True, exist_ok=True)
    manifest_path = DEST / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

    def download(entry):
        symbol, item = entry
        url = urljoin(CDN, item["logoUrl"])
        if urlparse(url).hostname != "cdn.cse.lk":
            return symbol, None
        try:
            image = requests.get(url, timeout=20)
            image.raise_for_status()
            content_type = image.headers.get("Content-Type", "").split(";")[0]
            suffix = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}.get(content_type)
            if not suffix or not image.content:
                return symbol, None
            filename = symbol + suffix
            (DEST / filename).write_bytes(image.content)
            return symbol, {"file": filename, "name": item["name"], "source": url}
        except requests.RequestException as error:
            print(f"Logo unavailable for {symbol}: {type(error).__name__}", flush=True)
            return symbol, None

    with ThreadPoolExecutor(max_workers=10) as pool:
        for symbol, entry in pool.map(download, issuers.items()):
            if entry:
                manifest[symbol] = entry
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Bundled {len(manifest)} issuer logos from the official CSE CDN.", flush=True)


if __name__ == "__main__":
    main()
