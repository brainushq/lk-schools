export type SchoolManagementType =
  | "provincial"
  | "national"
  | "international"
  | "private";

export interface District {
  id: string;
  name: string;
  province: string;
}

export interface School {
  id: string;
  name: string;
  districtId: string;
  district: string;
  province: string;
  type: SchoolManagementType | null;
  totalStudents: number | null;
  logoUrl: string | null;
  /** Where this row was sourced from, e.g. "moe-gov-pdf" or "wikipedia". Null for rows not yet attributed. */
  source: string | null;
}

export interface SchoolFilter {
  district?: string;
  province?: string;
  type?: SchoolManagementType;
  /** Case-insensitive substring match against the school name. */
  query?: string;
}
