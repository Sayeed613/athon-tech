# ATHON V2 — Authentication Module Implementation

**Reviewer**: Principal Backend Engineer (Google)  
**Stack**: Next.js 15 · TypeScript · Supabase Auth · PostgreSQL · JWT · Zod  
**Product**: Athon — AI Teacher Operating System for CBSE Schools  
**Date**: June 10, 2026

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [Folder Structure](#2-folder-structure)
3. [Environment Variables](#3-environment-variables)
4. [Schemas (Zod)](#4-schemas-zod)
5. [Services](#5-services)
6. [Repositories](#6-repositories)
7. [RequestContext](#7-requestcontext)
8. [Middleware](#8-middleware)
9. [API Routes](#9-api-routes)
10. [RBAC Decorators](#10-rbac-decorators)
11. [Audit Logging](#11-audit-logging)
12. [API Flow Diagrams](#12-api-flow-diagrams)
13. [Testing Checklist](#13-testing-checklist)
14. [Security Considerations](#14-security-considerations)

---

## 1. Database Schema

### 1.1 Tables

#### `users` (core identity)

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_user_id UUID NOT NULL UNIQUE,          -- Supabase Auth user ID
    school_id       UUID NOT NULL REFERENCES schools(id),
    email           VARCHAR(255) NOT NULL UNIQUE,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    role            user_role NOT NULL,              -- ENUM: school_admin | principal | teacher | student | parent
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    last_login_ip   INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ                       -- Soft delete
);

CREATE INDEX idx_users_school_id ON users(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_supabase_id ON users(supabase_user_id);
CREATE UNIQUE INDEX idx_users_active_email ON users(email) WHERE deleted_at IS NULL;
```

#### `sessions` (user session tracking)

```sql
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    school_id       UUID NOT NULL REFERENCES schools(id),
    refresh_token   TEXT NOT NULL UNIQUE,             -- Hashed refresh token
    refresh_token_hashed TEXT NOT NULL UNIQUE,        -- SHA-256 hash of refresh token
    access_token_jti UUID NOT NULL,                    -- JWT ID for revocation
    ip_address      INET,
    user_agent      TEXT,
    device_info     JSONB,
    expires_at      TIMESTAMPTZ NOT NULL,
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_revoked      BOOLEAN NOT NULL DEFAULT false,
    revoked_at      TIMESTAMPTZ,
    revoked_reason  VARCHAR(100),                     -- 'logout', 'rotation', 'compromised'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id) WHERE is_revoked = false;
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token_hashed);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at) WHERE is_revoked = false;
```

#### `audit_logs` (authentication events)

```sql
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id),
    event_type      audit_event_type NOT NULL,        -- ENUM: see below
    actor_id        UUID,                              -- NULL for failed logins (no user)
    actor_email     VARCHAR(255),
    actor_role      user_role,
    ip_address      INET NOT NULL,
    user_agent      TEXT,
    resource_type   VARCHAR(50),                       -- 'session', 'user', etc.
    resource_id     UUID,
    details         JSONB,                             -- Event-specific metadata
    outcome         VARCHAR(20) NOT NULL,              -- 'success', 'failure'
    failure_reason  VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_202606 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_logs_202607 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type, created_at DESC);
CREATE INDEX idx_audit_logs_school ON audit_logs(school_id, created_at DESC);
CREATE INDEX idx_audit_logs_outcome ON audit_logs(outcome, created_at DESC);
```

### 1.2 ENUMs

```sql
-- Reuse existing if present
CREATE TYPE user_role AS ENUM (
    'super_admin',
    'school_admin',
    'principal',
    'teacher',
    'student',
    'parent'
);

CREATE TYPE audit_event_type AS ENUM (
    'auth:login',
    'auth:login_failed',
    'auth:logout',
    'auth:refresh',
    'auth:refresh_failed',
    'auth:password_reset_request',
    'auth:password_reset_complete',
    'auth:account_locked',
    'auth:session_revoked',
    'user:created',
    'user:role_changed',
    'user:deactivated'
);
```

### 1.3 RLS Policies

```sql
-- Users table: users can see their own record; school admins see their school
CREATE POLICY users_select ON users FOR SELECT USING (
    id = auth.uid()::uuid
    OR school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid)
);

CREATE POLICY users_update ON users FOR UPDATE USING (
    id = auth.uid()::uuid
    OR (
        EXISTS (
            SELECT 1 FROM users
            WHERE supabase_user_id = auth.uid()::uuid
            AND role IN ('school_admin', 'super_admin')
        )
        AND school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid)
    )
);

-- Sessions: users see own sessions; admins see school sessions
CREATE POLICY sessions_select ON sessions FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid)
    OR school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid
                     AND role = 'school_admin')
);

-- Audit logs: principals/admins see school logs; users see own
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (
    actor_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid)
    OR school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid
                     AND role IN ('school_admin', 'principal'))
);
```

---

## 2. Folder Structure

```
src/modules/auth/
├── auth.service.ts              # Business logic: login, logout, refresh, me
├── auth.repository.ts           # Database access: users, sessions, audit
├── auth.router.ts               # API route handlers
├── auth.validator.ts            # Zod schemas for request validation
├── auth.schema.ts               # TypeScript type definitions
├── auth.middleware.ts           # authenticate(), authorize() middleware
├── auth.decorator.ts            # @WithAuth(), @RequireRole() decorator helpers
├── auth.config.ts               # Auth-specific configuration
├── auth.utils.ts                # Token hashing, cookie helpers
│
src/modules/users/               # Consumed by auth module
├── users.repository.ts          # User lookup, profile queries
├── users.schema.ts              # User types
│
src/core/auth/
├── session.ts                   # Server-side session handling
├── middleware.ts                # Next.js middleware (route protection)
├── providers.ts                 # Auth providers configuration (Supabase)
│
src/core/authorization/
├── rbac.ts                      # AuthorizationService (role checks + scope)
├── scoping.ts                   # Data scope enforcement
├── policies/                    # Per-module permission policies
│   ├── attendance.policy.ts
│   ├── assignments.policy.ts
│   └── ...
│
src/core/audit/
├── audit.service.ts             # Audit logging service
├── audit.middleware.ts          # Auto-audit middleware
│
src/core/auth/
├── context.ts                   # RequestContext type definition
```

---

## 3. Environment Variables

```bash
# .env.local / .env.production

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...           # Service role key (server-side only)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # Anon key (client-side)

# Auth
SESSION_COOKIE_NAME=athon_session
SESSION_COOKIE_DOMAIN=.athonschool.com   # Or localhost for dev
JWT_SECRET=your-jwt-secret                # For server-side token verification

# Auth Rate Limiting
AUTH_MAX_LOGIN_ATTEMPTS=5
AUTH_LOGIN_WINDOW_MS=60000                # 1 minute
AUTH_LOCKOUT_DURATION_MS=900000           # 15 minutes

# Password Reset
PASSWORD_RESET_TOKEN_EXPIRY_MS=3600000    # 1 hour
PASSWORD_RESET_RATE_LIMIT=3               # per hour per email

# Session
SESSION_REFRESH_TOKEN_EXPIRY_DAYS=30
SESSION_ACCESS_TOKEN_EXPIRY_MINUTES=15
```

---

## 4. Schemas (Zod)

```typescript
// src/modules/auth/auth.validator.ts

import { z } from 'zod';

// ─── Request Schemas ─────────────────────────────────────────

export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refresh_token: z.string().uuid('Invalid refresh token format'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirm_password: z.string(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

// ─── Response Schemas ────────────────────────────────────────

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  role: z.enum(['school_admin', 'principal', 'teacher', 'student', 'parent']),
  school_id: z.string().uuid(),
});

export const LoginResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  user: UserResponseSchema,
});

