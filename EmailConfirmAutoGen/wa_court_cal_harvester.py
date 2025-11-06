#!/usr/bin/env python3
import re, os, csv, sys, argparse, datetime, io, warnings
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

# Optional PDF parsing backends; use pdfminer.six text extraction if available
try:
    from pdfminer.high_level import extract_text
except Exception:
    extract_text = None

KCSC_CRIMINAL_ROOT = "https://kingcounty.gov/en/court/superior-court/courts-jails-legal-system/court-calendars-locations-operations/superior-court-calendars-schedules/criminal"
SPOKANE_ALL_HEARINGS = "https://cp.spokanecounty.org/courtdocumentviewer/publicviewer/AllHearingsByDate.aspx"

def fetch(url, timeout=30):
    r = requests.get(url, timeout=timeout, headers={"User-Agent":"Mozilla/5.0 (harvester)"})
    r.raise_for_status()
    return r

def parse_kcsc_calendar_links():
    """Return list of PDF URLs for Seattle & Kent criminal calendars from the Criminal Calendars page."""
    resp = fetch(KCSC_CRIMINAL_ROOT)
    soup = BeautifulSoup(resp.text, "html.parser")
    pdf_hrefs = []
    for a in soup.select("a[href]"):
        href = a.get("href","")
        if href.lower().endswith(".pdf") and "cdn.kingcounty.gov" in href:
            pdf_hrefs.append(href)
    return sorted(set(pdf_hrefs))

CASE_RX = re.compile(r"(\d{2}-\d-[0-9]{5}-\d{2}\s*-\s*(SEA|KNT)|\d{2}-\d{6,}-\d{2}\s*(SEA|KNT)|\d{2}-\d-[0-9]{5}-\d{2}\s*(SEA|KNT))", re.I)
ALT_CASE_RX = re.compile(r"\b(\d{2}-\d{1,2}-\d{5,}-\d{2})\b", re.I)
NAME_RX = re.compile(r"(?i)(?:State\s+v\.?\s+|vs\.?\s+)([A-Z][A-Za-z'\- ]{1,60})")
HEARING_RX = re.compile(r"(?i)\b(arraignment|initial appearance|omnibus|motions|trial|sentencing|bond|competency|plea)\b")
DATE_RX = re.compile(r"(?i)\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b.*\b(\d{1,2}/\d{1,2}/\d{2,4}|\w+\s+\d{1,2},\s*\d{4})")

def extract_from_pdf_bytes(data):
    """Extract case entries from a PDF bytes blob using pdfminer.six (if present)."""
    if not extract_text:
        return []
    text = extract_text(io.BytesIO(data)) or ""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    cases = []
    current_date = None
    # Try to find a header date in first 50 lines
    for ln in lines[:50]:
        m = DATE_RX.search(ln)
        if m:
            current_date = m.group(1)
            break
    for ln in lines:
        m = CASE_RX.search(ln) or ALT_CASE_RX.search(ln)
        if m:
            case_no = m.group(0).replace("  ", " ").strip()
            nm = NAME_RX.search(ln)
            name = nm.group(1).strip() if nm else ""
            hm = HEARING_RX.search(ln)
            hearing = hm.group(1).title() if hm else ""
            cases.append({
                "case_number": case_no,
                "defendant_name": name,
                "hearing_type": hearing,
                "hearing_date": current_date or "",
                "source": "KCSC Criminal Calendar"
            })
    # crude de-dup by case number
    seen = set()
    dedup = []
    for c in cases:
        key = c["case_number"].lower()
        if key not in seen:
            seen.add(key); dedup.append(c)
    return dedup

def parse_spokane_all_hearings():
    """Scrape Spokane AllHearingsByDate page for today's cases; returns list of dicts."""
    resp = fetch(SPOKANE_ALL_HEARINGS)
    soup = BeautifulSoup(resp.text, "html.parser")
    out = []
    # The page renders a table of hearings with text; extract rows with case numbers patterns like 24-1-xxxxx-xx
    text = soup.get_text("\n", strip=True)
    # Find a date near header
    today = datetime.date.today().isoformat()
    for m in CASE_RX.finditer(text):
        case_no = m.group(0).strip()
        # Heuristic: grab surrounding window of text for name and hearing
        start = max(m.start()-120, 0)
        end = min(m.end()+120, len(text))
        window = text[start:end]
        nm = NAME_RX.search(window)
        name = nm.group(1).strip() if nm else ""
        hm = HEARING_RX.search(window)
        hearing = hm.group(1).title() if hm else ""
        out.append({
            "case_number": case_no,
            "defendant_name": name,
            "hearing_type": hearing,
            "hearing_date": today,
            "source": "Spokane DC/SC All Hearings"
        })
    # de-dup
    seen=set(); dedup=[]
    for c in out:
        key=c["case_number"].lower()
        if key not in seen:
            seen.add(key); dedup.append(c)
    return dedup

