# WA Leads Autorun (zero-config runner)

This script requires **no manual configuration** beyond placing it next to your **pra_coverage_master.csv**.

## What it does
- Reads `pra_coverage_master.csv` and filters to Washington (WA).
- Auto‑discovers likely **news/press/RSS** sources from each row’s `portal_url`, plus a few curated WA shortcuts.
- Scans those sources, filters out **graphic/force** incidents, and looks for **Body‑Worn Camera (BWC)** / **In‑Car Video (ICV)** / **video release** signals.
- Ranks by **recency** and **keyword strength**.
- Writes **candidates.csv** (capped at 50) and prints the **top 25** (configurable).

## Install deps (once)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r wa_auto_requirements.txt
```

## Run (no inputs needed)
Place `wa_leads_autorun.py` and `pra_coverage_master.csv` in the same folder, then:
```bash
python3 wa_leads_autorun.py --limit 25
```
- `--limit` defaults to **25**; script caps CSV to **50** results max.
- `--days 45` controls the look‑back window.

## Output
- **Terminal:** a sorted list of your top leads (title, date, link, score).  
- **File:** `candidates.csv` containing up to 50 scored leads.

## Notes
- Source discovery is best‑effort: we try `/feed/`, `<link rel="alternate" type="application/rss+xml">`, and common `news/press/blotter` pages.
- The denylist/allowlist is in the script (search `ALLOW` / `DENY`) — tweak if needed.
- This is a discovery tool; always verify items before submitting a request.
