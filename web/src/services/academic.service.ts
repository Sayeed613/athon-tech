/** Athon — Academic Calendar API Service */

import http from "@/lib/axios";
import { API_ENDPOINTS } from "@/constants";
import type {
  AcademicYear,
  AcademicYearListResponse,
  CreateAcademicYearRequest,
  UpdateAcademicYearRequest,
  AcademicTerm,
  AcademicTermListResponse,
  CreateAcademicTermRequest,
  UpdateAcademicTermRequest,
} from "@/types/academic";

export const academicService = {
  // ── Academic Years ──────────────────────────────────────────

  /** GET /academic-years — list all years */
  async listYears(): Promise<AcademicYearListResponse> {
    const { data } = await http.get<AcademicYearListResponse>(
      API_ENDPOINTS.ACADEMIC_YEARS.LIST
    );
    return data;
  },

  /** GET /academic-years/{id} — single year */
  async getYear(id: string): Promise<AcademicYear> {
    const { data } = await http.get<AcademicYear>(
      API_ENDPOINTS.ACADEMIC_YEARS.GET(id)
    );
    return data;
  },

  /** POST /academic-years — create year */
  async createYear(payload: CreateAcademicYearRequest): Promise<AcademicYear> {
    const { data } = await http.post<AcademicYear>(
      API_ENDPOINTS.ACADEMIC_YEARS.CREATE,
      payload
    );
    return data;
  },

  /** PATCH /academic-years/{id} — update year */
  async updateYear(
    id: string,
    payload: UpdateAcademicYearRequest
  ): Promise<AcademicYear> {
    const { data } = await http.patch<AcademicYear>(
      API_ENDPOINTS.ACADEMIC_YEARS.UPDATE(id),
      payload
    );
    return data;
  },

  /** DELETE /academic-years/{id} — soft-delete */
  async deleteYear(id: string): Promise<void> {
    await http.delete(API_ENDPOINTS.ACADEMIC_YEARS.DELETE(id));
  },

  // ── Academic Terms ──────────────────────────────────────────

  /** GET /academic-terms — list terms, optionally filtered by year */
  async listTerms(academic_year_id?: string): Promise<AcademicTermListResponse> {
    const { data } = await http.get<AcademicTermListResponse>(
      API_ENDPOINTS.ACADEMIC_TERMS.LIST,
      { params: academic_year_id ? { academic_year_id } : undefined }
    );
    return data;
  },

  /** GET /academic-terms/{id} — single term */
  async getTerm(id: string): Promise<AcademicTerm> {
    const { data } = await http.get<AcademicTerm>(
      API_ENDPOINTS.ACADEMIC_TERMS.GET(id)
    );
    return data;
  },

  /** POST /academic-terms — create term */
  async createTerm(payload: CreateAcademicTermRequest): Promise<AcademicTerm> {
    const { data } = await http.post<AcademicTerm>(
      API_ENDPOINTS.ACADEMIC_TERMS.CREATE,
      payload
    );
    return data;
  },

  /** PATCH /academic-terms/{id} — update term */
  async updateTerm(
    id: string,
    payload: UpdateAcademicTermRequest
  ): Promise<AcademicTerm> {
    const { data } = await http.patch<AcademicTerm>(
      API_ENDPOINTS.ACADEMIC_TERMS.UPDATE(id),
      payload
    );
    return data;
  },

  /** DELETE /academic-terms/{id} — soft-delete */
  async deleteTerm(id: string): Promise<void> {
    await http.delete(API_ENDPOINTS.ACADEMIC_TERMS.DELETE(id));
  },
};
