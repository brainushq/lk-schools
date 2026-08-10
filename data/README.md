# Canonical dataset

`schools.json` and `districts.json` are the single source of truth for both
the npm and PyPI packages. `scripts/sync-data.mjs` copies these into each
package's source tree at build time — never edit the copies under
`packages/*/`, only these files.

Migrated from BrainUs's internal database via `scripts/migrate-from-supabase.mjs`
(re-runnable — pulls from the public Supabase REST API, cleans names, and
regenerates slugs). The dataset is licensed CC-BY-SA 4.0 (see
`LICENSE-DATA`) as a blanket policy since existing rows don't record
per-row source.

## Schema

### `districts.json`

| field      | type   | notes                                     |
|------------|--------|--------------------------------------------|
| `name`     | string | e.g. "Jaffna" — the district's own key, no separate id |
| `province` | string | e.g. "Northern"                            |

### `schools.json`

| field           | type            | notes                                                                 |
|-----------------|-----------------|-------------------------------------------------------------------------|
| `id`            | string          | slug owned by this dataset, e.g. `"trinity-college-kandy"` — not a database ID, contributors mint their own |
| `name`          | string          |                                                                          |
| `district`      | string          | must match a `name` in `districts.json` — checked in CI                 |
| `type`          | string \| null  | `provincial` \| `national` \| `international` \| `private`              |
| `totalStudents` | number \| null  | enrollment, where known                                                 |
| `logoUrl`       | string \| null  | link to school/Wikimedia-hosted logo, not rehosted                       |
| `source`        | string \| null  | e.g. `"moe-gov-pdf"` or `"wikipedia"` — required for new rows            |

`province` is not stored on schools — both packages derive it from `district`
by joining against `districts.json` at load time, so a district's province
only ever needs correcting in one place.

New contributions must set `source`. Rows missing it are treated as
unverified and excluded from release builds once that check is added to CI.
