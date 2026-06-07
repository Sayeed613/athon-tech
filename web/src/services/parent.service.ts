import http from "@/lib/axios";
import type {
  Parent,
  ParentListResponse,
  CreateParentRequest,
  UpdateParentRequest,
  LinkParentRequest,
  LinkParentResponse,
} from "@/types/parent";

const BASE = "/parents";
const STUDENT_PARENTS_BASE = "/student-parents";

export const parentService = {
  /** GET /parents — list parents with optional search and filters. */
  async list(params?: {
    search?: string;
    is_active?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<ParentListResponse> {
    const query: Record<string, string> = {};
    if (params?.search) query.search = params.search;
    if (params?.is_active !== undefined)
      query.is_active = String(params.is_active);
    if (params?.skip !== undefined) query.skip = String(params.skip);
    if (params?.limit !== undefined)
      query.limit = String(params.limit);

    const { data } = await http.get<ParentListResponse>(BASE, { params: query });
    return data;
  },

  /** GET /parents/{id} — get parent detail with linked students. */
  async get(id: string): Promise<Parent> {
    const { data } = await http.get<Parent>(`${BASE}/${id}`);
    return data;
  },

  /** POST /parents — create a new parent. */
  async create(body: CreateParentRequest): Promise<Parent> {
    const { data } = await http.post<Parent>(BASE, body);
    return data;
  },

  /** PATCH /parents/{id} — update a parent profile. */
  async update(id: string, body: UpdateParentRequest): Promise<Parent> {
    const { data } = await http.patch<Parent>(`${BASE}/${id}`, body);
    return data;
  },

  /** DELETE /parents/{id} — soft-delete a parent. */
  async deactivate(id: string): Promise<void> {
    await http.delete(`${BASE}/${id}`);
  },

  /** POST /student-parents — link a parent to a student. */
  async linkStudent(body: LinkParentRequest): Promise<LinkParentResponse> {
    const { data } = await http.post<LinkParentResponse>(
      STUDENT_PARENTS_BASE,
      body
    );
    return data;
  },

  /** DELETE /student-parents/{linkId} — unlink a parent from a student. */
  async unlinkStudent(linkId: string): Promise<void> {
    await http.delete(`${STUDENT_PARENTS_BASE}/${linkId}`);
  },
};

/** Query key factory for parents. */
export const parentKeys = {
  all: ["parents"] as const,
  lists: () => [...parentKeys.all, "list"] as const,
  list: (params?: Record<string, unknown>) =>
    [...parentKeys.lists(), params] as const,
  details: () => [...parentKeys.all, "detail"] as const,
  detail: (id: string) => [...parentKeys.details(), id] as const,
};