export const MeResponseSchema = z.object({
  user: UserResponseSchema,
  school: z.object({
    id: z.string().uuid(),
    name: z.string(),
    logo_url: z.string().nullable(),
  }),
  permissions: z.array(z.string()),
});

export const RefreshResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

export const MessageResponseSchema = z.object({
  message: z.string(),
});

// ─── Types ───────────────────────────────────────────────────

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RefreshRequest = z.infer<typeof RefreshTokenSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;
```

---

## 5. Services

```typescript
// src/modules/auth/auth.service.ts

import { createHash, randomUUID } from 'crypto';
import { AuthRepository } from './auth.repository';
import { UsersRepository } from '../users/users.repository';
import { AuditService } from '@/core/audit/audit.service';
import { CacheManager } from '@/core/cache/cache-manager';
import { createClient } from '@/core/database/client';
import { AuthorizationService } from '@/core/authorization/rbac';
import {
  AppError,
  AuthenticationError,
  ForbiddenError,
  RateLimitError,
} from '@/core/errors/app-error';

export class AuthService {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly userRepo: UsersRepository,
    private readonly audit: AuditService,
    private readonly cache: CacheManager,
    private readonly supabase: ReturnType<typeof createClient>,
    private readonly authorizationService: AuthorizationService,
    private readonly appUrl: string = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  ) {}

  // ─── Login ────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
    deviceInfo: { ip: string; userAgent: string },
  ): Promise<LoginResponse> {
    // 1. Check rate limit
    await this.checkLoginRateLimit(email, deviceInfo.ip);

    // 2. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      // 3. Log failed attempt
      await this.audit.log({
        eventType: 'auth:login_failed',
        actorEmail: email,
        ipAddress: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        details: { reason: authError?.message ?? 'Unknown error' },
        outcome: 'failure',
        failureReason: authError?.message,
      });

      // 4. Increment rate limit counter
      await this.incrementLoginAttempts(email, deviceInfo.ip);

      throw new AuthenticationError('Invalid email or password');
    }

    // 5. Look up user in our database
    const user = await this.userRepo.findBySupabaseId(authData.user.id);
    if (!user) {
      throw new AuthenticationError('Account not found');
    }

    if (!user.is_active) {
      // Log and revoke the Supabase session
      await this.supabase.auth.admin.deleteUser(authData.user.id);
      throw new AuthenticationError('Account is inactive');
    }

    // 6. Create session record
    const refreshTokenHash = this.hashToken(authData.session.refresh_token);
    const session = await this.authRepo.createSession({
      user_id: user.id,
      school_id: user.school_id,
      refresh_token: authData.session.refresh_token,
      refresh_token_hashed: refreshTokenHash,
      access_token_jti: this.extractJti(authData.session.access_token),
      ip_address: deviceInfo.ip,
      user_agent: deviceInfo.userAgent,
      device_info: {},
      expires_at: this.getRefreshTokenExpiry(),
    });

    // 7. Update last_login
    await this.userRepo.updateLastLogin(user.id, deviceInfo.ip);

    // 8. Log success
    await this.audit.log({
      eventType: 'auth:login',
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      ipAddress: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      resourceType: 'session',
      resourceId: session.id,
      outcome: 'success',
    });

    // 9. Return tokens + user
    return {
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      expires_in: authData.session.expires_in ?? 3600,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        school_id: user.school_id,
      },
    };
  }

  // ─── Logout ───────────────────────────────────────────────

  async logout(
    userId: string,
    schoolId: string,
    sessionId: string,
    deviceInfo: { ip: string; userAgent: string },
  ): Promise<void> {
    // 1. Revoke session
    await this.authRepo.revokeSession(sessionId, 'logout');

    // 2. Revoke Supabase session
    const user = await this.userRepo.findById(userId);
    if (user?.supabase_user_id) {
      await this.supabase.auth.admin.signOut(user.supabase_user_id);
    }

    // 3. Log audit
    await this.audit.log({
      eventType: 'auth:logout',
      actorId: userId,
      ipAddress: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      resourceType: 'session',
      resourceId: sessionId,
      outcome: 'success',
    });
  }

  // ─── Get Current User ────────────────────────────────────

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AuthenticationError('User not found');

    const school = await this.userRepo.getSchool(user.school_id);

    // Get user's full permission list
    const permissions = await this.getUserPermissions(user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        school_id: user.school_id,
      },
      school: {
        id: school.id,
        name: school.name,
        logo_url: school.logo_url,
      },
      permissions,
    };
  }

  // ─── Refresh Token ─────────────────────────────────────────

  async refreshToken(
    refreshToken: string,
    deviceInfo: { ip: string; userAgent: string },
  ): Promise<RefreshResponse> {
    const hashedToken = this.hashToken(refreshToken);

    // 1. Validate refresh token in our database
    const session = await this.authRepo.findSessionByRefreshToken(hashedToken);
    if (!session || session.is_revoked || session.expires_at < new Date()) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    // 2. Refresh with Supabase
    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      // Revoke session on failed refresh (token may be compromised)
      await this.authRepo.revokeSession(session.id, 'rotation');
      await this.audit.log({
        eventType: 'auth:refresh_failed',
        actorId: session.user_id,
        ipAddress: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        details: { error: error?.message },
        outcome: 'failure',
      });
      throw new AuthenticationError('Session expired, please log in again');
    }

    // 3. Rotate tokens — revoke old, create new
    const newRefreshHash = this.hashToken(data.session.refresh_token);
    const newSession = await this.authRepo.rotateSession(session.id, {
      refresh_token: data.session.refresh_token,
      refresh_token_hashed: newRefreshHash,
      access_token_jti: this.extractJti(data.session.access_token),
      expires_at: this.getRefreshTokenExpiry(),
    });

    await this.audit.log({
      eventType: 'auth:refresh',
      actorId: session.user_id,
      ipAddress: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      resourceType: 'session',
      resourceId: newSession.id,
      details: { rotatedFrom: session.id },
      outcome: 'success',
    });

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in ?? 3600,
    };
  }

  // ─── Forgot Password ──────────────────────────────────────

  async forgotPassword(
    email: string,
    deviceInfo: { ip: string; userAgent: string },
  ): Promise<void> {
    // Always return success — don't reveal if email exists
    // Rate limit per email — increment BEFORE the check to enforce exactly 3
    const resetKey = `password:reset:${email}`;
    const currentCount = await this.cache.incr(resetKey, 3600); // 1 hour TTL

    if (currentCount > 3) {
      await this.audit.log({
        eventType: 'auth:password_reset_request',
        actorEmail: email,
        ipAddress: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        details: { reason: 'Rate limited', count: currentCount },
        outcome: 'failure',
      });
      return; // Silently succeed — don't reveal rate limit
    }

    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${this.appUrl}/auth/reset-password`,
    });

    await this.audit.log({
      eventType: 'auth:password_reset_request',
      actorEmail: email,
      ipAddress: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      resourceType: 'user',
      details: { email },
      outcome: error ? 'failure' : 'success',
    });
  }

  // ─── Reset Password ───────────────────────────────────────

  async resetPassword(
    userId: string,
    password: string,
    deviceInfo: { ip: string; userAgent: string },
  ): Promise<void> {
    // The caller (reset-password route) provides the userId from the
    // authenticated session context (Supabase validates the magic-link token).
    const { error } = await this.supabase.auth.updateUser({
      password,
    });

    if (error) {
      throw new AppError('Failed to reset password. Token may be expired.');
    }

    // Revoke all sessions for this user (force re-login everywhere)
    await this.authRepo.revokeAllUserSessions(userId, 'password_reset');

    await this.audit.log({
      eventType: 'auth:password_reset_complete',
      actorId: userId,
      ipAddress: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      outcome: 'success',
    });
  }

  // ─── Private Helpers ──────────────────────────────────────

  private async checkLoginRateLimit(
    email: string,
    ip: string,
  ): Promise<void> {
    const emailKey = `login:attempts:email:${email}`;
    const ipKey = `login:attempts:ip:${ip}`;

    const emailAttempts = parseInt(await this.cache.get(emailKey) ?? '0');
    const ipAttempts = parseInt(await this.cache.get(ipKey) ?? '0');

    if (emailAttempts >= 5 || ipAttempts >= 10) {
      const lockoutKey = `login:lockout:${email}`;
      const locked = await this.cache.get(lockoutKey);
      if (locked) {
        await this.audit.log({
          eventType: 'auth:login_failed',
          actorEmail: email,
          ipAddress: ip,
          details: { reason: 'Account temporarily locked' },
          outcome: 'failure',
          failureReason: 'Rate limit exceeded',
        });
        throw new RateLimitError('Too many login attempts. Try again in 15 minutes.');
      }

      // Set lockout for 15 minutes
      await this.cache.setex(lockoutKey, 900, '1');
    }
  }

  private async incrementLoginAttempts(email: string, ip: string): Promise<void> {
    const emailKey = `login:attempts:email:${email}`;
    const ipKey = `login:attempts:ip:${ip}`;

    await this.cache.incr(emailKey, 60);  // Reset after 1 minute
    await this.cache.incr(ipKey, 60);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private extractJti(token: string): string {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    // Supabase JWT uses 'session_id' claim. Fall back to 'jti' if missing.
    return payload.session_id ?? payload.jti ?? randomUUID();
  }

  private getRefreshTokenExpiry(): Date {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  }

  private async getUserPermissions(role: string): Promise<string[]> {
    // Delegate to AuthorizationService (single source of truth for RBAC).
    // The permission map lives in core/authorization/rbac.ts — not here.
    // If caching is needed, wrap the call:
    return this.cache.getOrSet(
      `permissions:${role}`,
      () => this.authorizationService.getPermissions(role),
      3600, // Cache for 1 hour
    );
  }
}
```

---

## 6. Repositories

```typescript
// src/modules/auth/auth.repository.ts

import { BaseRepository } from '@/core/database/base.repository';
import { createClient } from '@/core/database/client';
import { DatabaseError } from '@/core/errors/app-error';

// ─── Type Definitions ───────────────────────────────────────

interface SessionRecord {
  id: string;
  user_id: string;
  school_id: string;
  refresh_token: string;
  refresh_token_hashed: string;
  access_token_jti: string;
  ip_address: string;
  user_agent: string;
  device_info: Record<string, unknown>;
  expires_at: Date;
  last_accessed_at: Date;
  is_revoked: boolean;
  revoked_at: Date | null;
  revoked_reason: string | null;
  created_at: Date;
}

interface CreateSessionInput {
  user_id: string;
  school_id: string;
  refresh_token: string;
  refresh_token_hashed: string;
  access_token_jti: string;
  ip_address: string;
  user_agent: string;
  device_info: Record<string, unknown>;
  expires_at: Date;
}

// ─── Repository ─────────────────────────────────────────────

export class AuthRepository {
  constructor(
    private readonly db: ReturnType<typeof createClient>,
  ) {}

  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    const { data, error } = await this.db
      .from('sessions')
      .insert({
        user_id: input.user_id,
        school_id: input.school_id,
        refresh_token: input.refresh_token,
        refresh_token_hashed: input.refresh_token_hashed,
        access_token_jti: input.access_token_jti,
        ip_address: input.ip_address,
        user_agent: input.user_agent,
        device_info: input.device_info,
        expires_at: input.expires_at.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new DatabaseError('Failed to create session', { cause: error });
    }
    return data;
  }

  async findSessionByRefreshToken(hashedToken: string): Promise<SessionRecord | null> {
    const { data, error } = await this.db
      .from('sessions')
      .select('*')
      .eq('refresh_token_hashed', hashedToken)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new DatabaseError('Failed to find session', { cause: error });
    }
    return data;
  }

  async findSessionById(sessionId: string): Promise<SessionRecord | null> {
    const { data, error } = await this.db
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new DatabaseError('Failed to find session', { cause: error });
    }
    return data;
  }

  async findSessionByAccessTokenJti(accessTokenJti: string): Promise<SessionRecord | null> {
    const { data, error } = await this.db
      .from('sessions')
      .select('*')
      .eq('access_token_jti', accessTokenJti)
      .eq('is_revoked', false)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new DatabaseError('Failed to find session by access token JTI', { cause: error });
    }
    return data;
  }

  async rotateSession(
    oldSessionId: string,
    newTokenData: {
      refresh_token: string;
      refresh_token_hashed: string;
      access_token_jti: string;
      expires_at: Date;
    },
  ): Promise<SessionRecord> {
    // Revoke old session
    const { error: revokeError } = await this.db
      .from('sessions')
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
        revoked_reason: 'rotation',
      })
      .eq('id', oldSessionId);

    if (revokeError) {
      throw new DatabaseError('Failed to revoke session', { cause: revokeError });
    }

    // Read old session to copy user/school
    const oldSession = await this.findSessionById(oldSessionId);
    if (!oldSession) {
      throw new DatabaseError('Original session not found during rotation');
    }

    // Create new session with same user/school
    return this.createSession({
      user_id: oldSession.user_id,
      school_id: oldSession.school_id,
      refresh_token: newTokenData.refresh_token,
      refresh_token_hashed: newTokenData.refresh_token_hashed,
      access_token_jti: newTokenData.access_token_jti,
      ip_address: oldSession.ip_address,
      user_agent: oldSession.user_agent,
      device_info: oldSession.device_info,
      expires_at: newTokenData.expires_at,
    });
  }

  async revokeSession(
    sessionId: string,
    reason: 'logout' | 'rotation' | 'compromised' | 'password_reset',
  ): Promise<void> {
    const { error } = await this.db
      .from('sessions')
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
        revoked_reason: reason,
      })
      .eq('id', sessionId);

    if (error) {
      throw new DatabaseError('Failed to revoke session', { cause: error });
    }
  }

  async revokeAllUserSessions(
    userId: string,
    reason: 'logout' | 'password_reset' | 'compromised',
  ): Promise<void> {
    const { error } = await this.db
      .from('sessions')
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
        revoked_reason: reason,
      })
      .eq('user_id', userId)
      .eq('is_revoked', false);

    if (error) {
      throw new DatabaseError('Failed to revoke user sessions', { cause: error });
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    const { data, error } = await this.db
      .from('sessions')
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
        revoked_reason: 'expired',
      })
      .lt('expires_at', new Date().toISOString())
      .eq('is_revoked', false)
      .select('id');

    if (error) {
      throw new DatabaseError('Failed to clean up sessions', { cause: error });
    }
    return data?.length ?? 0;
  }

  async getActiveSessionsByUser(userId: string): Promise<SessionRecord[]> {
    const { data, error } = await this.db
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_revoked', false)
      .gt('expires_at', new Date().toISOString())
      .order('last_accessed_at', { ascending: false });

    if (error) {
      throw new DatabaseError('Failed to get active sessions', { cause: error });
    }
    return data;
  }
}
```

### 6.2 UsersRepository Interface

The `AuthService` depends on `UsersRepository` for user lookups. Below is the interface it must satisfy. Implementation lives in `src/modules/users/users.repository.ts`.

```typescript
// src/modules/users/users.repository.ts (interface consumed by auth)

export interface UserRecord {
  id: string;
  supabase_user_id: string;
  school_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'school_admin' | 'principal' | 'teacher' | 'student' | 'parent';
  is_active: boolean;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface SchoolRecord {
  id: string;
  name: string;
  logo_url: string | null;
}

export class UsersRepository {
  constructor(private readonly db: ReturnType<typeof createClient>) {}

  async findBySupabaseId(supabaseUserId: string): Promise<UserRecord | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('supabase_user_id', supabaseUserId)
      .is('deleted_at', null)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('id', userId)
      .is('deleted_at', null)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateLastLogin(userId: string, ip: string): Promise<void> {
    await this.db.from('users').update({
      last_login_at: new Date().toISOString(),
      last_login_ip: ip,
    }).eq('id', userId);
  }

  async getSchool(schoolId: string): Promise<SchoolRecord | null> {
    const { data, error } = await this.db
      .from('schools')
      .select('id, name, logo_url')
      .eq('id', schoolId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getProfileId(userId: string, role: string): Promise<string | null> {
    // Map role to profile table and fetch the ID
    const tableMap: Record<string, string> = {
      teacher: 'teachers',
      student: 'students',
      parent: 'parents',
      principal: 'principals',
    };
    const table = tableMap[role];
    if (!table) return null;

    const { data: profile } = await this.db
      .from(table)
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    return profile?.id ?? null;
  }
}
```

---

## 7. RequestContext

```typescript
// src/core/auth/context.ts

/**
 * RequestContext — the authentication and authorization context
 * attached to every authenticated request.
 *
 * Populated by the authenticate() middleware and passed through
 * to every service method. This is the source of truth for
 * "who is making this request" throughout the request lifecycle.
 */
export interface RequestContext {
  /** The user's database UUID (from users table) */
  userId: string;

  /** The user's Supabase Auth UUID (from auth.users) */
  supabaseUserId: string;

  /** The school UUID this user belongs to */
  schoolId: string;

  /** The user's role */
  role: 'school_admin' | 'principal' | 'teacher' | 'student' | 'parent';

  /** The user's profile type ID (teacher_id, student_id, parent_id, etc.) */
  profileId: string | null;

  /** The user's email address */
  email: string;

  /** The current session UUID */
  sessionId: string;

  /** The current academic term UUID (set by school context middleware) */
  currentTermId: string | null;

  /** The request IP address */
  ipAddress: string;

  /** The request User-Agent */
  userAgent: string;

  /** Unique request identifier for tracing */
  requestId: string;

  /** ISO timestamp when the request started */
  timestamp: string;
}
```

---

## 8. Middleware

### 8.1 authenticate()

```typescript
// src/modules/auth/auth.middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { RequestContext } from '@/core/auth/context';
import { UsersRepository } from '../users/users.repository';
import { AuthRepository } from './auth.repository';
import { AuthenticationError, ForbiddenError } from '@/core/errors/app-error';

/**
 * authenticate() — Extracts RequestContext from the Supabase session.
 *
 * Uses httpOnly cookies (never localStorage) to read the session.
 * Returns null if no valid session exists — use authorize() to enforce.
 *
 * Can be used as:
 *   1. Next.js middleware (edge): const ctx = await authenticate(request);
 *   2. Route handler: const ctx = await authenticate(request);
 *   3. Server action: const ctx = await authenticate();
 */
export async function authenticate(
  request?: NextRequest,
): Promise<RequestContext | null> {
  try {
    // Create a Supabase client that reads cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            if (request) {
              return request.cookies.get(name)?.value;
            }
            // Server action: use the cookies() from next/headers
            const { cookies } = require('next/headers');
            return cookies().get(name)?.value;
          },
        },
      },
    );

    // Verify session with Supabase
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
      return null;
    }

    // Decode JWT once — both for RequestContext and session revocation check
    const jwtPayload = JSON.parse(
      Buffer.from(session.access_token.split('.')[1], 'base64').toString(),
    );

    // Extract session identifier: Supabase uses 'session_id', fallback to 'jti'
    const accessTokenSessionId = jwtPayload.session_id ?? jwtPayload.jti ?? '';

    // Look up user in Athon DB
    const db = createClient();
    const userRepo = new UsersRepository(db);
    const authRepo = new AuthRepository(db);

    const user = await userRepo.findBySupabaseId(session.user.id);
    if (!user || !user.is_active) {
      return null;
    }

    // Verify session hasn't been revoked in Athon DB (defense-in-depth)
    if (accessTokenSessionId) {
      const dbSession = await authRepo.findSessionByAccessTokenJti(accessTokenSessionId);
      if (!dbSession || dbSession.is_revoked) {
        return null; // Session was revoked by admin or password reset
      }
    }

    // Resolve profileId
    const profileId = await userRepo.getProfileId(user.id, user.role);

    // Build RequestContext
    return {
      userId: user.id,
      supabaseUserId: session.user.id,
      schoolId: user.school_id,
      role: user.role,
      profileId,
      email: user.email,
      sessionId: accessTokenSessionId,
      currentTermId: null, // Set by school context middleware
      ipAddress: request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                  ?? request?.headers.get('x-real-ip')
                  ?? '127.0.0.1',
      userAgent: request?.headers.get('user-agent') ?? '',
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
```

### 8.2 authorize()

```typescript
/**
 * authorize() — Enforces RBAC on top of authenticate().
 *
 * Throws 401 if not authenticated, 403 if wrong role or scope.
 *
 * Usage:
 *   const ctx = await authorize(request, ['teacher', 'admin']);
 *   // ctx is guaranteed non-null past this point
 */
export async function authorize(
  request: NextRequest,
  requiredRoles?: string[],
  scopeCheck?: (ctx: RequestContext) => Promise<boolean> | boolean,
): Promise<RequestContext> {
  const ctx = await authenticate(request);

  if (!ctx) {
    throw new AuthenticationError('Authentication required');
  }

  // Role check
  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(ctx.role)) {
      throw new ForbiddenError(
        `Access denied. Required role: ${requiredRoles.join(' or ')}. Your role: ${ctx.role}`,
      );
    }
  }

  // Scope check
  if (scopeCheck) {
    const hasScope = await scopeCheck(ctx);
    if (!hasScope) {
      throw new ForbiddenError('You do not have access to this resource');
    }
  }

  return ctx;
}

/**
 * authorizeApi() — For API route handlers. Returns NextResponse on failure.
 *
 * Usage:
 *   const { ctx, response } = await authorizeApi(request, ['teacher']);
 *   if (response) return response;
 *   // ctx is safe to use
 */
export async function authorizeApi(
  request: NextRequest,
  requiredRoles?: string[],
  scopeCheck?: (ctx: RequestContext) => Promise<boolean> | boolean,
): Promise<{ ctx: RequestContext | null; response: NextResponse | null }> {
  try {
    const ctx = await authorize(request, requiredRoles, scopeCheck);
    return { ctx, response: null };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return {
        ctx: null,
        response: NextResponse.json(
          { error: { code: 'AUTH_001', message: error.message } },
          { status: 401 },
        ),
      };
    }
    if (error instanceof ForbiddenError) {
      return {
        ctx: null,
        response: NextResponse.json(
          { error: { code: 'AUTHZ_001', message: error.message } },
          { status: 403 },
        ),
      };
    }
    return {
      ctx: null,
      response: NextResponse.json(
        { error: { code: 'INT_001', message: 'Authentication error' } },
        { status: 500 },
      ),
    };
  }
}
```

### 8.3 Next.js Edge Middleware (Route Protection)

```typescript
// src/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Next.js Edge Middleware — protects routes at the CDN/edge level.
 *
 * Protected routes:
 *   /dashboard/*       → Any authenticated user
 *   /admin/*           → school_admin only
 *   /api/*             → Any authenticated user
 *   /auth/*            → No auth required (login, reset-password)
 *
 * Public routes:
 *   /auth/login
 *   /auth/forgot-password
 *   /auth/reset-password
 *   /api/health
 *   /_next/*
 *   /favicon.ico
 *   /images/*
 */

const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/api/health',
];

const ADMIN_ROUTES = ['/admin'];

const ROLE_ROUTES: Record<string, string[]> = {
  '/admin': ['school_admin'],
  '/principal': ['principal', 'school_admin'],
  '/teacher': ['teacher', 'principal', 'school_admin'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static assets
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico' || pathname.startsWith('/images')) {
    return NextResponse.next();
  }

  // Check session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
      },
    },
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    // Redirect to login, preserving the intended destination
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route protection
  // Decode JWT to get role
  const jwtPayload = JSON.parse(
    Buffer.from(session.access_token.split('.')[1], 'base64').toString(),
  );

  const userRole = jwtPayload.user_role ?? '';

  // Check if current path requires specific roles
  for (const [route, allowedRoles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(route) && !allowedRoles.includes(userRole)) {
      // Redirect to appropriate dashboard based on role
      const roleDashboards: Record<string, string> = {
        school_admin: '/admin/dashboard',
        principal: '/principal/dashboard',
        teacher: '/teacher/dashboard',
        student: '/student/dashboard',
        parent: '/parent/dashboard',
      };
      const dashboard = roleDashboards[userRole] ?? '/dashboard';
      return NextResponse.redirect(new URL(dashboard, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images).*)',
  ],
};
```

---

## 9. API Routes

### 9.1 POST /auth/login

```typescript
// src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/modules/auth/auth.service';
import { LoginRequestSchema } from '@/modules/auth/auth.validator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = LoginRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VAL_001',
            message: 'Invalid input',
            details: { fields: parsed.error.flatten().fieldErrors },
          },
        },
        { status: 422 },
      );
    }

    const authService = createAuthService();
    const result = await authService.login(
      parsed.data.email,
      parsed.data.password,
      {
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? request.headers.get('x-real-ip')
            ?? '127.0.0.1',
        userAgent: request.headers.get('user-agent') ?? '',
      },
    );

    // Set httpOnly cookie for the refresh token
    const response = NextResponse.json({ data: result }, { status: 200 });
    response.cookies.set('athon_refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
```

### 9.2 POST /auth/logout

```typescript
// src/app/api/auth/logout/route.ts

export async function POST(request: NextRequest) {
  try {
    const ctx = await authorize(request);
    const authService = createAuthService();

    await authService.logout(ctx.userId, ctx.schoolId, ctx.sessionId, {
      ip: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const response = NextResponse.json(
      { data: { message: 'Logged out successfully' } },
      { status: 200 },
    );

    // Clear refresh token cookie
    response.cookies.set('athon_refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
```

### 9.3 GET /auth/me

```typescript
// src/app/api/auth/me/route.ts

export async function GET(request: NextRequest) {
  try {
    const ctx = await authorize(request);
    const authService = createAuthService();
    const result = await authService.getMe(ctx.userId);

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleAuthError(error);
  }
}
```

### 9.4 POST /auth/refresh

```typescript
// src/app/api/auth/refresh/route.ts

export async function POST(request: NextRequest) {
  try {
    // Read refresh token from httpOnly cookie OR request body
    const refreshToken = request.cookies.get('athon_refresh_token')?.value;
    if (!refreshToken) {
      return NextResponse.json(
        { error: { code: 'AUTH_001', message: 'Refresh token required' } },
        { status: 401 },
      );
    }

    const authService = createAuthService();
    const result = await authService.refreshToken(refreshToken, {
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? request.headers.get('x-real-ip')
          ?? '127.0.0.1',
      userAgent: request.headers.get('user-agent') ?? '',
    });

    // Rotate the refresh token cookie
    const response = NextResponse.json({ data: result });
    response.cookies.set('athon_refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
```

### 9.5 POST /auth/forgot-password

```typescript
// src/app/api/auth/forgot-password/route.ts

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ForgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VAL_001',
            message: 'Invalid input',
            details: { fields: parsed.error.flatten().fieldErrors },
          },
        },
        { status: 422 },
      );
    }

    const authService = createAuthService();
    await authService.forgotPassword(parsed.data.email, {
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1',
      userAgent: request.headers.get('user-agent') ?? '',
    });

    // Always return success — don't reveal if email exists
    return NextResponse.json(
      { data: { message: 'If this email is registered, you will receive a password reset link.' } },
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
```

### 9.6 POST /auth/reset-password

```typescript
// src/app/api/auth/reset-password/route.ts

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VAL_001',
            message: 'Invalid input',
            details: { fields: parsed.error.flatten().fieldErrors },
          },
        },
        { status: 422 },
      );
    }

    const ctx = await authorize(request);
    const authService = createAuthService();
    await authService.resetPassword(ctx.userId, parsed.data.password, {
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1',
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json(
      { data: { message: 'Password reset successfully. Please log in with your new password.' } },
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
```

### 9.7 Error Handler

```typescript
// src/modules/auth/auth.utils.ts

import { NextResponse } from 'next/server';
import {
  AuthenticationError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from '@/core/errors/app-error';

export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { error: { code: 'AUTH_001', message: error.message } },
      { status: 401 },
    );
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: { code: 'AUTHZ_001', message: error.message } },
      { status: 403 },
    );
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { error: { code: 'RL_001', message: error.message } },
      { status: 429 },
    );
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: { code: 'VAL_001', message: error.message, details: error.details } },
      { status: 422 },
    );
  }

  // Unknown error — don't leak details
  console.error('Unhandled auth error:', error);
  return NextResponse.json(
    { error: { code: 'INT_001', message: 'An unexpected error occurred' } },
    { status: 500 },
  );
}
```

---

## 10. RBAC Decorators

```typescript
// src/modules/auth/auth.decorator.ts

import { NextRequest } from 'next/server';
import { RequestContext } from '@/core/auth/context';
import { ForbiddenError } from '@/core/errors/app-error';
import { authenticate, authorize } from './auth.middleware';

/**
 * @WithAuth() — Wraps a route handler to inject RequestContext.
 *
 * Usage:
 *   export const GET = WithAuth()(async (ctx: RequestContext) => {
 *     const data = await myService.doSomething(ctx);
 *     return Response.json({ data });
 *   });
 */
export function WithAuth() {
  return function <T>(
    handler: (ctx: RequestContext, ...args: any[]) => T | Promise<T>,
  ) {
    return async (request: NextRequest, ...args: any[]): Promise<T | Response> => {
      try {
        const ctx = await authenticate(request);
        if (!ctx) {
          return Response.json(
            { error: { code: 'AUTH_001', message: 'Authentication required' } },
            { status: 401 },
          ) as T;
        }
        return handler(ctx, request, ...args);
      } catch (error) {
        // Error handler middleware will catch this upstream
        throw error;
      }
    };
  };
}

/**
 * @RequireRole('teacher', 'admin') — Guards a handler by role.
 *
 * Usage:
 *   export const POST = RequireRole('teacher')(
 *     async (ctx: RequestContext, request: NextRequest) => {
 *       const body = await request.json();
 *       return Response.json({ data: await assignmentService.create(ctx, body) });
 *     }
 *   );
 */
export function RequireRole(...roles: string[]) {
  return function <T>(
    handler: (ctx: RequestContext, ...args: any[]) => T | Promise<T>,
  ) {
    return async (request: NextRequest, ...args: any[]): Promise<T | Response> => {
      try {
        const ctx = await authenticate(request);
        if (!ctx) {
          return Response.json(
            { error: { code: 'AUTH_001', message: 'Authentication required' } },
            { status: 401 },
          ) as T;
        }

        if (roles.length > 0 && !roles.includes(ctx.role)) {
          return Response.json(
            {
              error: {
                code: 'AUTHZ_001',
                message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${ctx.role}`,
              },
            },
            { status: 403 },
          ) as T;
        }

        return handler(ctx, request, ...args);
      } catch (error) {
        throw error;
      }
    };
  };
}

