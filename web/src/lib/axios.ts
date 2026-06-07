/** Athon — Axios HTTP Client */

import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { config } from "@/config";

let storeRef: { getState: () => { token: string | null; logout: () => void } } | undefined;

/**
 * Inject the Zustand auth store reference after it's created to avoid
 * circular dependency between the Axios instance and the auth store.
 */
export function injectAuthStore(
  store: { getState: () => { token: string | null; logout: () => void } },
) {
  storeRef = store;
}

const http: AxiosInstance = axios.create({
  baseURL: config.api.baseUrl,
  timeout: config.api.timeout,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request Interceptor ──────────────────────────────────────────
http.interceptors.request.use(
  (req: InternalAxiosRequestConfig) => {
    const token = storeRef?.getState()?.token;
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
  },
  (error) => Promise.reject(error),
);

// ── Response Interceptor ─────────────────────────────────────────
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    if (error.response?.status === 401) {
      storeRef?.getState()?.logout();
    }

    const message =
      error.response?.data?.detail ??
      error.message ??
      "An unexpected error occurred";

    return Promise.reject(new ApiClientError(message, error.response?.status ?? 0));
  },
);

/**
 * Typed API client error with HTTP status code.
 */
export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isValidationError() {
    return this.status === 422;
  }

  get isServerError() {
    return this.status >= 500;
  }
}

export default http;
