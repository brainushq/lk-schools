import { Hono } from "hono";
import { cors } from "hono/cors";

import districtsData from "./data/districts.json" with { type: "json" };
import schoolsRaw from "./data/schools.json" with { type: "json" };
import { createIndex } from "./search.ts";
import type { District, School } from "../../npm/src/types.ts";

type Env = { Bindings: { LIMITER: RateLimit } };

// Loaded once per Worker instance, then every request searches in memory.
const districts = districtsData as District[];
const provinceByDistrict = new Map(districts.map((d) => [d.name, d.province]));
const schools: School[] = (schoolsRaw as Omit<School, "province">[]).map((s) => ({
  ...s,
  province: provinceByDistrict.get(s.district) ?? "",
}));

const byId = new Map<string, School>();
for (const s of schools) {
  byId.set(s.id, s);
  if (s.censusNo) byId.set(s.censusNo, s);
}

const search = createIndex(schools);

function clampInt(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isNaN(n) ? fallback : Math.min(Math.max(n, min), max);
}

const app = new Hono<Env>();

app.use("*", cors({ origin: "*", allowMethods: ["GET", "OPTIONS"] }));

app.get("/", (c) =>
  c.json({
    name: "lk-schools API",
    docs: "https://github.com/brainushq/lk-schools",
    endpoints: [
      "GET /v1/schools/search?q=royal&district=&province=&type=&limit=10",
      "GET /v1/schools/:id  (slug or MoE census number)",
      "GET /v1/schools?district=&province=&type=&page=1&limit=50",
      "GET /v1/districts",
      "GET /v1/schools.json  (full dataset, static)",
    ],
  }),
);

app.use("/v1/*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const { success } = await c.env.LIMITER.limit({ key: ip });
  if (!success) {
    return c.json({ error: "rate_limited", message: "Too many requests, slow down." }, 429, {
      "Retry-After": "60",
    });
  }
  await next();
  if (c.res.ok) c.header("Cache-Control", "public, max-age=3600");
});

app.get("/v1/schools/search", (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) {
    return c.json({ error: "bad_request", message: "q must be at least 2 characters." }, 400);
  }
  const { total, results } = search(q.slice(0, 100), {
    district: c.req.query("district"),
    province: c.req.query("province"),
    type: c.req.query("type"),
    limit: clampInt(c.req.query("limit"), 10, 1, 25),
  });
  return c.json({ query: q, total, results });
});

app.get("/v1/schools", (c) => {
  const { district, province, type } = c.req.query();
  const page = clampInt(c.req.query("page"), 1, 1, 10_000);
  const limit = clampInt(c.req.query("limit"), 50, 1, 100);
  const matched = schools.filter(
    (s) =>
      (!district || s.district === district) &&
      (!province || s.province === province) &&
      (!type || s.type === type),
  );
  return c.json({
    page,
    limit,
    total: matched.length,
    totalPages: Math.ceil(matched.length / limit),
    results: matched.slice((page - 1) * limit, page * limit),
  });
});

app.get("/v1/schools/:id", (c) => {
  const school = byId.get(c.req.param("id"));
  return school ? c.json(school) : c.json({ error: "not_found" }, 404);
});

app.get("/v1/districts", (c) => c.json(districts));

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

export default app;
