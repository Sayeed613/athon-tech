/** Athon — Authentication Types */

export type UserRole = "super_admin" | "school_admin" | "principal" | "teacher" | "student" | "parent";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  school_id: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface SchoolContext {
  user_id: string;
  school_id: string;
  role: UserRole;
  email: string;
}

export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  schoolContext: SchoolContext | null;
}

export interface AuthTokens {
  accessToken: string;
}