/**
 * @ScopeCheck((ctx, args) => checkTeachersClass(ctx, args.classId))
 *
 * Runs a custom scope check function after auth + role check.
 */
export function ScopeCheck(
  checker: (ctx: RequestContext, request: NextRequest, ...args: any[]) => boolean | Promise<boolean>,
) {
  return function <T>(
    handler: (ctx: RequestContext, ...args: any[]) => T | Promise<T>,
  ) {
    return async (request: NextRequest, ...args: any[]): Promise<T | Response> => {
      // authenticate and role check happen before scope
      try {
        const ctx = await authenticate(request);
        if (!ctx) {
          return Response.json(
            { error: { code: 'AUTH_001', message: 'Authentication required' } },
            { status: 401 },
          ) as T;
        }

        const allowed = await checker(ctx, request, ...args);
        if (!allowed) {
          return Response.json(
            { error: { code: 'AUTHZ_002', message: 'You do not have access to this resource' } },
            { status: 403 },
          ) as T;
        }

        return handler(ctx, request, ...args);
      } catch (error) {
        throw error;
      }
    };
  };
}

// ─── Usage Examples ─────────────────────────────────────────

// Example 1: Simple auth
// export const GET = WithAuth()(async (ctx) => {
//   return Response.json({ data: await notificationService.list(ctx) });
// });

