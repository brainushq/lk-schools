#!/usr/bin/env node
// One-off (re-runnable) migration: pulls schools/districts out of the
// BrainUs Supabase project via its public REST API and writes the
// cleaned, de-identified canonical dataset to /data.
//
// Uses the project's anon/publishable key — safe to commit, it's the
// same key BrainUs ships to browsers and only grants what RLS allows.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SUPABASE_URL = "https://xuhqqzrovtfautvswxib.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1aHFxenJvdnRmYXV0dnN3eGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MTkzMjksImV4cCI6MjA2NTE5NTMyOX0.m8MJ7Tuai5sro8ZWafqO5BfGBx0XQMjScc0VrNhyXz4";

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../..");

async function fetchAll(table, select) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=${select}&order=id`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Range: `${offset}-${offset + pageSize - 1}`,
        },
      },
    );
    if (!res.ok) throw new Error(`${table} fetch failed: ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function cleanName(name) {
  return name
    .replace(/\[\d+\]/g, "") // strip Wikipedia-style citation markers, e.g. [2]
    .replace(/[[\]]/g, "") // strip any stray unmatched bracket
    .replace(/\s+/g, " ") // collapse whitespace/newlines
    .trim()
    .replace(/,$/, "");
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assignSlugs(schools) {
  const byBaseSlug = new Map();
  for (const school of schools) {
    const base = slugify(`${school.name}-${school.district}`);
    if (!byBaseSlug.has(base)) byBaseSlug.set(base, []);
    byBaseSlug.get(base).push(school);
  }
  for (const group of byBaseSlug.values()) {
    // Deterministic regardless of fetch/iteration order: sort by the
    // source row's own id before assigning suffixes.
    group.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
    group.forEach((school, i) => {
      const base = slugify(`${school.name}-${school.district}`);
      school.id = i === 0 ? base : `${base}-${i + 1}`;
    });
  }
}

async function main() {
  const rawDistricts = await fetchAll("districts", "id,name,province");
  const rawSchools = await fetchAll(
    "schools",
    "id,name,district_id,type,total_students,logo_url",
  );

  const districtById = new Map(rawDistricts.map((d) => [d.id, d]));

  const districts = rawDistricts
    .map((d) => ({ name: d.name, province: d.province }))
    .sort((a, b) => a.province.localeCompare(b.province) || a.name.localeCompare(b.name));

  const excluded = [];
  const schools = [];
  for (const row of rawSchools) {
    const district = row.district_id ? districtById.get(row.district_id) : null;
    if (!district) {
      excluded.push(row);
      continue;
    }
    schools.push({
      sourceId: row.id,
      name: cleanName(row.name),
      district: district.name,
      type: row.type,
      totalStudents: row.total_students,
      logoUrl: row.logo_url,
      source: null,
    });
  }

  assignSlugs(schools);

  const ids = schools.map((s) => s.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Slug collision survived assignSlugs() — aborting.");
  }

  schools.sort((a, b) => a.district.localeCompare(b.district) || a.name.localeCompare(b.name));

  const output = schools.map(({ sourceId, ...rest }) => rest);

  writeFileSync(
    path.join(repoRoot, "data/districts.json"),
    JSON.stringify(districts, null, 2) + "\n",
  );
  writeFileSync(
    path.join(repoRoot, "data/schools.json"),
    JSON.stringify(output, null, 2) + "\n",
  );

  console.log(`districts: ${districts.length}`);
  console.log(`schools: ${output.length} (excluded ${excluded.length}: ${excluded.map((r) => r.name).join(", ")})`);
  const provinces = new Set(districts.map((d) => d.province));
  console.log(`provinces: ${provinces.size}`);
}

main();
