#!/usr/bin/env python3
"""
Rebuild data/schools.json from the official MoE 2024 government school lists.

Source: Ministry of Education Educational Statistics 2024
  https://dmb.moe.gov.lk/showStat2024.php  (List of National School + 9 provincial lists)
Raw CSVs live in data/raw/moe-2024/ (converted from the MoE xlsx files).

The 10,076 MoE government rows are the canonical dataset: official census
number, address, zone, education division and A/L type. No student counts or
logos — those aren't part of this dataset (and aren't published per-school by
MoE in these lists). Private rows from the old BrainUs dataset snapshot
(data/raw/legacy-schools.json) are kept as-is with their original type, since
they are real schools that don't appear in the government list.

Run:  python3 scripts/build-from-moe.py
Stdlib only. Idempotent.
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
RAW_DIR = REPO / "data" / "raw" / "moe-2024"
LEGACY_JSON = REPO / "data" / "raw" / "legacy-schools.json"
SCHOOLS_JSON = REPO / "data" / "schools.json"
DISTRICTS_JSON = REPO / "data" / "districts.json"

# MoE district codes: "11.Colombo" -> "Colombo". One spelling difference vs districts.json.
DISTRICT_ALIASES = {"Moneragala": "Monaragala"}


def clean_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def title_case_name(raw: str) -> str:
    """MoE names are ALL CAPS. Title-case but keep abbreviations (M.V., C.C.) upper."""
    raw = re.sub(r"\s*\([^)]*\)\s*", " ", raw)  # drop "(NATIONAL SCHOOL)" style suffixes
    words = raw.split()
    out = []
    for w in words:
        if "." in w:
            out.append(w.upper())  # abbreviation token, e.g. M.V. / M.M.V.
        elif re.fullmatch(r"[A-Za-z]{1,3}", w) and len(w) <= 2:
            out.append(w.upper())  # short tokens like M.V standalone parts
        else:
            out.append(w.title())
    return " ".join(out)


def slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


def load_districts() -> dict[str, str]:
    data = json.loads(DISTRICTS_JSON.read_text(encoding="utf-8"))
    return {d["name"]: d["province"] for d in data}


def map_district(moe_d: str, district_names: set[str]) -> str | None:
    d = re.sub(r"^\d+\.", "", moe_d).strip()
    d = DISTRICT_ALIASES.get(d, d)
    return d if d in district_names else None


def main() -> None:
    district_names = set(load_districts())

    rows: list[dict] = []
    for path in sorted(RAW_DIR.glob("*.csv")):
        if path.name == "all_government_schools.csv":
            continue
        with path.open(encoding="utf-8") as f:
            for r in csv.DictReader(f):
                rows.append(r)
    print(f"MoE raw rows: {len(rows)}")

    final: list[dict] = []
    used_ids: set[str] = set()
    district_errors: set[str] = set()

    for r in rows:
        d = map_district(r["district"], district_names)
        if d is None:
            district_errors.add(r["district"])
            continue
        # moe_type: "1.1AB" -> "1AB", "2.1C" -> "1C", "3.Type2" -> "Type2", "4.Type3" -> "Type3"
        mtype = re.sub(r"^\d+\.", "", r["school_type"]).strip() or None
        name = title_case_name(r["school_name"])
        i = slugify(name + " " + d)
        base, n = i, 2
        while i in used_ids:
            i = f"{base}-{n}"
            n += 1
        used_ids.add(i)
        final.append(
            {
                "id": i,
                "name": name,
                "district": d,
                "type": "national" if r["category"].strip() == "national" else "provincial",
                "censusNo": r["census_no"].strip(),
                "moeType": mtype,
                "address": clean_ws(r["school_address"]) or None,
                "zone": clean_ws(r["zone"]) or None,
                "educationDivision": clean_ws(r["education_division"]) or None,
                "source": "moe-gov-2024",
            }
        )

    if district_errors:
        print(f"ERROR: unmapped MoE districts: {sorted(district_errors)}")
        sys.exit(1)

    # keep legacy private rows (not part of the gov list), normalized to full schema
    legacy = json.loads(LEGACY_JSON.read_text(encoding="utf-8"))
    kept_private = 0
    for s in legacy:
        if s.get("type") in ("private", "international"):
            i = s.get("id") or slugify(s["name"] + " " + s["district"])
            base, n = i, 2
            while i in used_ids:
                i = f"{base}-{n}"
                n += 1
            used_ids.add(i)
            final.append(
                {
                    "id": i,
                    "name": s["name"].split(",")[0].strip() or s["name"],
                    "district": s["district"],
                    "type": s["type"],
                    "censusNo": None,
                    "moeType": None,
                    "address": None,
                    "zone": None,
                    "educationDivision": None,
                    "source": s.get("source") or "brainus-db-legacy",
                }
            )
            kept_private += 1
    print(f"Kept legacy private/international rows: {kept_private}")

    final.sort(key=lambda r: (r["district"], r["name"].lower()))
    SCHOOLS_JSON.write_text(json.dumps(final, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {SCHOOLS_JSON} with {len(final)} schools")


if __name__ == "__main__":
    main()