// Example 2: Role-gated
// export const POST = RequireRole('teacher', 'admin')(async (ctx, request) => {
//   const body = await request.json();
//   return Response.json({ data: await assignmentService.create(ctx, body) });
// });

// Example 3: Role + scope
// export const PATCH = RequireRole('teacher')(ScopeCheck(ownAssignment)(async (ctx, request) => {
//   const body = await request.json();
//   return Response.json({ data: await assignmentService.update(ctx, body) });
// }));
```

---

## 11. Audit Logging

```typescript
// src/core/audit/audit.service.ts

import { createClient } from '@/core/database/client';
import { DatabaseError } from '@/core/errors/app-error';

export type AuditEventType =
  | 'auth:login'
  | 'auth:login_failed'
  | 'auth:logout'
  | 'auth:refresh'
  | 'auth:refresh_failed'
  | 'auth:password_reset_request'
  | 'auth:password_reset_complete'
  | 'auth:account_locked'
  | 'auth:session_revoked'
  | 'user:created'
  | 'user:role_changed'
  | 'user:deactivated';

export interface AuditLogInput {
  eventType: AuditEventType;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  outcome: 'success' | 'failure';
  failureReason?: string;
}

export class AuditService {
  constructor(
    private readonly db: ReturnType<typeof createClient>,
  ) {}

