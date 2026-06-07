/** Athon — Generic API Types */

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  detail: string;
  status_code: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface SearchParams {
  q?: string;
}

export type RequestParams = PaginationParams & SearchParams & Record<string, string | number | boolean | undefined>;

/** Wrapper for TanStack Query patterns */
export type QueryResponse<T> = {
  data: T;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};
