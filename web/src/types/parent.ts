/** Parent type definitions matching backend schemas. */

/** A student linked to a parent via student_parents junction table. */
export interface ParentLinkedStudent {
  id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  relationship: string;
  is_primary_contact: boolean;
}

/** Standard parent profile response. */
export interface Parent {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  occupation: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  linked_students: ParentLinkedStudent[];
}

/** Paginated list response for parents. */
export interface ParentListResponse {
  parents: Parent[];
  total: number;
  skip: number;
  limit: number;
}

/** Create parent request body. */
export interface CreateParentRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  occupation?: string | null;
}

/** Update parent request body (all fields optional). */
export interface UpdateParentRequest {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  occupation?: string | null;
  is_active?: boolean | null;
}

/** Link parent to student request body. */
export interface LinkParentRequest {
  student_id: string;
  parent_id: string;
  relationship: string;
  is_primary_contact: boolean;
  receive_whatsapp: boolean;
}

/** Link parent to student response. */
export interface LinkParentResponse {
  id: string;
  student_id: string;
  parent_id: string;
  relationship: string;
  is_primary_contact: boolean;
  receive_whatsapp: boolean;
}