  async log(input: AuditLogInput): Promise<void> {
    const payload = {
      event_type: input.eventType,
      actor_id: input.actorId ?? null,
      actor_email: input.actorEmail ?? null,
      actor_role: input.actorRole ?? null,
      ip_address: input.ipAddress,
      user_agent: input.userAgent ?? null,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      details: input.details ?? null,
      outcome: input.outcome,
      failure_reason: input.failureReason ?? null,
    };

    // Fire-and-forget: never block the main flow for audit logging
    this.db
      .from('audit_logs')
      .insert(payload)
      .select('id')
      .then(({ error }) => {
        if (error) {
          console.error('Audit log write failed:', error);
        }
      });
  }
}
```

---

## 12. API Flow Diagrams

### 12.1 Login Flow

```
Client                          API Server                        Supabase Auth             Athon DB
  │                                │                                  │                       │
  │  POST /auth/login              │                                  │                       │
  │  {email, password}             │                                  │                       │
  │ ─────────────────────────────►│                                  │                       │
  │                                │                                  │                       │
  │                         1. Validate input (Zod)                   │                       │
  │                         2. Check rate limit (Redis)               │                       │
  │                                │                                  │                       │
  │                         3. Authenticate                           │                       │
  │                                │ ── POST /auth/v1/token ────────►│                       │
  │                                │◄── { access_token, ─────────────│                       │
  │                                │      refresh_token, user }       │                       │
  │                                │                                  │                       │
  │                         4. Look up user                           │                       │
  │                                │ ── SELECT * FROM users ────────────────────────────────►│
  │                                │◄── User record ────────────────────────────────────────│
  │                                │                                  │                       │
  │                         5. Check is_active                        │                       │
  │                         6. Create session                         │                       │
  │                                │ ── INSERT INTO sessions ────────────────────────────────►│
  │                                │                                  │                       │
  │                         7. Log audit                              │                       │
  │                                │ ── INSERT INTO audit_logs ──────────────────────────────►│
  │                                │                                  │                       │
  │                         8. Update last_login                      │                       │
  │                                │ ── UPDATE users ────────────────────────────────────────►│
  │                                │                                  │                       │
  │◄── { access_token, ───────────│                                  │                       │
  │      refresh_token (cookie),   │                                  │                       │
  │      user }                    │                                  │                       │
