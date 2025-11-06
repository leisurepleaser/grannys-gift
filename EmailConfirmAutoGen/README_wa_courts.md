# WA Court Calendar Harvester (case-level leads)

This script pulls **individual case leads** (case number, hearing type, date) from **public daily calendars** and writes a `candidates.csv` your app can use.

## Targets (public pages)
- **King County Superior Court — Criminal Calendars (PDFs)** (Seattle / Kent)  
- **Spokane County — All Hearings by Date (HTML)**

It extracts **case numbers** (e.g., `24-1-12345-34 SEA`), a **hearing type**, a **date**, and a crude **defendant name** if visible in text. It maps `SEA` / `KNT` suffixes to likely agencies (SPD/KCSO/WSP) to help you pick likely **Body‑Worn Camera (BWC)** or **In‑Car Video (ICV)** sources.

> Always respect each site’s Terms of Use and robots.txt. Use the calendars for discovery, and send records requests to the **agencies** (police/sheriff/DOT), not the courts (unless seeking court audio/records).

## Install
```bash
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r requirements_wa_courts.txt
```

## Run (zero extra input)
```bash
python3 wa_court_cal_harvester.py --out candidates.csv --limit 25
```
- Prints **top 25** in Terminal (change with `--limit`, max 50 saved).
- Saves up to **50** scored leads in `candidates.csv` for your generator.

## Output schema (candidates.csv)
`pub_date, source_name, title, url, snippet, score`  
- `title` contains **case number — hearing — defendant** (when parsed).
- `url` points back to the calendar (PDF/HTML).
- `snippet` lists **likely video sources** (SPD, KCSO, WSP).

## Extend it
- To add more WA counties: duplicate a block that fetches a public criminal calendar (PDF/HTML), run regex for case numbers, and append to `leads`.
- For Seattle Municipal Court: use their **Public Portal** search if you have query criteria. Many portals require a name or case number and may have anti-bot protections, so calendars are the most reliable zero‑input signal.

**This is a discovery tool; not legal advice.**
