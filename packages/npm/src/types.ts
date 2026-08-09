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