```

### 12.2 Token Refresh Flow

```
Client                          API Server                        Supabase Auth             Athon DB
  │                                │                                  │                       │
  │  POST /auth/refresh            │                                  │                       │
  │  Cookie: refresh_token         │                                  │                       │
  │ ─────────────────────────────►│                                  │                       │
  │                                │                                  │                       │
  │                         1. Read refresh_token from httpOnly cookie │                       │
  │                         2. Hash token                             │                       │
  │                         3. Look up session by hashed token        │                       │
  │                                │ ── SELECT FROM sessions ────────────────────────────────►│
  │                                │◄── Session record ──────────────────────────────────────│
  │                                │                                  │                       │
  │                         4. Check: not revoked, not expired        │                       │
  │                                │                                  │                       │
  │                         5. Refresh with Supabase                  │                       │
  │                                │ ── auth.refreshSession() ───────►│                       │
  │                                │◄── New tokens ──────────────────│                       │
  │                                │                                  │                       │
  │                         6. Rotate session (revoke old, create new)│                       │
  │                                │ ── UPDATE sessions (revoke) ────────────────────────────►│
  │                                │ ── INSERT new session ──────────────────────────────────►│
  │                                │                                  │                       │
  │                         7. Log audit                              │                       │
  │                                │ ── INSERT audit_logs ───────────────────────────────────►│
  │                                │                                  │                       │
  │◄── New tokens ────────────────│                                  │                       │
  │     (access + new refresh      │                                  │                       │
  │      in updated cookie)        │                                  │                       │