def map_jurisdiction(case_number):
    """Map case suffix (SEA/KNT) to likely location and video sources; fallback generic."""
    case_upper = (case_number or "").upper()
    likely = []
    if " SEA" in case_upper or case_upper.endswith("SEA"):
        likely = ["Seattle Police Department (BWC/ICV)", "King County Sheriff's Office (BWC/ICV)", "Washington State Patrol (ICV)"]
        court = "King County Superior Court — Seattle"
    elif " KNT" in case_upper or case_upper.endswith("KNT"):
        likely = ["King County Sheriff's Office (BWC/ICV)", "Kent Police Department (BWC/ICV)", "Washington State Patrol (ICV)"]
        court = "King County Superior Court — Kent"
    else:
        likely = ["Local PD/SO (BWC/ICV)", "Washington State Patrol (ICV)"]
        court = "Washington State Courts"
    return court, "; ".join(likely)

def main():
    ap = argparse.ArgumentParser(description="Harvest WA case leads from public daily calendars (KCSC + Spokane)")
    ap.add_argument("--out", default="candidates.csv", help="Output CSV path")
    ap.add_argument("--limit", type=int, default=25, help="Max leads to print (<=50 written)")
    ap.add_argument("--days", type=int, default=2, help="How many days of KCSC PDFs to consider (0=today only)")
    args = ap.parse_args()
    if args.limit > 50: args.limit = 50

    leads = []

    # 1) King County Superior Court – fetch PDF links
    try:
        pdfs = parse_kcsc_calendar_links()
        # Download and parse up to 'days' worth per calendar. The PDFs are for "tomorrow" usually; we parse what's linked.
        for href in pdfs[:12]:  # cap to avoid excess
            try:
                pdf = fetch(href).content
                cases = extract_from_pdf_bytes(pdf)
                for c in cases:
                    court, likely = map_jurisdiction(c["case_number"])
                    leads.append({
                        "pub_date": c.get("hearing_date",""),
                        "source_name": court,
                        "title": f"{c['case_number']} — {c.get('hearing_type','')} — {c.get('defendant_name','')}",
                        "url": href,
                        "snippet": f"Criminal calendar entry. Likely video sources: {likely}",
                        "score": 10  # calendars are high-signal
                    })
            except Exception as e:
                continue
    except Exception as e:
        print(f"[warn] KCSC fetch failed: {e}")

    # 2) Spokane combined hearings (HTML)
    try:
        spok = parse_spokane_all_hearings()
        for c in spok:
            court, likely = "Spokane County DC/SC — All Hearings", "Spokane Police Department; Spokane County Sheriff's Office; Washington State Patrol"
            leads.append({
                "pub_date": c.get("hearing_date",""),
                "source_name": court,
                "title": f"{c['case_number']} — {c.get('hearing_type','')} — {c.get('defendant_name','')}",
                "url": SPOKANE_ALL_HEARINGS,
                "snippet": f"Daily hearings. Likely video sources: {likely}",
                "score": 8
            })
    except Exception as e:
        print(f"[warn] Spokane fetch failed: {e}")

    # De-dup by URL+title
    seen=set(); dedup=[]
    for r in leads:
        key=(r["url"]+"|"+r["title"]).lower()
        if key not in seen:
            seen.add(key); dedup.append(r)

    # Sort and clip
    dedup.sort(key=lambda x: (x["score"], x["pub_date"]), reverse=True)
    topn = dedup[:args.limit]

    # Write candidates (cap 50 to file)
    cols = ["pub_date","source_name","title","url","snippet","score"]
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in dedup[:50]:
            w.writerow({k:r.get(k,"") for k in cols})

    # Print
    print(f"\nTop {len(topn)} calendar-based case lead(s):\n")
    for i, r in enumerate(topn, 1):
        print(f"{i:>2}. [{r['pub_date']}] {r['title']}\n    {r['source_name']}\n    {r['url']}\n")

    print(f"Saved up to 50 leads to: {args.out}")

if __name__ == "__main__":
    main()
