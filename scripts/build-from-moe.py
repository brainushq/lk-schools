#!/usr/bin/env python3
"""
Rebuild data/schools.json from the official MoE 2024 government school lists.

Source: Ministry of Education Educational Statistics 2024
  https://dmb.moe.gov.lk/showStat2024.php  (List of National School + 9 provincial lists)
Raw CSVs live in data/raw/moe-2024/ (converted from the MoE xlsx files).

Strategy (canonical-base):
  - The 10,076 MoE government rows are the canonical base: they carry the
    official census_no, address, zone, education division and A/L type.
  - The legacy BrainUs rows (data/schools.json before this build) are matched
    onto the base by normalized name + district and contribute totalStudents
    and logoUrl where a confident match exists. Rows that cannot be matched
    confidently are written to data/raw/unmatched-existing-review.csv for
    manual reconciliation instead of being silently kept or dropped.
  - Private rows from the legacy dataset (not part of the gov list) are kept
    as-is with their original type.

Run:  python3 scripts/build-from-moe.py
Stdlib only. Idempotent.
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
RAW_DIR = REPO / "data" / "raw" / "moe-2024"
LEGACY_JSON = REPO / "data" / "raw" / "legacy-schools.json"
SCHOOLS_JSON = REPO / "data" / "schools.json"
DISTRICTS_JSON = REPO / "data" / "districts.json"
REVIEW_CSV = REPO / "data" / "raw" / "unmatched-existing-review.csv"

# MoE district codes: "11.Colombo" -> "Colombo". One spelling difference vs districts.json.
DISTRICT_ALIASES = {"Moneragala": "Monaragala"}

# Common Sinhala/Tamil school abbreviations expanded for fuzzy matching only
# (the stored name keeps the MoE form, title-cased).
ABBR = {
    "m.m.v.": "madhya maha vidyalaya",
    "m.m.v": "madhya maha vidyalaya",
    "m.v.": "maha vidyalaya",
    "m.v": "maha vidyalaya",
    "g.m.m.v.": "girls madhya maha vidyalaya",
    "g.m.m.v": "girls madhya maha vidyalaya",
    "b.m.v.": "boys maha vidyalaya",
    "g.m.v.": "girls maha vidyalaya",
    "t.m.v.": "tamil maha vidyalaya",
    "k.v.": "kanishta vidyalaya",
    "p.v.": "prathama vidyalaya",
    "v.": "vidyalaya",
    "c.c.": "central college",
    "m.c.": "muslim college",
    "m.l.c.": "muslim ladies college",
    "g.t.m.s.": "girls tamil mixed school",
    "t.m.s.": "tamil mixed school",
    "s.v.": "sri vidyalaya",
    "d.s.": "d s",
    "n.s.": "national school",
    "n.c.": "national college",
    "b.v.": "balika vidyalaya",
    "g.b.v.": "girls balika vidyalaya",
    "m.m.s.": "muslim mixed school",
    "m.g.m.s.": "muslim girls mixed school",
    "m.g.t.s.": "muslim girls tamil school",
    "g.m.s.": "girls muslim school",
    "t.v.": "tamil vidyalaya",
    "m.v.": "maha vidyalaya",
    "p.v.": "primary vidyalaya",
}

# Tokens too generic to use for candidate narrowing.
STOP_TOKENS = {
    "maha", "vidyalaya", "college", "school", "girls", "boys", "tamil",
    "muslim", "central", "national", "ladies", "mixed", "vidyalayam",
    "m", "v", "sri", "balika", "prathama", "kanishta", "vidyalay",
}

MATCH_THRESHOLD = 0.90  # high confidence only; below goes to review CSV


def clean_raw(s: str) -> str:
    """Lowercase, drop ", District" suffix style, collapse whitespace."""
    s = s.lower()
    s = s.split(",")[0].strip()
    return re.sub(r"\s+", " ", s)


def expand_abbr(name: str) -> str:
    """Expand common abbreviations so fuzzy matching can compare like for like."""
    n = clean_raw(name)
    n = re.sub(r"\([^)]*\)", " ", n)  # drop "(NATIONAL SCHOOL)" style suffixes
    for ab, full in sorted(ABBR.items(), key=lambda x: -len(x[0])):
        n = re.sub(r"(?<![a-z])" + re.escape(ab) + r"(?![a-z])", " " + full + " ", n)
    n = re.sub(r"[^a-z0-9\s]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    n = re.sub(r"vidyalayam\b", "vidyalaya", n)
    n = re.sub(r"vidyalay\b", "vidyalaya", n)
    return n


def ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


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


def load_moe_rows() -> list[dict]:
    """Read all raw MoE CSVs into cleaned rows."""
    rows = []
    for path in sorted(RAW_DIR.glob("*.csv")):
        if path.name == "all_government_schools.csv":
            continue
        with path.open(encoding="utf-8") as f:
            for r in csv.DictReader(f):
                rows.append(r)
    return rows


def main() -> None:
    districts = load_districts()
    district_names = set(districts)

    moe = load_moe_rows()
    print(f"MoE raw rows: {len(moe)}")

    # --- clean MoE rows -------------------------------------------------
    cleaned: list[dict] = []
    district_errors: set[str] = set()
    for r in moe:
        d = map_district(r["district"], district_names)
        if d is None:
            district_errors.add(r["district"])
            continue
        # moe_type: "1.1AB" -> "1AB", "2.1C" -> "1C", "3.Type2" -> "Type2", "4.Type3" -> "Type3"
        mtype = re.sub(r"^\d+\.", "", r["school_type"]).strip() or None
        cleaned.append(
            {
                "census_no": r["census_no"].strip(),
                "name_raw": r["school_name"].strip(),
                "address": re.sub(r"\s+", " ", r["school_address"].strip()) or None,
                "district": d,
                "zone": r["zone"].strip() or None,
                "education_division": r["education_division"].strip() or None,
                "moe_type": mtype,
                "category": r["category"].strip(),  # national | provincial
            }
        )
    if district_errors:
        print(f"ERROR: unmapped MoE districts: {sorted(district_errors)}")
        sys.exit(1)
    print(f"MoE cleaned rows: {len(cleaned)} (census_no unique: {len({c['census_no'] for c in cleaned})})")

    # --- load legacy rows (frozen snapshot of the pre-MoE dataset) -------
    legacy = json.loads(LEGACY_JSON.read_text(encoding="utf-8"))
    print(f"Legacy rows: {len(legacy)}")

    # --- build match index over MoE rows ---------------------------------
    # token index: (district, token) -> [(expanded_name, row_idx)]
    # also index the first 6 chars of each token so spelling drift at the
    # tail ("Bandaranayake" vs "BANDARANAYAKA") still finds candidates.
    tok_idx: dict[tuple[str, str], list[tuple[str, int]]] = defaultdict(list)
    root_idx: dict[tuple[str, str], list[int]] = defaultdict(list)
    expanded = [expand_abbr(c["name_raw"]) for c in cleaned]
    for i, exp in enumerate(expanded):
        d = cleaned[i]["district"]
        for tok in set(exp.split()):
            tok_idx[(d, tok)].append((exp, i))
        for tok in set(exp.split()):
            if len(tok) >= 5:
                root_idx[(d, tok[:6])].append(i)

    def legacy_town(name: str) -> str:
        # legacy rows often carry ", Town" — the town is a strong anchor
        parts = name.split(",")
        return parts[-1].strip().lower() if len(parts) > 1 else ""

    def town_hits(town: str, moe_idx: int) -> bool:
        c = cleaned[moe_idx]
        exp_name = expanded[moe_idx]
        exp_addr = expand_abbr(c["address"] or "")
        # exact town, or its first 5 chars, appearing in name/address —
        # catches "Addalachchenai" vs "ADDALAICHENAI" style drift
        town_root = town[:5]
        if (
            town in exp_name
            or town in exp_addr
            or town_root in exp_name
            or town_root in exp_addr
        ):
            return True
        # fuzzy town: "potuvil" vs "pottuvil" — compare town against each
        # significant token of name/address (threshold 0.72)
        for tok in set(exp_name.split()) | set(exp_addr.split()):
            if len(tok) >= 5 and ratio(town, tok) >= 0.72:
                return True
        return False

    def strip_token(s: str, town: str) -> str:
        """Remove the token of `s` that matches `town` (exact or fuzzy)."""
        toks = s.split()
        kept = []
        for tok in toks:
            if tok == town or (len(tok) >= 5 and len(town) >= 5 and ratio(town, tok) >= 0.72):
                continue
            kept.append(tok)
        return " ".join(kept)

    # --- match legacy rows ------------------------------------------------
    # Strategy 1: exact-token ratio (>= 0.90).
    # Strategy 2: town-anchored stripped ratio — the ", Town" suffix must
    #   appear (exact, root-prefix, or fuzzy) in the MoE name/address; the
    #   matching town token is stripped from both sides and the remainder is
    #   compared. Word order and spelling drift stop mattering: "Al Manar
    #   Central College, Maruthamunai" == "MARUTHAMUNAI AL-MANAR CENTRAL
    #   COLLEGE"; "Potuvil" ~ "POTTUVIL".
    # Strategy 3: substring-root containment — same district, >= 2 shared
    #   6-char token roots, ratio >= 0.70. Catches tail spelling drift.
    proposals: list[tuple[int, float, dict]] = []  # (moe_idx, score, legacy_row)
    no_candidate: list[dict] = []
    for s in legacy:
        d = s.get("district")
        key = expand_abbr(s["name"])
        town = legacy_town(s["name"])
        key_no_town = key.replace(town, " ").strip() if town else key
        toks = [t for t in key.split() if t not in STOP_TOKENS]

        # strategy 1 candidates: exact token hits
        cands: list[tuple[str, int]] = []
        seen: set[int] = set()
        for t in toks:
            for exp, i in tok_idx.get((d, t), []):
                if i not in seen:
                    seen.add(i)
                    cands.append((exp, i))

        # widen the pool with root-prefix hits so spelling drift
        # ("Ashraff" vs "ASHRAF") still surfaces candidates for s2/s3
        root_cands: set[int] = set()
        for t in toks:
            if len(t) >= 5:
                for i in root_idx.get((d, t[:6]), []):
                    root_cands.add(i)
        for i in root_cands:
            if i not in seen:
                seen.add(i)
                cands.append((expanded[i], i))

        best_i, best_r = None, 0.0
        best_strat = ""
        for exp, i in cands:
            r = ratio(key, exp)
            if r > best_r:
                best_r, best_i = r, i
                best_strat = "s1-ratio"
        if best_i is not None and best_r >= MATCH_THRESHOLD:
            proposals.append((best_i, best_r, s))
            continue

        # strategy 2: town-anchored stripped ratio — the ", Town" suffix must
        # appear in the MoE name/address; strip the town from both sides and
        # compare the remainder. Word order and minor spelling drift
        # ("Ashraff" vs "ASHRAF") stop mattering. The 0.85 bar still rejects
        # same-town different schools (e.g. "Al Manar National School" vs
        # "AL-MANAR CENTRAL COLLEGE", both in Maruthamunai).
        if town:
            stripped_key = strip_token(key, town)
            for exp, i in cands:
                if not town_hits(town, i):
                    continue
                stripped_moe = strip_token(exp, town)
                r = ratio(stripped_key, stripped_moe)
                if r > best_r:
                    best_r, best_i, best_strat = r, i, "s2-town-stripped"
            if best_i is not None and best_strat == "s2-town-stripped" and best_r >= 0.85:
                proposals.append((best_i, best_r, s))
                continue

        # strategy 3: substring-root containment (spelling drift)
        roots = {t[:6] for t in toks if len(t) >= 5}
        root_cands: set[int] = set()
        for root in roots:
            for i in root_idx.get((d, root), []):
                root_cands.add(i)
        sub_best_i, sub_best_r = None, 0.0
        for i in root_cands:
            shared = sum(1 for root in roots if root in {t[:6] for t in expanded[i].split()})
            if shared >= 2:
                r = ratio(key, expanded[i])
                if r > sub_best_r:
                    sub_best_r, sub_best_i = r, i
        if sub_best_i is not None and sub_best_r >= 0.70:
            proposals.append((sub_best_i, sub_best_r, s))
            continue

        if best_i is not None:
            no_candidate.append({**s, "best_candidate": cleaned[best_i]["name_raw"], "score": round(best_r, 3)})
        else:
            no_candidate.append(s)

    # greedy claim: sort by score desc, first claim wins
    proposals.sort(key=lambda p: p[1], reverse=True)
    claimed: set[int] = set()
    matched_legacy: dict[int, dict] = {}
    for moe_idx, score, s in proposals:
        if moe_idx in claimed:
            no_candidate.append({**s, "best_candidate": cleaned[moe_idx]["name_raw"], "score": round(score, 3)})
            continue
        claimed.add(moe_idx)
        matched_legacy[moe_idx] = s

    review = []
    for s in no_candidate:
        if s.get("type") in ("private", "international"):
            continue  # kept as-is below, not a review item
        if "best_candidate" not in s:
            review.append({**s, "best_candidate": "", "score": ""})
        else:
            review.append(s)

    print(f"Legacy matched onto MoE: {len(matched_legacy)} | review: {len(review)}")

    # --- assemble final rows ---------------------------------------------
    final: list[dict] = []
    used_ids: set[str] = set()

    def add(row: dict) -> None:
        i = row["id"]
        if i in used_ids:
            base, n = i, 2
            while f"{base}-{n}" in used_ids:
                n += 1
            i = f"{base}-{n}"
        used_ids.add(i)
        final.append({**row, "id": i})

    for i, c in enumerate(cleaned):
        legacy_row = matched_legacy.get(i)
        if legacy_row is not None:
            name = legacy_row["name"].split(",")[0].strip() or title_case_name(c["name_raw"])
            row = {
                "id": legacy_row["id"],  # keep stable legacy id where matched
                "name": name,
                "district": c["district"],
                "type": "national" if c["category"] == "national" else "provincial",
                "censusNo": c["census_no"],
                "moeType": c["moe_type"],
                "address": c["address"],
                "zone": c["zone"],
                "educationDivision": c["education_division"],
                "totalStudents": legacy_row.get("totalStudents"),
                "logoUrl": legacy_row.get("logoUrl"),
                "source": "moe-gov-2024",
            }
        else:
            row = {
                "id": slugify(title_case_name(c["name_raw"]) + " " + c["district"]),
                "name": title_case_name(c["name_raw"]),
                "district": c["district"],
                "type": "national" if c["category"] == "national" else "provincial",
                "censusNo": c["census_no"],
                "moeType": c["moe_type"],
                "address": c["address"],
                "zone": c["zone"],
                "educationDivision": c["education_division"],
                "totalStudents": None,
                "logoUrl": None,
                "source": "moe-gov-2024",
            }
        add(row)

    # keep legacy private rows (not part of the gov list), normalized to full schema
    kept_private = 0
    for s in legacy:
        if s.get("type") in ("private", "international"):
            add(
                {
                    "id": s.get("id") or slugify(s["name"] + " " + s["district"]),
                    "name": s["name"].split(",")[0].strip() or s["name"],
                    "district": s["district"],
                    "type": s["type"],
                    "censusNo": None,
                    "moeType": None,
                    "address": None,
                    "zone": None,
                    "educationDivision": None,
                    "totalStudents": s.get("totalStudents"),
                    "logoUrl": s.get("logoUrl"),
                    "source": s.get("source") or "brainus-db-legacy",
                }
            )
            kept_private += 1
    print(f"Kept legacy private/international rows: {kept_private}")

    final.sort(key=lambda r: (r["district"], r["name"].lower()))

    # --- write outputs ----------------------------------------------------
    SCHOOLS_JSON.write_text(json.dumps(final, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {SCHOOLS_JSON} with {len(final)} schools")

    if review:
        fields = list(review[0].keys())
        REVIEW_CSV.parent.mkdir(parents=True, exist_ok=True)
        with REVIEW_CSV.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(review)
        print(f"Wrote {REVIEW_CSV} with {len(review)} unmatched legacy rows for manual review")


if __name__ == "__main__":
    main()
