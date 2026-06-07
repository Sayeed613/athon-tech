/** Athon — Academic Calendar Type Definitions */

// ── Academic Year ─────────────────────────────────────────────

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAcademicYearRequest {
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}

export interface UpdateAcademicYearRequest {
  name?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
}

export interface AcademicYearListResponse {
  academic_years: AcademicYear[];
  total: number;
}

// ── Academic Term ────────────────────────────────────────────

export interface AcademicTerm {
  id: string;
  academic_year_id: string;
  academic_year_name: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAcademicTermRequest {
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}

export interface UpdateAcademicTermRequest {
  name?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
}

export interface AcademicTermListResponse {
  academic_terms: AcademicTerm[];
  total: number;
}
