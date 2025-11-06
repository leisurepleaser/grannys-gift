#!/usr/bin/env python3
"""
Generate PRA emails from candidates.csv by joining with pra_coverage_master.csv
(Updated for SEA/KNT case mapping to SPD/Kent PD/KCSO/WSP)
"""
import csv, os, re, argparse, datetime, sys

def slugify(s):
    import re
    s = s.strip().lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = re.sub(r'-+', '-', s).strip('-')
    return s or "email"

def read_csv(path):
    with open(path, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))

def first(s, fallback=""):
    return (s or "").strip() or fallback

CASE_TOK = re.compile(r"\b(\d{2}-\d{1,2}-\d{5,}-\d{2})\s*(SEA|KNT)\b", re.I)

def pick_best_entity(master_rows, want_names):
    """Return the first master row whose entity_name matches one of want_names (case-insensitive)."""
    by_name = { (m.get("entity_name","") or "").strip().lower(): m for m in master_rows }
    for wn in want_names:
        if (wn or "").strip().lower() in by_name:
            return by_name[wn.strip().lower()]
    # else return any WSP/KCSO fallback
    for alt in ["Washington State Patrol","King County Sheriff's Office"]:
        if alt.lower() in by_name:
            return by_name[alt.lower()]
    return None

TEMPLATE = """Subject: Public Records Request — {entity_name} — {state} — Non‑Graphic Video (Case {case_number})

Hello Public Records Officer,

I am requesting records under the {state} Public Records Act (open‑records law).

Authority: {legal_basis_citation} — {legal_basis_url}

Records requested (non‑graphic video suitable for public release):
• Body‑Worn Camera (BWC) video
• In‑Car Video (ICV / dash‑cam) footage
• Any corresponding incident or CAD/dispatch logs that facilitate locating the footage

Case reference:
• Court: {court_name}
• Case number: {case_number}
• Defendant: {defendant}
• Hearing type/date on calendar: {hearing_type} / {pub_date}
• Please search for responsive video related to the underlying incident(s) associated with this case.

Notes: {video_policy_notes}

Format: Please provide electronic copies via download link or portal production. If redactions are necessary, please apply the narrowest possible scope and identify each exemption relied upon.

Fees: {fee_policy_summary}
{fee_waiver_line}

{ack_line}{portal_line}

Contact: Please reply with any questions or to clarify search parameters.

Thank you,

{requester_name}
CrimeFootageRecap (news/editorial channel — non‑graphic footage)
{requester_email} | {requester_phone}
{requester_address}
"""

