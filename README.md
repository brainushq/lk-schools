# lk-schools

An open, community-maintained list of Sri Lankan schools — published as an
npm package and a PyPI package, both generated from one canonical dataset in
this repo.

## Status

Dataset rebuilt from the Ministry of Education's official 2024 school lists
(10,076 government schools + 7 legacy private rows, 25 districts, 9
provinces) with census numbers, addresses, zones, education divisions and
MoE A/L type. Both packages build and pass CI. Not yet published to npm or
PyPI.

## Install

```bash
npm install @brainus/lk-schools
```

```bash
pip install lk-schools
```

(Different names per registry: `@brainus/lk-schools` on npm to match
BrainUs's existing `@brainus/*` packages, `lk-schools` on PyPI since that
name was free and there's no existing BrainUs PyPI convention to match.)

## Structure

```text
data/                 canonical dataset (single source of truth)
packages/npm/         npm package — reads data/ at build time
packages/pypi/        PyPI package — reads data/ at build time
.github/workflows/    CI: validate data, build + publish both packages
```

## License

Code: MIT (see `LICENSE`).
Data: CC-BY-SA 4.0 (see `LICENSE-DATA`) — the dataset is derived in part
from Wikipedia, so the whole dataset carries Wikipedia's share-alike and
attribution terms even though not every row originated there.

## Contributing

Fixes and additions to `data/` are welcome via pull request. New rows must
set a `source` field (e.g. `"moe-gov-pdf"` or `"wikipedia"`) — see
`data/README.md` for the schema.
