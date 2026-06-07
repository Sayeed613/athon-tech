/** Athon — Base API Service */

import http, { ApiClientError } from "@/lib/axios";
import type { PaginatedResponse, PaginationParams, RequestParams } from "@/types/api";

/**
 * Generic CRUD service factory.
 * Every entity service extends this pattern.
 */
export class BaseService<T, TCreate = Record<string, unknown>, TUpdate = Record<string, unknown>> {
  constructor(protected endpoint: string) {}

  /** GET /{endpoint} — paginated list */
  async list(params?: RequestParams): Promise<PaginatedResponse<T>> {
    const { data } = await http.get<PaginatedResponse<T>>(this.endpoint, { params });
    return data;
  }

  /** GET /{endpoint}/{id} — single item */
  async get(id: string): Promise<T> {
    const { data } = await http.get<T>(`${this.endpoint}/${id}`);
    return data;
  }

  /** POST /{endpoint} — create */
  async create(payload: TCreate): Promise<T> {
    const { data } = await http.post<T>(this.endpoint, payload);
    return data;
  }

  /** PATCH /{endpoint}/{id} — update */
  async update(id: string, payload: TUpdate): Promise<T> {
    const { data } = await http.patch<T>(`${this.endpoint}/${id}`, payload);
    return data;
  }

  /** DELETE /{endpoint}/{id} — soft-delete */
  async delete(id: string): Promise<void> {
    await http.delete(`${this.endpoint}/${id}`);
  }

  /** Utility: wrap paginated list with default params */
  protected paginationParams(params?: PaginationParams): PaginationParams {
    return {
      page: 1,
      page_size: 25,
      ...params,
    };
  }
}

export { ApiClientError };
