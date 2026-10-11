# lk-schools API

A small search API over the lk-schools dataset, running as a Cloudflare
Worker. The dataset is bundled into the Worker and searched in memory, so
there is no database.

Base URL: `https://lk-schools.brainus.lk`

| Endpoint | |
|---|---|
| `GET /v1/schools/search?q=royal` | Fuzzy name search. Optional `district`, `province`, `type`, `limit` (max 25). |
| `GET /v1/schools/:id` | One school by slug or MoE census number. |
| `GET /v1/schools?district=Galle&page=1` | Filtered list, paginated (`limit` max 100). |
| `GET /v1/districts` | All districts with their province. |
| `GET /v1/schools.json` | Full dataset, served as a static file. |

Limit: 60 requests per minute per IP.

## School picker widget

Drop-in school search box for any website, served by the same Worker:

```html
<input name="school" data-lk-school>
<script src="https://lk-schools.brainus.lk/widget.js" defer></script>
```

The form submits the chosen school's `id` under the input's name. Options as
data attributes: `data-district`, `data-province`, `data-type`, and
`data-value="censusNo"` to submit the census number instead. Selecting a
school fires a `lk-school-select` event with the full record in
`event.detail`. Try it at
[lk-schools.brainus.lk/demo](https://lk-schools.brainus.lk/demo).

## Develop

```bash
npm install
npm run dev        # http://localhost:8787, widget demo at /demo
npm test
```

## Deploy

```bash
npx wrangler login
npm run deploy
```
