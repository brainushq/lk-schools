"""Open, community-maintained dataset of Sri Lankan schools."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from importlib import resources
from typing import Literal

SchoolManagementType = Literal["provincial", "national", "international", "private"]


@dataclass(frozen=True, slots=True)
class District:
    name: str
    province: str


@dataclass(frozen=True, slots=True)
class School:
    id: str
    """Stable slug owned by this dataset, e.g. "trinity-college-kandy". Not a database ID."""
    name: str
    district: str
    province: str
    type: SchoolManagementType | None
    total_students: int | None
    logo_url: str | None
    source: str | None
    """Where this row was sourced from, e.g. "moe-gov-pdf" or "wikipedia"."""


def _read_json(name: str) -> list[dict]:
    with resources.files(__package__).joinpath("data", name).open(
        "r", encoding="utf-8"
    ) as f:
        return json.load(f)


@lru_cache(maxsize=1)
def get_all_districts() -> list[District]:
    return [District(**row) for row in _read_json("districts.json")]


@lru_cache(maxsize=1)
def get_all_schools() -> list[School]:
    return [
        School(
            id=row["id"],
            name=row["name"],
            district=row["district"],
            province=row["province"],
            type=row.get("type"),
            total_students=row.get("totalStudents"),
            logo_url=row.get("logoUrl"),
            source=row.get("source"),
        )
        for row in _read_json("schools.json")
    ]


def get_provinces() -> list[str]:
    return sorted({d.province for d in get_all_districts()})


def get_school_by_id(id: str) -> School | None:
    return next((s for s in get_all_schools() if s.id == id), None)


def find_schools(
    *,
    district: str | None = None,
    province: str | None = None,
    type: SchoolManagementType | None = None,
    query: str | None = None,
) -> list[School]:
    """Filter schools. `query` is a case-insensitive substring match on name."""
    needle = query.lower() if query else None
    return [
        s
        for s in get_all_schools()
        if (district is None or s.district == district)
        and (province is None or s.province == province)
        and (type is None or s.type == type)
        and (needle is None or needle in s.name.lower())
    ]
