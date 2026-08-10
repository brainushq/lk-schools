export type SchoolManagementType =
  | "provincial"
  | "national"
  | "international"
  | "private";

export interface District {
  name: string;
  province: string;
}

export interface School {
  /** Stable slug owned by this dataset, e.g. "trinity-college-kandy". Not a database ID. */
  id: string;
  name: string;
  district: string;
  province: string;
  type: SchoolManagementType | null;
  /** Official Ministry of Education census number (unique per government school). */
  censusNo: string | null;
  /** MoE grade-span classification: "1AB" | "1C" | "Type2" | "Type3" | null. */
  moeType: string | null;
  address: string | null;
  zone: string | null;
  educationDivision: string | null;
  /** Where this row was sourced from, e.g. "moe-gov-2024" or "wikipedia". Null for rows not yet attributed. */
  source: string | null;
}

export interface SchoolFilter {
  district?: string;
  province?: string;
  type?: SchoolManagementType;
  /** Case-insensitive substring match against the school name. */
  query?: string;
}
