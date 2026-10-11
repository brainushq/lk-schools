// Reuse the npm package's types so the API and package never drift.
import type { School } from "../../npm/src/types.ts";

// MoE lists abbreviate school-type suffixes ("Kandy M.V."). Index both the
// abbreviation and its expansion so either spelling finds the school.
const ABBREVIATIONS: Record<string, string> = {
  mv: "maha vidyalaya",
  mmv: "muslim maha vidyalaya",
  kv: "kanishta vidyalaya",
  pv: "primary vidyalaya",
  ps: "primary school",
  tv: "tamil vidyalaya",
  gtms: "government tamil mixed school",
  gmms: "government muslim mixed school",
  rctms: "roman catholic tamil mixed school",
  st: "saint",
};

// Common misspellings in user queries, mapped to the dataset's spelling.
const QUERY_FIXES: Record<string, string> = {
  collage: "college",
  colledge: "college",
  vidyalayam: "vidyalaya",
  vidiyalaya: "vidyalaya",
  vidhyalaya: "vidyalaya",
  kanista: "kanishta",
};

/** Lowercase, collapse "M.V." to "mv", turn other punctuation into spaces. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(?:[a-z]\.){2,}/g, (abbr) => abbr.replace(/\./g, "") + " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTokens(q: string): string[] {
  return normalize(q)
    .split(" ")
    .filter(Boolean)
    .map((t) => QUERY_FIXES[t] ?? t);
}

/** Levenshtein distance capped at 2. Only used for the typo fallback. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

interface Entry {
  school: School;
  name: string; // normalized name
  core: string; // name without a leading town: "colombo royal college" -> "royal college"
  nameWords: string[]; // name words + abbreviation expansions
  placeWords: string[]; // district, zone, division: "royal kandy" should work
}

export interface SearchOptions {
  district?: string;
  province?: string;
  type?: string;
  limit: number;
}

export function createIndex(schools: School[]) {
  const entries: Entry[] = schools.map((school) => {
    const name = normalize(school.name);
    const words = name.split(" ");
    const nameWords = [
      ...words,
      ...words.flatMap((w) => ABBREVIATIONS[w]?.split(" ") ?? []),
    ];
    const placeWords = normalize(
      [school.district, school.zone, school.educationDivision].filter(Boolean).join(" "),
    ).split(" ");
    // Many schools carry their town as a prefix the MoE list keeps but people
    // drop when searching ("Colombo Royal College" is searched as "royal college").
    const towns = new Set([...placeWords, ...normalize(school.address ?? "").split(" ")]);
    let lead = 0;
    while (lead < words.length - 1 && towns.has(words[lead])) lead++;
    const core = words.slice(lead).join(" ");
    return { school, name, core, nameWords, placeWords };
  });

  const vocabulary = [...new Set(entries.flatMap((e) => [...e.nameWords, ...e.placeWords]))];

  /** Score one entry, 0 = no match. Every query token must match somewhere. */
  function score(entry: Entry, tokens: string[], query: string): number {
    let total = 0;
    for (const token of tokens) {
      if (entry.nameWords.includes(token)) total += 3;
      else if (entry.nameWords.some((w) => w.startsWith(token))) total += 2;
      else if (entry.placeWords.some((w) => w.startsWith(token))) total += 1;
      else return 0;
    }
    if (entry.name === query || entry.core === query) total += 4;
    else if (entry.name.startsWith(query) || entry.core.startsWith(query)) total += 2;
    return total;
  }

  function run(tokens: string[], opts: SearchOptions) {
    const query = tokens.join(" ");
    const hits: { entry: Entry; score: number }[] = [];
    for (const entry of entries) {
      const s = entry.school;
      if (opts.district && s.district !== opts.district) continue;
      if (opts.province && s.province !== opts.province) continue;
      if (opts.type && s.type !== opts.type) continue;
      const sc = score(entry, tokens, query);
      if (sc > 0) hits.push({ entry, score: sc });
    }
    hits.sort(
      (a, b) =>
        b.score - a.score ||
        a.entry.name.length - b.entry.name.length ||
        a.entry.school.name.localeCompare(b.entry.school.name) ||
        a.entry.school.id.localeCompare(b.entry.school.id),
    );
    return { total: hits.length, results: hits.slice(0, opts.limit).map((h) => h.entry.school) };
  }

  return function search(q: string, opts: SearchOptions) {
    const tokens = queryTokens(q);
    if (tokens.length === 0) return { total: 0, results: [] as School[] };

    const exact = run(tokens, opts);
    if (exact.total > 0) return exact;

    // Nothing matched: retry with each long-enough token swapped for the
    // closest dataset word one typo away ("rioyal" -> "royal").
    let changed = false;
    const corrected = tokens.map((t) => {
      if (t.length < 4 || vocabulary.includes(t)) return t;
      const fix = vocabulary.find((w) => w.length >= 4 && withinOneEdit(t, w));
      if (fix) changed = true;
      return fix ?? t;
    });
    return changed ? run(corrected, opts) : exact;
  };
}