```

### 12.3 Authenticated Request Flow

```
Client                          API Server                        Supabase Auth             Athon DB
  │                                │                                  │                       │
  │  GET /api/v1/assignments       │                                  │                       │
  │  Cookie: session               │                                  │                       │
  │ ─────────────────────────────►│                                  │                       │
  │                                │                                  │                       │
  │    Middleware: authenticate()   │                                  │                       │
  │                                │                                  │                       │
  │                         1. Read session cookie                    │                       │
  │                         2. Verify with Supabase                   │                       │
  │                                │ ── auth.getSession() ───────────►│                       │
  │                                │◄── Session ─────────────────────│                       │
  │                                │                                  │                       │
  │                         3. Decode JWT → supabase_user_id          │                       │
  │                         4. Look up user in DB                     │                       │
  │                                │ ── SELECT users ───────────────────────────────────────►│
  │                                │◄── User ────────────────────────────────────────────────│
  │                                │                                  │                       │
  │                         5. Build RequestContext                    │                       │
  │                                │                                  │                       │
  │    Route: authorize()          │                                  │                       │
  │                         6. Role check: teacher? ✓                 │                       │
  │                         7. Scope check: teaches class? ✓          │                       │
  │                                │                                  │                       │
  │    Handler: service call       │                                  │                       │
  │                         8. Execute with RequestContext             │                       │
  │                                │                                  │                       │
  │◄── { data: [...] } ───────────│                                  │                       │
```

---

## 13. Testing Checklist

### 13.1 Unit Tests

| Test | Scenario | Expected | Priority |
|------|----------|----------|----------|
| `login: valid credentials` | Email + password correct | Returns access_token, refresh_token, user | P0 |
| `login: invalid password` | Wrong password | 401, audit log created | P0 |
| `login: inactive account` | is_active = false | 401, account locked message | P0 |
| `login: rate limited email` | 5+ attempts in 1 min | 429, lockout after threshold | P0 |
| `login: rate limited IP` | 10+ attempts from same IP | 429, lockout after threshold | P0 |
| `login: email not found in Athon DB` | Valid Supabase, no user record | 401, "Account not found" | P0 |
| `login: supabase_user_id mismatch` | Different supabase_id in DB | Sync and proceed | P1 |
| `login: missing email` | Empty email field | 422 validation error | P1 |
| `login: missing password` | Empty password field | 422 validation error | P1 |
| `login: XSS in email` | `<script>` in email | 422 validation error | P2 |
| `logout: valid session` | Logged in user | Session revoked, Supabase sign out | P0 |
| `logout: already logged out` | No session | 401 | P0 |
| `logout: session from another user` | Wrong session ID | 403 or silently no-op | P1 |
| `refresh: valid token` | Token not expired | New tokens, old revoked | P0 |
| `refresh: expired token` | Past expiry | 401 | P0 |
| `refresh: revoked token` | Already revoked | 401 | P0 |
| `refresh: tampered token` | Invalid hash | 401 | P1 |
| `refresh: rotation replay` | Use old token after rotation | 401 (stolen token protection) | P0 |
| `me: authenticated` | Valid session | Returns user + school + permissions | P0 |
| `me: no session` | No cookie | 401 | P0 |
| `me: inactive user` | is_active = false | 401 | P0 |
| `me: deleted user` | Soft-deleted user | 401 | P1 |
| `forgot_password: valid email` | Registered email | Always 200, rate limited | P0 |
| `forgot_password: unknown email` | Not registered | 200 (don't reveal) | P0 |
| `forgot_password: rate limited` | 3+ requests in 1 hour | Silently succeed, no email sent | P1 |
| `reset_password: valid token` | Supabase magic link valid | Password updated, sessions revoked | P0 |
| `reset_password: expired token` | Token past expiry | 400 | P0 |
| `reset_password: weak password` | No uppercase | 422 validation | P1 |
| `reset_password: mismatch` | password !== confirm_password | 422 | P1 |

### 13.2 Integration Tests

| Test | Scenario | Expected | Priority |
|------|----------|----------|----------|
| Login → Refresh → API call | Full auth flow | Tokens work, session rotated | P0 |
| Login → Logout → Refresh | Use refresh after logout | 401 (session revoked) | P0 |
| Login → API call → Expire → Refresh | Simulate token expiry | Auto-refresh, successful API call | P0 |
| Concurrent refresh | Two refresh requests same token | One succeeds, one fails (rotation) | P1 |
| Session cleanup | Expired sessions | Cleanup job marks them revoked | P1 |
| Audit log partitioning | Insert across month boundary | Data lands in correct partition | P2 |

### 13.3 Security Tests

| Test | Scenario | Expected | Priority |
|------|----------|----------|----------|
| JWT tampering | Modified payload | 401 | P0 |
| Refresh token in localStorage | Check no cookie leak | Never stored client-side | P0 |
| CSRF on refresh endpoint | Cross-site request | SameSite=Strict blocks | P0 |
| Brute force login | 100 attempts in 1 minute | Locked after 5 email / 10 IP | P0 |
| SQL injection in email | `' OR 1=1--` | 422 validation | P0 |
| Cookie theft (XSS) | Malicious script reads cookies | httpOnly prevents | P0 |
| Race condition on rate limit | 10 simultaneous login attempts | Exactly 5 counted | P1 |
| Session fixation | Pre-set session cookie | Server generates new session | P1 |

