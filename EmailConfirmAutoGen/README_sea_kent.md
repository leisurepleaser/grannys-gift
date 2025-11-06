# Seattle/Kent Court → Leads → Emails (Zero-Input)

This bundle gives you:
1) **seattle_kent_autorun.py** — pulls **King County Superior Court** Seattle/Kent criminal trial calendars (PDF), extracts case numbers, hearing types, dates, and names (best‑effort), filters out violent/graphic categories, and writes **candidates.csv** (top 25 printed; up to 50 saved).  
2) **generate_from_candidates.py** — maps **SEA/KNT** cases to the right **agency** (SPD/Kent PD/KCSO/WSP) using your **pra_coverage_master.csv**, and prints/saves a **professional PRA email**.

## Install (once)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r requirements_wa_courts.txt
```

## Run the autorun (no prompts)
```bash
python3 seattle_kent_autorun.py --out candidates.csv --limit 25
```

## Generate a PRA email for any candidate
Place your **pra_coverage_master.csv** next to these scripts, then:
```bash
python3 generate_from_candidates.py --candidates candidates.csv --master pra_coverage_master.csv --out out_emails   --requester-name "Your Name" --requester-email you@example.com --requester-phone "555-123-4567"
```
(You’ll see a numbered list — pick one; it prints the email and writes a `.txt` file to `out_emails/`.)  
You can skip the picker with `--pick N`.

## Tips
- If `lxml`/`pdfminer.six` complain on macOS, install Xcode CLTs: `xcode-select --install`, then re-run `pip3 install -r requirements_wa_courts.txt`.
- Violent/graphic terms are filtered out in the autorun (`VIOLENT_DENY`). You can loosen/tighten that list in the script.
