#!/usr/bin/env python3
"""
Seattle/Kent Court Calendar Autorun → candidates.csv
---------------------------------------------------
Fetches King County Superior Court criminal trial calendars (Seattle & Kent),
parses case numbers, defendant names, hearing types/dates, filters out likely
graphic/violent categories, and writes a ranked candidates.csv (max 50).

Usage:
  python3 seattle_kent_autorun.py --out candidates.csv --limit 25 --days 7
"""
import argparse, csv, datetime, io, re, sys, time
import requests
from bs4 import BeautifulSoup
try:
    from pdfminer.high_level import extract_text
except Exception:
    extract_text = None

KCSC_CRIMINAL_ROOT = "https://kingcounty.gov/en/court/superior-court/courts-jails-legal-system/court-calendars-locations-operations/superior-court-calendars-schedules/criminal"

CASE_RX = re.compile(r"\b(\d{2}-\d{1,2}-\d{5,}-\d{2})\s*(SEA|KNT)\b", re.I)
HEARING_RX = re.compile(r"(?i)\b(arraignment|initial appearance|omnibus|motions|trial|sentencing|bond|competency|plea|review)\b")
NAME_RX = re.compile(r"(?i)(?:State\s+v\.?\s+|vs\.?\s+)([A-Z][A-Za-z'\- ]{1,60})")
DATE_RX = re.compile(r"(?i)\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b.*\b(\d{1,2}/\d{1,2}/\d{2,4}|\w+\s+\d{1,2},\s*\d{4})")
VIOLENT_DENY = re.compile(r"(?i)\b(homicide|murder|manslaughter|rape|sexual|child molest|assault\s*[- ]?1|shooting|gunfire|deadly|fatal)\b")

def fetch(url, timeout=30):
    r = requests.get(url, timeout=timeout, headers={"User-Agent":"Mozilla/5.0 (SEA-KNT autorun)"})
    r.raise_for_status()
    return r

def list_calendar_pdfs():
    """Return candidate PDF links for Seattle & Kent trial calendars from the Criminal Calendars page."""
    resp = fetch(KCSC_CRIMINAL_ROOT)
    soup = BeautifulSoup(resp.text, "html.parser")
    urls = []
    for a in soup.select("a[href]"):
        href = a.get("href","")
        if href.lower().endswith(".pdf") and "criminal-calendar" in href.lower():
            urls.append(href)
    # Prefer specifically named trial calendars if present
    urls = sorted(set(urls))
    # Keep top handful
    return urls[-10:]

def parse_pdf(pdf_bytes):
    """Extract entries from a calendar PDF using pdfminer.six."""
    if not extract_text:
        return []
    text = extract_text(io.BytesIO(pdf_bytes)) or ""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    current_date = ""
    for ln in lines[:60]:
        m = DATE_RX.search(ln)
        if m:
            current_date = m.group(1)
            break
    out = []
    for ln in lines:
        if VIOLENT_DENY.search(ln):
            continue
        m = CASE_RX.search(ln)
        if not m: 
            continue
        case_no = f"{m.group(1)} {m.group(2).upper()}"
        nm = NAME_RX.search(ln)
        name = (nm.group(1).strip() if nm else "")
        hm = HEARING_RX.search(ln)
        hearing = (hm.group(1).title() if hm else "")
        # quick score: trial/plea higher, arraignment lower
        score = 6
        if hearing.lower() == "trial": score += 4
        if hearing.lower() == "plea": score += 2
        if hearing.lower() == "arraignment": score -= 1
        out.append({
            "pub_date": current_date,
            "case_number": case_no,
            "defendant_name": name,
            "hearing_type": hearing,
        })
    # de-dup by case_number + hearing
    seen=set(); dedup=[]
    for r in out:
        key=(r["case_number"]+"|"+r.get("hearing_type","")).lower()
        if key not in seen:
            seen.add(key); dedup.append(r)
    return dedup

def map_agencies(case_number):
    up = (case_number or "").upper()
    if up.endswith("SEA"):
        return "Seattle Police Department; King County Sheriff's Office; Washington State Patrol", "King County Superior Court — Seattle"
    if up.endswith("KNT"):
        return "Kent Police Department; King County Sheriff's Office; Washington State Patrol", "King County Superior Court — Kent"
    return "Local PD/SO; Washington State Patrol", "King County Superior Court"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="candidates.csv")
    ap.add_argument("--limit", type=int, default=25)
    ap.add_argument("--days", type=int, default=7, help="Reserved; some calendars list future dates")
    args = ap.parse_args()
    if args.limit > 50: args.limit = 50

    pdfs = []
    try:
        pdfs = list_calendar_pdfs()
    except Exception as e:
        print(f"[warn] Could not list calendars: {e}")

    leads = []
    for url in pdfs:
        try:
            pdf = fetch(url).content
            rows = parse_pdf(pdf)
            for r in rows:
                agencies, court = map_agencies(r["case_number"])
                # Build snippet and title
                title = f"{r['case_number']} — {r.get('hearing_type','')} — {r.get('defendant_name','')}"
                snippet = f"Calendar entry. Likely video sources: {agencies}."
                # scoring by hearing type already applied
                score = 8
                if r.get('hearing_type','').lower() == 'trial': score += 2
                leads.append({
                    "pub_date": r["pub_date"],
                    "source_name": court,
                    "title": title,
                    "url": url,
                    "snippet": snippet,
                    "score": score
                })
        except Exception as e:
            continue

    # sort + cap
    leads.sort(key=lambda x: (x["score"], x["pub_date"]), reverse=True)
    topn = leads[:args.limit]

    # write candidates.csv (cap 50 overall)
    cols = ["pub_date","source_name","title","url","snippet","score"]
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in leads[:50]:
            w.writerow({k: r.get(k,"") for k in cols})

    print(f"\nTop {len(topn)} lead(s):\n")
    for i, r in enumerate(topn, 1):
        print(f"{i:>2}. [{r['pub_date']}] {r['title']}\n    {r['source_name']}\n    {r['url']}\n    score={r['score']}\n")
    print(f"Saved: {args.out} (up to 50 rows)")

if __name__ == "__main__":
    main()
