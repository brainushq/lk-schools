import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createIndex } from "../src/search.ts";
import type { School } from "../../npm/src/types.ts";

const raw = JSON.parse(readFileSync(new URL("../src/data/schools.json", import.meta.url), "utf8"));
const schools: School[] = raw.map((s: School) => ({ ...s, province: "" }));
const search = createIndex(schools);
const names = (q: string, opts = {}) =>
  search(q, { limit: 10, ...opts }).results.map((s) => s.name);

test("finds by name prefix", () => {
  assert.ok(names("royal").includes("Royal College"));
});

test("a leading town name counts as an exact match", () => {
  const top = names("royal college", { limit: 3 });
  assert.ok(top.includes("Royal College"));
  assert.ok(top.includes("Colombo Royal College"));
});

test("ties are ordered by name, then id", () => {
  const make = (id: string, name: string, type: School["type"]): School => ({
    id, name, type, district: "Kandy", province: "", censusNo: id, moeType: null,
    address: null, zone: null, educationDivision: null, source: null,
  });
  const fixture = [
    make("1", "Sample College", "provincial"),
    make("2", "Sample College", "national"),
    make("3", "Sample Central College", "national"),
  ];
  for (const order of [fixture, [...fixture].reverse()]) {
    const ids = createIndex(order)("sample college", { limit: 10 }).results.map((s) => s.id);
    assert.deepEqual(ids, ["1", "2", "3"]);
  }
});

test("word order and district both work", () => {
  assert.ok(names("royal colombo").includes("Colombo Royal College"));
  assert.ok(names("trinity kandy").some((n) => n.startsWith("Trinity College")));
});

test("misspellings are corrected", () => {
  assert.ok(names("royal collage").includes("Royal College"));
  assert.ok(names("rioyal college").includes("Royal College"));
});

test("abbreviations match their expansion and vice versa", () => {
  const mv = names("maha vidyalaya", { limit: 100_000 });
  assert.ok(mv.some((n) => n.endsWith("M.V.")));
  assert.ok(names("mv").length > 0);
});

test("filters apply", () => {
  const results = search("college", { district: "Galle", limit: 25 }).results;
  assert.ok(results.length > 0);
  assert.ok(results.every((s) => s.district === "Galle"));
});

test("nonsense returns nothing", () => {
  assert.equal(search("zzqxv", { limit: 10 }).total, 0);
});

test("a search over the whole dataset takes under 5ms", () => {
  const start = performance.now();
  for (let i = 0; i < 50; i++) search("maha vid", { limit: 10 });
  const perQuery = (performance.now() - start) / 50;
  assert.ok(perQuery < 5, `${perQuery.toFixed(2)}ms per query`);
});