def main():
    ap = argparse.ArgumentParser(description="Generate PRA email from candidates.csv + pra_coverage_master.csv")
    ap.add_argument("--candidates", "-c", default="candidates.csv")
    ap.add_argument("--master", "-m", default="pra_coverage_master.csv")
    ap.add_argument("--pick", "-p", type=int, help="1-based candidate index to generate")
    ap.add_argument("--out", "-o", default="out_emails")
    ap.add_argument("--requester-name", default="[Your Name]")
    ap.add_argument("--requester-email", default="[your@email]")
    ap.add_argument("--requester-phone", default="[your phone]")
    ap.add_argument("--requester-address", default="")
    args = ap.parse_args()

    cands = read_csv(args.candidates)
    if not cands:
        print("No candidates found.")
        sys.exit(1)

    print("\nCandidates:")
    for i, r in enumerate(cands, 1):
        print(f"{i:>3}. {r.get('pub_date','')}  {r.get('source_name','')}  {r.get('title','')[:100]}")

    sel = args.pick
    if not sel:
        try:
            sel = int(input("\nPick a candidate #: ").strip())
        except Exception:
            print("Invalid selection."); sys.exit(1)

    if sel < 1 or sel > len(cands):
        print("Out of range."); sys.exit(1)

    cand = cands[sel-1]
    title = cand.get("title","")
    court_name = cand.get("source_name","")
    pub_date = cand.get("pub_date","")

    m = CASE_TOK.search(title)
    case_number = m.group(1) + " " + m.group(2).upper() if m else "[unknown]"
    suffix = (m.group(2).upper() if m else "")
    defendant = "[unknown]"
    # try to grab defendant name after last '—'
    if "—" in title:
        parts = [p.strip() for p in title.split("—")]
        if parts: defendant = parts[-1]

    # Map SEA/KNT to likely entities (preferred order)
    want_entities = []
    if suffix == "SEA":
        want_entities = ["Seattle Police Department", "King County Sheriff's Office", "Washington State Patrol"]
    elif suffix == "KNT":
        want_entities = ["Kent Police Department", "King County Sheriff's Office", "Washington State Patrol"]
    else:
        want_entities = ["Washington State Patrol", "King County Sheriff's Office"]

    master = read_csv(args.master)
    ent = pick_best_entity(master, want_entities)
    if not ent:
        print("Could not find a matching entity in pra_coverage_master.csv; using Washington State Patrol defaults.")
        ent = {
            "state": "Washington",
            "entity_name": want_entities[0] if want_entities else "Washington State Patrol",
            "legal_basis_citation": "RCW 42.56",
            "legal_basis_url": "https://app.leg.wa.gov/rcw/default.aspx?cite=42.56",
            "video_policy_notes": "Please process under your standard video disclosure/redaction practices.",
            "fee_policy_summary": "Please advise of any duplication costs in advance.",
            "fee_waiver_standard": "",
            "response_deadline_days": "5",
            "portal_url": "",
            "request_email": ""
        }

    state = first(ent.get("state"), "Washington")
    entity_name = first(ent.get("entity_name"), want_entities[0])
    legal_basis_citation = first(ent.get("legal_basis_citation"), "RCW 42.56")
    legal_basis_url = first(ent.get("legal_basis_url"), "https://app.leg.wa.gov/rcw/default.aspx?cite=42.56")
    video_policy_notes = first(ent.get("video_policy_notes"), "Please process under your standard video disclosure/redaction practices.")
    fee_policy_summary = first(ent.get("fee_policy_summary"), "Please advise of any duplication costs in advance.")
    fee_waiver_standard = first(ent.get("fee_waiver_standard"))
    response_deadline_days = first(ent.get("response_deadline_days"))
    portal_url = first(ent.get("portal_url"))
    req_email = first(ent.get("request_email"))

    ack_line = (f"I understand your office acknowledges requests within approximately {response_deadline_days} business days; if additional time is needed, please provide an anticipated schedule.\n"
                if response_deadline_days else
                "If additional time is needed to process this request, please provide an anticipated schedule.\n")
    fee_waiver_line = (f"If available under your policy, I request a public‑interest fee waiver. {fee_waiver_standard}"
                       if fee_waiver_standard else
                       "If available under your policy, I request a public‑interest fee waiver; this request is for news/editorial use.")
    portal_line = f"Portal: If preferred, I can submit or receive records via your portal: {portal_url}\n" if portal_url else ""

    email = TEMPLATE.format(
        entity_name=entity_name, state=state,
        legal_basis_citation=legal_basis_citation, legal_basis_url=legal_basis_url,
        court_name=court_name, case_number=case_number, defendant=defendant,
        hearing_type=first(re.search(r"—\s*([A-Za-z]+)", title).group(1) if "—" in title else "", "[calendar]"),
        pub_date=pub_date,
        video_policy_notes=video_policy_notes, fee_policy_summary=fee_policy_summary,
        fee_waiver_line=fee_waiver_line, ack_line=ack_line, portal_line=portal_line,
        requester_name=args.requester_name, requester_email=args.requester_email,
        requester_phone=args.requester_phone, requester_address=args.requester_address
    ).strip()

    os.makedirs(args.out, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    fn = f"{slugify(entity_name)}-{slugify(case_number)}-{ts}.txt"
    outp = os.path.join(args.out, fn)
    with open(outp, "w", encoding="utf-8") as f:
        f.write(email)

    print("\n" + "-"*72 + "\n")
    print(email)
    print("\n" + "-"*72 + "\n")
    print(f"Saved: {outp}")
    if req_email:
        print(f"Suggested recipient: {req_email}")
    else:
        print("No request_email found for this entity. Use portal_url if available.")

if __name__ == "__main__":
    main()
