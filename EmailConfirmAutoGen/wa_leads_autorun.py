#!/usr/bin/env python3
"""
WA Leads Autorun
----------------
Usage:
  python3 wa_leads_autorun.py --limit 25
  # Optional flags:
  #   --days 45          (look-back window)
  #   --csv pra_coverage_master.csv
  #   --out candidates.csv
  #   --state Washington (default is Washington; accepts "WA" or full name)

What it does:
- Loads pra_coverage_master.csv, filters to WA
- Auto-discovers RSS/news sources from each row's portal_url (best-effort)
- Crawls those sources, filters out graphic/force incidents
- Looks for BWC/ICV/Video keywords
- Writes candidates.csv and prints top N (default 25, max 50)

Requires: requests, beautifulsoup4, feedparser, tldextract (for clean domains), lxml (optional but faster)
"""
import argparse, csv, os, re, sys, datetime, time
import requests
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
import feedparser
import tldextract

ALLOW = [
    r"\bbody[- ]?worn camera\b",
    r"\bbodycamera\b",
    r"\bbody ?cam\b",
    r"\bbody camera\b",
    r"\bbwc\b",
    r"\bdash[ -]?cam\b",
    r"\bin[- ]?car (?:video|camera)\b",
    r"\bvideo release\b",
    r"\bfootage\b",
    r"\bbody[- ]?worn video\b"
]
DENY = [
    r"\bshooting\b",
    r"\bofficer[- ]?involved\b",
    r"\bfatal(ity)?\b",
    r"\bhomicide\b",
    r"\bkilled\b",
    r"\bdeath\b",
    r"\bgraphic\b",
    r"\bsuicide\b",
    r"\bstabbing\b",
    r"\bmurder\b",
    r"\bdeadly\b",
    r"\bgunfire\b"
]

def comp(patterns):
    return [re.compile(p, re.I) for p in patterns]

ALLOW_RX = comp(ALLOW)
DENY_RX  = comp(DENY)

def recent_enough(dt, days):
    if not dt:
        return True
    try:
        return (datetime.datetime.now(datetime.timezone.utc) - dt).days <= days
    except Exception:
        return True

