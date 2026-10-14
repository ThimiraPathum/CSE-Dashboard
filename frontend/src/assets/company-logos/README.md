These issuer logos were downloaded from the official Colombo Stock Exchange's
public tradeSummary data and CDN. `manifest.json` records each company name and
original image URL. Logos remain the property of their respective owners.

Run `python scripts/sync_company_logos.py` from the project root to refresh them.
Vite bundles the images locally; the UI makes no third-party logo requests.
An unavailable or failed image falls back to the company symbol.