### 13.4 Performance Tests

| Test | Target | Method |
|------|--------|--------|
| Login latency | < 500ms (p95) | Supabase auth + DB lookup |
| Auth/me latency | < 100ms (p95) | Cache user profile + permissions |
| Token refresh latency | < 300ms (p95) | DB rotation + Supabase refresh |
| Concurrent logins | 50 req/s | Rate limiting kicks in at 5/email/min |
| Audit log throughput | 1000 inserts/s | Partitioned table, fire-and-forget |

---

## 14. Security Considerations

### 14.1 Cookie Configuration

```typescript
// Production cookie settings
const COOKIE_OPTIONS = {
  httpOnly: true,           // Not accessible via JavaScript
  secure: true,             // HTTPS only
  sameSite: 'strict' as const, // No cross-site requests
  path: '/api/auth',        // Scoped to auth endpoints
  maxAge: 30 * 24 * 60 * 60, // 30 days
};
```

### 14.2 Token Protection

| Token | Where Stored | Lifetime | Rotation | Revocation |
|-------|-------------|----------|----------|------------|
| Access Token | Memory (client) | 15 minutes | Via refresh | N/A (short-lived) |
| Refresh Token | httpOnly cookie | 30 days | Every refresh | On logout/password reset |
| Supabase Session | Server (cookie) | Session lifetime | Via Supabase | On admin revoke |

### 14.3 Rate Limiting Summary

| Endpoint | Per Email | Per IP | Per User | Window |
|----------|-----------|--------|----------|--------|
| POST /auth/login | 5 | 10 | — | 1 min |
| POST /auth/forgot-password | 3 | — | — | 1 hour |
| POST /auth/refresh | — | 30 | 10 | 1 min |
| GET /auth/me | — | — | 60 | 1 min |
| POST /auth/logout | — | — | 10 | 1 min |

### 14.4 What Not To Do (V1 mistakes)

| V1 Mistake | Impact | V2 Fix |
|-----------|--------|--------|
| Tokens stored in localStorage | XSS could steal tokens | httpOnly cookies only |
| No refresh token rotation | Stolen refresh token = permanent access | Rotate on every use |
| No rate limiting on login | Brute force attack | IP + email rate limiting |
| No audit log for failed logins | No visibility into attacks | Every login attempt logged |
| No session tracking | Cannot revoke individual sessions | Sessions table with revocation |
| Password validation client-side only | Weak passwords accepted | Zod validation server-side |
| No account lockout | Unlimited brute force | Lock after 5 failed attempts |

---

## Appendix A: Error Codes

```typescript
export const AUTH_ERROR_CODES = {
  AUTH_001: { status: 401, message: 'Authentication required' },
  AUTH_002: { status: 401, message: 'Invalid email or password' },
  AUTH_003: { status: 401, message: 'Account is inactive' },
  AUTH_004: { status: 401, message: 'Session expired, please log in again' },
  AUTH_005: { status: 401, message: 'Invalid or expired refresh token' },
  AUTH_006: { status: 401, message: 'Account not found' },
  AUTH_007: { status: 423, message: 'Account locked due to too many failed attempts' },

  AUTHZ_001: { status: 403, message: 'Access denied. Insufficient role permissions.' },
  AUTHZ_002: { status: 403, message: 'You do not have access to this resource' },

  RL_001: { status: 429, message: 'Too many login attempts. Try again later.' },
  RL_002: { status: 429, message: 'Too many password reset requests. Try again later.' },

  VAL_001: { status: 422, message: 'Invalid input' },
  VAL_002: { status: 422, message: 'Password must be at least 8 characters' },
  VAL_003: { status: 422, message: 'Passwords do not match' },
} as const;
```

## Appendix B: Dependency Injection Setup

```typescript
// src/modules/auth/auth.container.ts

import { createClient } from '@/core/database/client';
import { CacheManager } from '@/core/cache/cache-manager';
import { AuditService } from '@/core/audit/audit.service';
import { AuthRepository } from './auth.repository';
import { UsersRepository } from '../users/users.repository';
import { AuthService } from './auth.service';

// ⚠️ DO NOT use a global singleton in production.
// Singletons hold stale DB connections on serverless/edge runtimes.
//
// Correct approaches (choose one):
//   1. Request-scoped: new AuthService(...) per request via middleware
//   2. DI framework: tsyringe / inversify / NestJS-style providers
//   3. AsyncLocalStorage: store per-request instances in Node.js context
//
// Below is a REQUEST-SCOPED factory for use in route handlers.
// It creates fresh instances per invocation. In a real app, wrap this
// with a DI container that manages connection pooling.

export function createAuthService(): AuthService {
  const db = createClient();                // Fresh DB client per request
  const cache = new CacheManager();          // Redis connection pool (shared)
  const supabase = createServiceRoleClient(); // Service-role Supabase client
  const authzService = new AuthorizationService(db, cache);

  return new AuthService(
    new AuthRepository(db),
    new UsersRepository(db),
    new AuditService(db),
    cache,
    supabase,
    authzService,
  );
}
```

---

**Document Version**: 1.0  
**Date**: June 10, 2026  
**Next Action**: Generate module scaffolding (files, types, migrations)
