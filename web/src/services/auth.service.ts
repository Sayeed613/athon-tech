/** Athon — Authentication Service */

import http from "@/lib/axios";
import { API_ENDPOINTS } from "@/constants";
import type { LoginRequest, LoginResponse, UserProfile, SchoolContext } from "@/types/auth";

export const authService = {
  /** POST /auth/login */
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const { data } = await http.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, payload);
    return data;
  },

  /** GET /auth/me — returns current user profile */
  async me(): Promise<UserProfile> {
    const { data } = await http.get<UserProfile>(API_ENDPOINTS.AUTH.ME);
    return data;
  },

  /** GET /auth/context — returns school context with state population */
  async context(): Promise<SchoolContext> {
    const { data } = await http.get<SchoolContext>(API_ENDPOINTS.AUTH.CONTEXT);
    return data;
  },
};