def parse_date_guess(s):
    if not s:
        return None
    s = s.strip()
    # feedparser returns structured dates sometimes; handle string fallback
    for fmt in ("%a, %d %b %Y %H:%M:%S %Z", "%Y-%m-%d", "%m/%d/%Y", "%b %d, %Y", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.datetime.strptime(s, fmt).replace(tzinfo=datetime.timezone.utc)
        except Exception:
            pass
    return None

def score_item(title, snippet, pub_dt):
    score = 0
    text = f"{title} {snippet}".lower()
    # allow signals
    if any(rx.search(text) for rx in ALLOW_RX): score += 4
    if "video" in text: score += 1
    if "bwc" in text or "body" in text and "camera" in text: score += 1
    if "dash" in text and "cam" in text: score += 1
    # deny signals reduce heavily
    if any(rx.search(text) for rx in DENY_RX): score -= 6
    # recency
    if pub_dt:
        days = (datetime.datetime.now(datetime.timezone.utc) - pub_dt).days
        if days <= 14: score += 2
        elif days <= 45: score += 1
    return score

def text_ok(title, snippet):
    text = f"{title}\n{snippet}".lower()
    # denylist first
    for rx in DENY_RX:
        if rx.search(text): return False
    # allowlist must hit
    return any(rx.search(text) for rx in ALLOW_RX)

def read_master(csv_path, target_state):
    rows = []
    with open(csv_path, newline='', encoding='utf-8') as f:
        r = csv.DictReader(f)
        for row in r:
            st = (row.get("state","") or "").strip().lower()
            if st in {target_state.lower(), "wa", "washington"}:
                rows.append(row)
    return rows

def clean_domain(url):
    try:
        ext = tldextract.extract(url)
        if not ext.registered_domain:
            return None
        dom = ".".join([p for p in [ext.domain, ext.suffix] if p])
        if ext.subdomain and not ext.subdomain.startswith("www"):
            return ext.subdomain + "." + dom
        return dom if ext.subdomain in ("", "www") else ext.subdomain + "." + dom
    except Exception:
        try:
            return urlparse(url).netloc
        except Exception:
            return None

def guess_sources_for_portal(entity_name, portal_url):
    """Return a list of source dicts to try for this entity."""
    sources = []
    if not portal_url:
        return sources
    parsed = urlparse(portal_url)
    base = f"{parsed.scheme}://{parsed.netloc}/"
    domain = parsed.netloc.lower()

    # 1) Common WordPress feed pattern
    sources.append({"type":"rss", "name": f"{entity_name} — auto /feed/", "url": urljoin(base, "feed/")})

    # 2) Home page: look for <link rel='alternate' type='application/rss+xml'>
    sources.append({"type":"discover_rss", "name": f"{entity_name} — discover rss", "url": base})

    # 3) Heuristic news locations
    for path in ["news", "press", "media", "blotter", "updates", "blog"]:
        sources.append({"type":"html_list", "name": f"{entity_name} — {path}", "url": urljoin(base, path)})

    return sources

def fetch_rss(url):
    d = feedparser.parse(url)
    items = []
    for e in d.entries:
        pub = None
        if getattr(e, "published_parsed", None):
            pub = datetime.datetime.fromtimestamp(time.mktime(e.published_parsed), tz=datetime.timezone.utc)
        elif getattr(e, "updated_parsed", None):
            pub = datetime.datetime.fromtimestamp(time.mktime(e.updated_parsed), tz=datetime.timezone.utc)
        else:
            pub = parse_date_guess(e.get("published") or e.get("updated") or "")
        items.append({
            "title": e.get("title",""),
            "link": e.get("link",""),
            "snippet": e.get("summary","") or e.get("description","") or "",
            "pub_dt": pub
        })
    return items

def discover_rss(home_url):
    items = []
    try:
        resp = requests.get(home_url, timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        for link in soup.select("link[rel='alternate'][type='application/rss+xml']"):
            href = link.get("href")
            if href:
                # Follow and read those feeds
                items.extend(fetch_rss(urljoin(home_url, href)))
    except Exception:
        pass
    return items

def fetch_html_list(url):
    items = []
    try:
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        # Try common article containers
        articles = soup.select("article") or soup.select(".news-item, .post, .entry, .teaser, .list-item, .media, .card")
        for a in articles[:100]:
            # title + link
            t = ""
            l = ""
            h = a.find(["h1","h2","h3","h4"])
            if h:
                t = h.get_text(strip=True)
                if h.find("a"):
                    l = h.find("a").get("href") or ""
            if not t:
                # fallback: first link text
                link = a.find("a")
                if link:
                    t = link.get_text(strip=True)
                    l = link.get("href") or ""
            # snippet
            snip = a.get_text(separator=" ", strip=True)
            snip = (snip or "")[:400]
            if t or l:
                items.append({"title": t, "link": urljoin(url, l), "snippet": snip, "pub_dt": None})
    except Exception:
        pass
    return items

def main():
    ap = argparse.ArgumentParser(description="Auto-find non-graphic BWC/ICV candidates for WA using pra_coverage_master.csv")
    ap.add_argument("--csv", default="pra_coverage_master.csv", help="Path to pra_coverage_master.csv")
    ap.add_argument("--state", default="Washington", help="Filter by state name or postal code (WA)")
    ap.add_argument("--days", type=int, default=45, help="Look-back window (days)")
    ap.add_argument("--limit", type=int, default=25, help="Max results to print (<= 50)")
    ap.add_argument("--out", default="candidates.csv", help="Output CSV path")
    args = ap.parse_args()

    if args.limit > 50:
        args.limit = 50

    if not os.path.exists(args.csv):
        print(f"Could not find {args.csv} in current directory. Place it next to this script.")
        sys.exit(1)

    master = read_master(args.csv, args.state)
    if not master:
        print("No WA rows found in pra_coverage_master.csv")
        sys.exit(1)

    # Build list of sources from portal_url per entity
    all_sources = []
    for row in master:
        ent = (row.get("entity_name") or "").strip()
        portal = (row.get("portal_url") or "").strip()
        # Skip if no portal_url — still could try but portal is the best entry
        srcs = guess_sources_for_portal(ent, portal) if portal else []
        # Curated overrides for known entities (best-effort)
        en_l = ent.lower()
        if "seattle police" in en_l:
            all_sources.append({"type":"rss","name":f"{ent} — SPD Blotter","url":"https://spdblotter.seattle.gov/feed/"})
        if "port of seattle police" in en_l:
            # Try site root + /news
            all_sources.append({"type":"html_list","name":f"{ent} — News","url":"https://www.portseattle.org/news"})
        if "king county sheriff" in en_l:
            all_sources.append({"type":"html_list","name":f"{ent} — News","url":"https://kingcounty.gov/en/dept/sheriff/news"})
        if "tacoma police" in en_l:
            all_sources.append({"type":"html_list","name":f"{ent} — News","url":"https://www.cityoftacoma.org/government/city_departments/police"})
        if "spokane police" in en_l:
            all_sources.append({"type":"html_list","name":f"{ent} — News","url":"https://my.spokanecity.org/police/news/"})
        # Add the heuristic ones
        all_sources.extend(srcs)

    # Crawl and collect items
    seen = set()
    items = []
    for s in all_sources:
        stype = s["type"]
        url = s["url"]
        name = s["name"]
        try:
            if stype == "rss":
                fetched = fetch_rss(url)
            elif stype == "discover_rss":
                fetched = discover_rss(url)
            elif stype == "html_list":
                fetched = fetch_html_list(url)
            else:
                fetched = []
        except Exception:
            fetched = []
        for it in fetched:
            title = it.get("title","").strip()
            snippet = it.get("snippet","").strip()
            link = it.get("link","").strip()
            pub_dt = it.get("pub_dt")
            # Filter
            if not text_ok(title, snippet):
                continue
            if not recent_enough(pub_dt, args.days):
                continue
            # Dedup by link or title
            key = (link or title).lower()
            if key and key in seen:
                continue
            seen.add(key)
            sc = score_item(title, snippet, pub_dt)
            items.append({
                "source_name": name,
                "title": title,
                "url": link,
                "snippet": snippet,
                "pub_date": pub_dt.isoformat() if pub_dt else "",
                "score": sc
            })

    # Sort and limit
    items.sort(key=lambda x: (x["score"], x["pub_date"]), reverse=True)
    topn = items[:args.limit]

    # Write candidates.csv
    cols = ["pub_date","source_name","title","url","snippet","score"]
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in items[:min(len(items), 50)]:
            w.writerow({k: r.get(k,"") for k in cols})

    # Print to terminal
    print(f"\nTop {len(topn)} lead(s) (max {args.limit}, overall capped at 50 in CSV):\n")
    for i, r in enumerate(topn, 1):
        date = r["pub_date"] or " "
        print(f"{i:>2}. [{date}] {r['title']}\n    {r['source_name']}\n    {r['url']}\n    score={r['score']}\n")

    print(f"Saved candidates to: {args.out}")
    print("Next step (optional): generate emails from candidates using your existing generator.")
if __name__ == "__main__":
    main()
