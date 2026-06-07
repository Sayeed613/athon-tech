/** Athon — Subject Type Definitions */

export interface Subject {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_core: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSubjectRequest {
  name: string;
  code: string;
  description?: string;
  is_core?: boolean;
}

export interface UpdateSubjectRequest {
  name?: string;
  code?: string;
  description?: string;
  is_core?: boolean;
}

export interface SubjectListResponse {
  subjects: Subject[];
  total: number;
}
