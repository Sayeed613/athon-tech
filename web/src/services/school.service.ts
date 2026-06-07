/** Athon — School API Service */

import http from "@/lib/axios";
import { API_ENDPOINTS } from "@/constants";

export interface SchoolProfile {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
}

export const schoolService = {
  /** GET /schools/{id} */
  async get(id: string): Promise<SchoolProfile> {
    const { data } = await http.get<SchoolProfile>(API_ENDPOINTS.SCHOOLS.GET(id));
    return data;
  },

  /** PATCH /schools/{id} */
  async update(id: string, payload: Partial<SchoolProfile>): Promise<SchoolProfile> {
    const { data } = await http.patch<SchoolProfile>(API_ENDPOINTS.SCHOOLS.UPDATE(id), payload);
    return data;
  },
};
