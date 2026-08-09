import districtsData from "./data/districts.json" with { type: "json" };
import schoolsData from "./data/schools.json" with { type: "json" };

import type { District, School, SchoolFilter } from "./types.js";

export type { District, School, SchoolFilter, SchoolManagementType } from "./types.js";

const districts = districtsData as District[];
const schools = schoolsData as School[];

export function getAllSchools(): School[] {
  return schools;
}

export function getAllDistricts(): District[] {
  return districts;
}

export function getProvinces(): string[] {
  return [...new Set(districts.map((d) => d.province))].sort();
}

export function getSchoolById(id: string): School | undefined {
  return schools.find((s) => s.id === id);
}

export function findSchools(filter: SchoolFilter = {}): School[] {
  const query = filter.query?.toLowerCase();
  return schools.filter((s) => {
    if (filter.district && s.district !== filter.district) return false;
    if (filter.province && s.province !== filter.province) return false;
    if (filter.type && s.type !== filter.type) return false;
    if (query && !s.name.toLowerCase().includes(query)) return false;
    return true;
  });
}
