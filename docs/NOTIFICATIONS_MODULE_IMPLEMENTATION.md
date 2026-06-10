# ATHON V2 — Notifications Module Implementation

**Reviewer**: Staff Backend Engineer
**Stack**: Next.js 15 · TypeScript · Supabase Auth · PostgreSQL · Zod
**Product**: Athon — AI Teacher Operating System for CBSE Schools
**Date**: June 10, 2026
**References**: DATABASE_V2_FINAL.md · ASSIGNMENTS_MODULE_IMPLEMENTATION.md · ATTENDANCE_MODULE_IMPLEMENTATION.md · ASSESSMENTS_MODULE_IMPLEMENTATION.md · Permission Matrix v1.0

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Folder Structure](#3-folder-structure)
4. [Schemas (Zod)](#4-schemas-zod)
5. [Services](#5-services)
6. [API Routes](#6-api-routes)
7. [Permissions](#7-permissions)
8. [Delivery Workflow](#8-delivery-workflow)
9. [Channel Implementations](#9-channel-implementations)
10. [Notification Templates](#10-notification-templates)
11. [Event Triggers](#11-event-triggers)
12. [User Preferences & Opt-Out](#12-user-preferences--opt-out)
13. [Background Jobs & Scheduling](#13-background-jobs--scheduling)
14. [Edge Cases](#14-edge-cases)
15. [Risk Analysis](#15-risk-analysis)
16. [Testing Checklist](#16-testing-checklist)

---

## 1. Architecture Overview

### 1.1 Notification Flow

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Event Source  │────►│ Notification     │────►│ Channel Adapters  │
│  (Service)    │     │ Service          │     │                   │
└──────────────┘     └──────┬──────────┘     │ ┌───────────────┐ │
                            │                 │ │ In-App        │ │
┌──────────────┐            │                 │ │ (WebSocket +  │ │
│  Scheduled    │            │                 │ │  DB Polling)  │ │
│  Jobs        │────────────┤                 │ ├───────────────┤ │
│  (pg_cron)   │            │                 │ │ Email         │ │
└──────────────┘            │                 │ │ (SMTP / API)  │ │
                            │                 │ ├───────────────┤ │
┌──────────────┐            │                 │ │ WhatsApp      │ │
│  External     │            │                 │ │ (Business API)│ │
│  Webhooks    │────────────┘                 │ ├───────────────┤ │
│  (Future)    │                               │ │ Push          │ │
└──────────────┘                               │ │ (FCM / APNs)  │ │
                                               │ └───────────────┘ │
                                               └──────────────────┘
                                                         │
                                                         ▼
                                               ┌──────────────────┐
                                               │ notification_     │
                                               │ recipients table │
                                               └──────────────────┘
                                                         │
                                              ┌──────────┼──────────┐
                                              ▼          ▼          ▼
                                         ┌────────┐ ┌────────┐ ┌────────┐
                                         │ Pending │ │ Sent   │ │ Failed │
                                         └────────┘ └────────┘ └────────┘
                                              │
                                         (Retry worker)
```

### 1.2 Channel Characteristics

| Channel | Latency | Cost | Reliability | Opt-Out Default | Requires |
|---------|---------|------|-------------|-----------------|----------|
| In-App | Real-time (WebSocket) / <1s (Polling) | Free | High | N/A | WebSocket or Polling client |
| Email | ~1-5 min (SMTP) | $0.001/email | Medium (spam, bounces) | ✅ | SMTP config or API key |
| WhatsApp | ~1-2 min | $0.05/message | High | ✅ | WhatsApp Business API |
| Push | ~1-30s | Free (FCM) / $0 (APNs) | Medium (app backgrounded) | ✅ | FCM/APNs credentials |

### 1.3 Priority Levels

| Priority | Latency SLA | Channels | Quiet Hours Exempt | Retry Strategy |
|----------|-------------|----------|-------------------|----------------|
| `low` | Within 30 min | in_app only | N/A (in-app always allowed) | No retry |
| `normal` | Within 5 min | in_app, email | Respect quiet hours | 3 retries, 5-min interval |
| `high` | Within 1 min | in_app, email, whatsapp | Exempt for whatsapp+email | 5 retries, 2-min interval |
| `urgent` | Within 30s | ALL channels simultaneously | Always send | 5 retries, 1-min interval, then escalate to principal |

### 1.4 Event to Priority Mapping

| Event | Priority | Default Channels |
|-------|----------|------------------|
| Attendance marked absent | normal | in_app, whatsapp |
| Attendance 3+ consecutive absences | high | in_app, whatsapp, email |
| Attendance < 75% monthly | high | in_app, email |
| Homework published | low | in_app, email |
| Homework submitted | low | in_app |
| Homework graded | normal | in_app, email |
| Test published | low | in_app |
| Test scheduled (reminder) | normal | in_app |
| Test results published | high | in_app, email, whatsapp |
| Results released (student) | normal | in_app, email |
| Assessment auto-submitted | normal | in_app |
| Assessment proctoring flagged | high | in_app, email |
| Parent alert (student at risk) | high | in_app, email, whatsapp |
| Principal alert (school-wide) | urgent | in_app, email, whatsapp |
| Announcement posted | normal | in_app |
| Weekly summary (AI-generated) | low | email |

---

## 2. Database Schema

### 2.1 Tables

#### `notifications` — Outbound notification record

```sql
CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           UUID NOT NULL REFERENCES schools(id),
    sender_id           UUID REFERENCES users(id),          -- NULL for system-triggered
    notification_type   notification_type NOT NULL,          -- academic, attendance, announcement, behavioral, emergency, system, other
    priority            VARCHAR(10) NOT NULL DEFAULT 'normal',  -- low, normal, high, urgent
    title               VARCHAR(200) NOT NULL,
    body                TEXT,
    metadata            JSONB,                               -- { entityType, entityId, action, ... }
    template_key        VARCHAR(100),                        -- References template definition (Section 10)
    template_vars       JSONB,                               -- Template variables used for rendering
    
    -- Scheduling
    is_sent             BOOLEAN NOT NULL DEFAULT FALSE,      -- All recipients processed?
    sent_at             TIMESTAMPTZ,
    scheduled_at        TIMESTAMPTZ,                         -- For scheduled/delayed delivery
    batch_id            UUID,                                -- Group related notifications (e.g., bulk class publish)
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(id)
);

CREATE INDEX idx_notif_school_recent ON notifications(school_id, created_at DESC);
CREATE INDEX idx_notif_scheduled ON notifications(school_id, scheduled_at)
    WHERE scheduled_at IS NOT NULL AND is_sent = FALSE;
CREATE INDEX idx_notif_sender ON notifications(sender_id, created_at DESC);
CREATE INDEX idx_notif_type ON notifications(school_id, notification_type, created_at DESC);
```

#### `notification_recipients` — Per-recipient delivery tracking

```sql
CREATE TABLE notification_recipients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id     UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id),  -- Recipient user
    
    channel             notification_channel NOT NULL,       -- in_app, email, whatsapp, push
    contact_address     VARCHAR(255),                        -- Email address, phone number, or device token
    locale              VARCHAR(10) DEFAULT 'en',            -- For localized delivery
    
    -- Delivery tracking
    status              notification_status NOT NULL DEFAULT 'pending',  -- pending, sent, delivered, failed, read, unsubscribed
    -- pending: queued for delivery
    -- sent: handed to channel adapter
    -- delivered: confirmed delivered (in-app read, email opened, whatsApp delivered, push delivered)
    -- failed: channel returned error
    -- read: in-app notification was marked as read
    -- unsubscribed: user unsubscribed from this channel (no delivery attempted)
    
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,                         -- In-app read tracking
    failed_at           TIMESTAMPTZ,
    failure_reason      TEXT,                                -- Error message from channel
    retry_count         INTEGER NOT NULL DEFAULT 0,
    
    -- Quiet hours bypass
    delivered_during_quiet_hours BOOLEAN NOT NULL DEFAULT FALSE,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nr_user ON notification_recipients(user_id, created_at DESC);
CREATE INDEX idx_nr_status ON notification_recipients(status, channel, created_at ASC)
    WHERE status = 'pending';
CREATE INDEX idx_nr_pending_delivery ON notification_recipients(status, created_at ASC)
    WHERE status = 'pending' OR status = 'failed';
CREATE INDEX idx_nr_read_filter ON notification_recipients(user_id, read_at)
    WHERE read_at IS NULL AND status = 'sent';
CREATE INDEX idx_nr_notification ON notification_recipients(notification_id);
```

#### `notification_preferences` — NEW: per-user, per-channel opt-out

```sql
CREATE TABLE notification_preferences (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    school_id           UUID NOT NULL REFERENCES schools(id),
    
    -- Per-channel opt-in/opt-out
    channel             notification_channel NOT NULL,
    is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Per-event-type overrides (optional)
    -- NULL = use channel default, specific type = override
    notification_type   notification_type,                    -- NULL means applies to all types
    
    -- Quiet hours (per-channel, per-user)
    quiet_hours_start   TIME,                                -- UTC
    quiet_hours_end     TIME,                                -- UTC
    
    -- Weekly digest flag
    digest_frequency    VARCHAR(20) DEFAULT 'never',          -- never, daily, weekly
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, school_id, channel, notification_type),
    UNIQUE(user_id, school_id, channel)                      -- For wildcard (NULL type)
);

CREATE INDEX idx_np_user ON notification_preferences(user_id);
```

#### `notification_devices` — NEW: push notification device tokens

```sql
CREATE TABLE notification_devices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    school_id           UUID NOT NULL REFERENCES schools(id),
    
    platform            VARCHAR(20) NOT NULL,                  -- 'ios', 'android', 'web'
    device_token        VARCHAR(500) NOT NULL,
    device_name         VARCHAR(100),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at        TIMESTAMPTZ,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, device_token)
);

CREATE INDEX idx_nd_active ON notification_devices(user_id) WHERE is_active = TRUE;
```

### 2.2 ENUMs

```sql
-- Existing from V2:
-- notification_channel: in_app, email, whatsapp, push
-- notification_type: academic, attendance, announcement, behavioral, emergency, system, other
-- notification_status: pending, sent, delivered, failed

-- Extend notification_status for V2 notifications module
ALTER TYPE notification_status ADD VALUE IF NOT EXISTS 'read';
ALTER TYPE notification_status ADD VALUE IF NOT EXISTS 'unsubscribed';

-- New audit event types
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'notification:sent';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'notification:delivered';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'notification:failed';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'notification:batch_sent';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'notification:preference_updated';
```

### 2.3 RLS Policies

```sql
-- Notifications: sender sees what they created; recipient sees what targets them
CREATE POLICY notifications_sender ON notifications FOR SELECT
    USING (sender_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY notifications_recipient ON notifications FOR SELECT
    USING (id IN (
        SELECT notification_id FROM notification_recipients
        WHERE user_id = current_setting('app.current_user_id')::UUID
    ));

CREATE POLICY notifications_admin ON notifications FOR SELECT
    USING (school_id = current_setting('app.current_school_id')::UUID
        AND current_setting('app.current_role') IN ('school_admin', 'principal'));

-- Notification recipients: user sees own; admin sees school
CREATE POLICY nr_user ON notification_recipients FOR SELECT
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY nr_admin ON notification_recipients FOR SELECT
    USING (notification_id IN (
        SELECT id FROM notifications
        WHERE school_id = current_setting('app.current_school_id')::UUID
    ) AND current_setting('app.current_role') IN ('school_admin', 'principal'));

-- Recipient can update read_at
CREATE POLICY nr_mark_read ON notification_recipients FOR UPDATE
    USING (user_id = current_setting('app.current_user_id')::UUID)
    WITH CHECK (user_id = current_setting('app.current_user_id')::UUID
        AND (read_at IS NOT NULL OR status = 'read'));

-- Notification preferences: user manages own
CREATE POLICY np_user ON notification_preferences FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Notification devices: user manages own
CREATE POLICY nd_user ON notification_devices FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID);
```

### 2.4 Materialized View: Delivery Stats

```sql
CREATE MATERIALIZED VIEW mv_notification_delivery_stats AS
SELECT
    n.school_id,
    n.notification_type,
    n.priority,
    n.created_at::DATE AS date,
    COUNT(DISTINCT n.id) AS notifications_sent,
    COUNT(DISTINCT nr.id) AS recipients_total,
    COUNT(DISTINCT nr.id) FILTER (WHERE nr.status = 'sent') AS sent_count,
    COUNT(DISTINCT nr.id) FILTER (WHERE nr.status = 'delivered') AS delivered_count,
    COUNT(DISTINCT nr.id) FILTER (WHERE nr.status = 'read') AS read_count,
    COUNT(DISTINCT nr.id) FILTER (WHERE nr.status = 'failed') AS failed_count,
    COUNT(DISTINCT nr.channel) FILTER (WHERE nr.channel = 'email') AS email_count,
    COUNT(DISTINCT nr.channel) FILTER (WHERE nr.channel = 'whatsapp') AS whatsapp_count,
    COUNT(DISTINCT nr.channel) FILTER (WHERE nr.channel = 'push') AS push_count,
    ROUND(
        COUNT(DISTINCT nr.id) FILTER (WHERE nr.status = 'failed')::NUMERIC
        / NULLIF(COUNT(DISTINCT nr.id), 0) * 100, 1
    ) AS failure_rate,
    MAX(nr.retry_count) AS max_retries
FROM notifications n
LEFT JOIN notification_recipients nr ON nr.notification_id = n.id
GROUP BY n.school_id, n.notification_type, n.priority, n.created_at::DATE;

CREATE UNIQUE INDEX idx_mv_nds_date ON mv_notification_delivery_stats(school_id, notification_type, priority, date);
```

---

## 3. Folder Structure

```
src/core/notifications/
├── notification.service.ts              # Main orchestrator: create, route, deliver
├── notification.repository.ts           # Database access
├── notification.validator.ts            # Zod schemas
├── notification.router.ts               # API route handlers
├── notification.schema.ts               # TypeScript types
├── notification-preference.service.ts   # User preference management
│
├── channels/
│   ├── in-app.channel.ts                # In-app delivery via DB query (polling) + WebSocket events
│   ├── email.channel.ts                 # Email delivery via SMTP / SendGrid / Resend
│   ├── whatsapp.channel.ts              # WhatsApp delivery via Business API / Twilio
│   └── push.channel.ts                  # Push notification via Firebase Cloud Messaging
│
├── templates/
│   ├── notification-templates.ts         # Template definitions (Section 10)
│   └── template-renderer.ts             # Template rendering engine
│
├── workers/
│   ├── notification-sender.cron.ts       # Background job: process pending notifications
│   ├── notification-retry.cron.ts        # Background job: retry failed notifications
│   └── notification-digest.cron.ts       # Background job: compile daily/weekly digests
│
├── events/
│   ├── attendance-events.ts              # Attendance trigger handlers
│   ├── homework-events.ts                # Homework trigger handlers
│   ├── test-events.ts                    # Test trigger handlers
│   ├── result-events.ts                  # Result publish trigger handlers
│   ├── parent-alert-events.ts            # Parent alert trigger handlers
│   └── principal-alert-events.ts         # Principal alert trigger handlers
```

---

## 4. Schemas (Zod)

```typescript
// src/core/notifications/notification.validator.ts

import { z } from 'zod';

const UUID = z.string().uuid();
const Channel = z.enum(['in_app', 'email', 'whatsapp', 'push']);
const Priority = z.enum(['low', 'normal', 'high', 'urgent']);
const NotificationType = z.enum([
  'academic', 'attendance', 'announcement', 'behavioral', 'emergency', 'system', 'other'
]);
const Status = z.enum(['pending', 'sent', 'delivered', 'failed', 'read', 'unsubscribed']);

// ─── Send Notification ──────────────────────────────────────

export const SendNotificationSchema = z.object({
  // Recipients: either direct user_ids or a scope to resolve
  user_ids: z.array(UUID).min(1).max(500).optional(),
  scope: z.object({
    class_id: UUID.optional(),
    role: z.enum(['teacher', 'student', 'parent']).optional(),
    student_ids: z.array(UUID).max(500).optional(),
  }).optional(),

  // Content
  type: NotificationType,
  priority: Priority.default('normal'),
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).optional(),

  // Template (alternative to raw title/body)
  template_key: z.string().max(100).optional(),
  template_vars: z.record(z.unknown()).optional(),

  // Channels (defaults from priority mapping if not specified)
  channels: z.array(Channel).min(1).optional(),

  // Scheduling
  scheduled_at: z.string().datetime().optional(),
}).refine(data => data.user_ids || data.scope, {
  message: 'Either user_ids or scope must be provided',
}).refine(data => data.title || data.template_key, {
  message: 'Either title or template_key must be provided',
});

export type SendNotificationInput = z.infer<typeof SendNotificationSchema>;

// ─── Notification Response ──────────────────────────────────

export const NotificationResponseSchema = z.object({
  id: UUID,
  type: NotificationType,
  priority: Priority,
  title: z.string(),
  body: z.string().nullable(),
  sender_id: UUID.nullable(),
  metadata: z.record(z.unknown()).nullable(),
  template_key: z.string().nullable(),
  is_sent: z.boolean(),
  created_at: z.string(),
  recipients: z.array(z.object({
    id: UUID,
    user_id: UUID,
    channel: Channel,
    status: Status,
    contact_address: z.string().nullable(),
    read_at: z.string().nullable(),
    sent_at: z.string().nullable(),
    delivered_at: z.string().nullable(),
  })),
  recipient_count: z.number(),
});

// ─── List Notifications ─────────────────────────────────────

export const NotificationListQuerySchema = z.object({
  type: NotificationType.optional(),
  priority: Priority.optional(),
  is_sent: z.coerce.boolean().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── User Preferences ───────────────────────────────────────

export const NotificationPreferenceSchema = z.object({
  channel: Channel,
  is_enabled: z.boolean(),
  notification_type: NotificationType.optional(),
  quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  digest_frequency: z.enum(['never', 'daily', 'weekly']).optional(),
});

export const BulkPreferenceSchema = z.object({
  preferences: z.array(NotificationPreferenceSchema).min(1).max(20),
});

// ─── Mark as Read ───────────────────────────────────────────

export const MarkReadSchema = z.object({
  ids: z.array(UUID).min(1).max(100),
});

export const MarkAllReadSchema = z.object({
  type: NotificationType.optional(),
  before: z.string().datetime().optional(),
});

// ─── Device Registration ────────────────────────────────────

export const RegisterDeviceSchema = z.object({
  platform: z.enum(['ios', 'android', 'web']),
  device_token: z.string().min(1).max(500),
  device_name: z.string().max(100).optional(),
});

// ─── Response Types ─────────────────────────────────────────

export const NotificationFeedResponseSchema = z.object({
  data: z.array(z.object({
    id: UUID,
    notification_id: UUID,
    type: NotificationType,
    priority: Priority,
    title: z.string(),
    body: z.string().nullable(),
    channel: Channel,
    status: Status,
    read_at: z.string().nullable(),
    created_at: z.string(),
    metadata: z.record(z.unknown()).nullable(),
  })),
  total: z.number(),
  unread_count: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const UnreadCountResponseSchema = z.object({
  count: z.number(),
});

export const NotificationStatsResponseSchema = z.object({
  total_sent: z.number(),
  today_sent: z.number(),
  delivered_pct: z.number(),
  read_pct: z.number(),
  failed_count: z.number(),
  by_channel: z.object({
    in_app: z.number(),
    email: z.number(),
    whatsapp: z.number(),
    push: z.number(),
  }),
  by_type: z.record(z.number()),
});
```

---

## 5. Services

### 5.1 Main Notification Service

```typescript
// src/core/notifications/notification.service.ts

export class NotificationService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly templateRenderer: TemplateRenderer,
    private readonly inAppChannel: InAppChannel,
    private readonly emailChannel: EmailChannel,
    private readonly whatsAppChannel: WhatsAppChannel,
    private readonly pushChannel: PushChannel,
    private readonly audit: AuditService,
    private readonly authz: AuthorizationService,
    private readonly eventBus: EventBus,
  ) {}

  private readonly CHANNEL_PRIORITY_MAP: Record<string, string[]> = {
    low: ['in_app'],
    normal: ['in_app', 'email'],
    high: ['in_app', 'email', 'whatsapp'],
    urgent: ['in_app', 'email', 'whatsapp', 'push'],
  };

  // ════════════════════════════════════════════════════════════
  // SEND NOTIFICATION
  // ════════════════════════════════════════════════════════════

  async send(
    ctx: RequestContext,
    input: SendNotificationInput,
  ): Promise<NotificationResponse> {
    await this.authz.assert(ctx, 'notifications:send', { classId: input.scope?.class_id });

    // 1. Resolve recipients
    const recipients = await this.resolveRecipients(input, ctx);

    // 2. Determine channels based on priority
    const channels = input.channels ?? this.CHANNEL_PRIORITY_MAP[input.priority] ?? ['in_app'];

    // 3. Create notification record
    const notification = await this.repo.createNotification({
      school_id: ctx.schoolId,
      sender_id: ctx.userId,
      notification_type: input.type,
      priority: input.priority,
      title: input.title,
      body: input.body ?? null,
      metadata: input.metadata ?? null,
      template_key: input.template_key ?? null,
      template_vars: input.template_vars ?? null,
      is_sent: false,
      scheduled_at: input.scheduled_at ?? null,
    });

    // 4. Create recipient-channel records
    const recipientRows: Array<{
      notification_id: string;
      user_id: string;
      channel: string;
      contact_address: string | null;
      locale: string;
    }> = [];

    for (const user of recipients) {
      for (const channel of channels) {
        // Check user preference for this channel
        const isOptedIn = await this.preferenceService.isChannelEnabled(
          user.id, channel, ctx.schoolId, input.type,
        );
        if (!isOptedIn) {
          // Create record with 'unsubscribed' status for audit trail
          recipientRows.push({
            notification_id: notification.id,
            user_id: user.id,
            channel,
            contact_address: null,
            locale: user.locale ?? 'en',
          });
          continue;
        }

        // Resolve contact address
        const contactAddress = await this.resolveContactAddress(user, channel, ctx.schoolId);

        if (!contactAddress && channel !== 'in_app') {
          // Cannot deliver this channel — skip
          continue;
        }

        recipientRows.push({
          notification_id: notification.id,
          user_id: user.id,
          channel,
          contact_address: contactAddress,
          locale: user.locale ?? 'en',
        });
      }
    }

    if (recipientRows.length === 0) {
      // All recipients opted out — mark as sent
      await this.repo.markNotificationSent(notification.id);
      return this.mapNotificationResponse(notification, []);
    }

    await this.repo.createRecipients(recipientRows);

    // 5. If scheduled, don't send now
    if (input.scheduled_at) {
      return this.mapNotificationResponse(
        notification,
        recipientRows.map(r => ({ ...r, status: 'pending' as const, read_at: null, sent_at: null, delivered_at: null })),
      );
    }

    // 6. Deliver immediately (async — non-blocking)
    await this.deliverNotification(notification.id, ctx.schoolId);

    // 7. Audit
    await this.audit.log({
      eventType: 'notification:sent',
      actorId: ctx.userId,
      resourceType: 'notification',
      resourceId: notification.id,
      details: {
        type: input.type,
        priority: input.priority,
        channels,
        recipientCount: recipients.length,
      },
      outcome: 'success',
    });

    return this.mapNotificationResponse(notification, recipientRows);
  }

  // ════════════════════════════════════════════════════════════
  // DELIVER NOTIFICATION (Called synchronously or by cron)
  // ════════════════════════════════════════════════════════════

  async deliverNotification(
    notificationId: string,
    schoolId: string,
  ): Promise<void> {
    const notification = await this.repo.findNotificationById(notificationId, schoolId);
    if (!notification) return;

    const pendingRecipients = await this.repo.getPendingRecipients(notificationId);

    // Group by channel for batch delivery
    const byChannel: Record<string, typeof pendingRecipients> = {};
    for (const recipient of pendingRecipients) {
      if (recipient.status === 'unsubscribed') continue;
      if (!byChannel[recipient.channel]) byChannel[recipient.channel] = [];
      byChannel[recipient.channel].push(recipient);
    }

    // Deliver to each channel
    const deliveryTasks: Promise<void>[] = [];

    if (byChannel['in_app']) {
      deliveryTasks.push(
        this.inAppChannel.deliver(notification, byChannel['in_app']),
      );
    }
    if (byChannel['email']) {
      deliveryTasks.push(
        this.emailChannel.deliver(notification, byChannel['email']),
      );
    }
    if (byChannel['whatsapp']) {
      deliveryTasks.push(
        this.whatsAppChannel.deliver(notification, byChannel['whatsapp']),
      );
    }
    if (byChannel['push']) {
      deliveryTasks.push(
        this.pushChannel.deliver(notification, byChannel['push']),
      );
    }

    await Promise.allSettled(deliveryTasks);

    // Mark notification as sent
    const allProcessed = pendingRecipients.every(r => r.status !== 'pending');
    if (allProcessed) {
      await this.repo.markNotificationSent(notificationId);
    }

    // Emit WebSocket event for in-app recipients
    await this.eventBus.publish('notification:delivered', {
      notificationId,
      schoolId,
      recipientCount: pendingRecipients.length,
    });
  }

  // ════════════════════════════════════════════════════════════
  // IN-APP FEED
  // ════════════════════════════════════════════════════════════

  async getUserFeed(
    ctx: RequestContext,
    query: {
      type?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<NotificationFeedResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const result = await this.repo.getUserFeed(ctx.userId, ctx.schoolId, {
      type: query.type,
      page,
      limit,
    });

    const unreadCount = await this.repo.getUnreadCount(ctx.userId, ctx.schoolId);

    return {
      data: result.data,
      total: result.total,
      unread_count: unreadCount,
      page,
      limit,
    };
  }

  // ════════════════════════════════════════════════════════════
  // MARK AS READ
  // ════════════════════════════════════════════════════════════

  async markAsRead(
    ctx: RequestContext,
    input: MarkReadInput,
  ): Promise<void> {
    for (const id of input.ids) {
      await this.repo.markRecipientRead(id, ctx.userId);
    }
  }

  async markAllAsRead(
    ctx: RequestContext,
    input: MarkAllReadInput,
  ): Promise<void> {
    await this.repo.markAllRead(ctx.userId, ctx.schoolId, input.type, input.before);
  }

  async getUnreadCount(
    ctx: RequestContext,
  ): Promise<{ count: number }> {
    const count = await this.repo.getUnreadCount(ctx.userId, ctx.schoolId);
    return { count };
  }

  // ════════════════════════════════════════════════════════════
  // NOTIFICATION STATS (Admin/Principal Dashboard)
  // ════════════════════════════════════════════════════════════

  async getStats(
    ctx: RequestContext,
  ): Promise<NotificationStatsResponse> {
    return this.repo.getDeliveryStats(ctx.schoolId);
  }

  // ════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════

  private async resolveRecipients(
    input: SendNotificationInput,
    ctx: RequestContext,
  ): Promise<Array<{ id: string; locale: string | null }>> {
    if (input.user_ids) {
      // Direct user IDs provided
      return input.user_ids.map(id => ({ id, locale: null }));
    }

    if (input.scope) {
      // Resolve by scope
      if (input.scope.class_id) {
        if (input.scope.role === 'student') {
          return this.repo.getStudentUserIdsByClass(input.scope.class_id);
        }
        if (input.scope.role === 'parent') {
          return this.repo.getParentUserIdsByClass(input.scope.class_id);
        }
        if (input.scope.role === 'teacher') {
          return this.repo.getTeacherUserIdsByClass(input.scope.class_id);
        }
        // All roles
        const students = await this.repo.getStudentUserIdsByClass(input.scope.class_id);
        const parents = await this.repo.getParentUserIdsByClass(input.scope.class_id);
        const teachers = await this.repo.getTeacherUserIdsByClass(input.scope.class_id);
        return [...students, ...parents, ...teachers];
      }

      if (input.scope.student_ids) {
        // Get parents of specific students
        return this.repo.getParentUserIdsByStudentIds(input.scope.student_ids);
      }
    }

    throw new ValidationError('No recipients resolved');
  }

  private async resolveContactAddress(
    user: { id: string; locale?: string },
    channel: string,
    schoolId: string,
  ): Promise<string | null> {
    switch (channel) {
      case 'in_app':
        return null; // No address needed
      case 'email':
        return this.repo.getUserEmail(user.id);
      case 'whatsapp':
        return this.repo.getUserPhone(user.id);
      case 'push':
        return this.repo.getActiveDeviceToken(user.id);
      default:
        return null;
    }
  }

  // ─── Helper Methods for Event Handlers ─────────────────────

  // These methods are used by event handlers (Section 5.4) to fetch
  // related entities when processing system-triggered notifications.
  // They are also available for the main send() flow.

  async resolveStudentParents(studentId: string): Promise<Array<{ user_id: string }>> {
    return this.repo.getStudentParents(studentId);
  }

  async getStudentBasic(studentId: string): Promise<{ id: string; first_name: string; last_name: string } | null> {
    return this.repo.getStudentBasic(studentId);
  }

  async getConsecutiveAbsenceCount(studentId: string, latestDate: string): Promise<number> {
    return this.repo.getConsecutiveAbsenceCount(studentId, latestDate);
  }

  async getAssignmentBasic(assignmentId: string): Promise<any> {
    return this.repo.getAssignmentBasic(assignmentId);
  }

  async getAssessmentConfig(assessmentId: string): Promise<any> {
    return this.repo.getAssessmentConfig(assessmentId);
  }

  async getSubmissionBasic(submissionId: string): Promise<any> {
    return this.repo.getSubmissionBasic(submissionId);
  }

  async getAttemptBasic(attemptId: string): Promise<any> {
    return this.repo.getAttemptBasic(attemptId);
  }

  async getStudentUser(studentId: string): Promise<{ user_id: string } | null> {
    return this.repo.getStudentUser(studentId);
  }

  async getTeacherUser(teacherId: string): Promise<{ user_id: string } | null> {
    return this.repo.getTeacherUser(teacherId);
  }

  async getClassTeacher(studentId: string): Promise<{ user_id: string } | null> {
    return this.repo.getClassTeacher(studentId);
  }

  async getPrincipals(schoolId: string): Promise<Array<{ user_id: string }>> {
    return this.repo.getPrincipals(schoolId);
  }

  async getSchoolAdmins(schoolId: string): Promise<Array<{ user_id: string }>> {
    return this.repo.getSchoolAdmins(schoolId);
  }

  async getStudentUserIdsByClass(classId: string): Promise<Array<{ id: string }>> {
    return this.repo.getStudentUserIdsByClass(classId);
  }

  async getParentUserIdsByClass(classId: string): Promise<string[]> {
    return this.repo.getParentUserIdsByClass(classId);
  }

  async getParentUserIdsByStudentId(studentId: string): Promise<string[]> {
    return this.repo.getParentUserIdsByStudentId(studentId);
  }

  async getAssignmentTeacher(assignmentId: string): Promise<{ user_id: string } | null> {
    return this.repo.getAssignmentTeacher(assignmentId);
  }

  // ════════════════════════════════════════════════════════════
  // INTERNAL SEND (System-Triggered)
  // ════════════════════════════════════════════════════════════

  /**
   * Send a notification triggered by the system (not a user).
   * Bypasses authz checks (the system is implicitly authorized).
   * Used by event handlers (Section 5.4) and background jobs (Section 13).
   *
   * `InternalRequestContext` is a lightweight context object:
   *   { schoolId: string; userId?: string; role?: string }
   * For system sends, userId is null (system) and role is 'system'.
   */
  async sendSystem(
    systemCtx: { schoolId: string },
    input: Omit<SendNotificationInput, 'scheduled_at'>,
  ): Promise<void> {
    const ctx = {
      schoolId: systemCtx.schoolId,
      userId: null,
      role: 'system',
      profileId: null,
    } as any;

    // Resolve recipients
    const recipients = await this.resolveRecipients(input, ctx);
    const channels = input.channels ?? this.CHANNEL_PRIORITY_MAP[input.priority] ?? ['in_app'];

    // Create notification record
    const notification = await this.repo.createNotification({
      school_id: ctx.schoolId,
      sender_id: null,
      notification_type: input.type,
      priority: input.priority,
      title: input.title,
      body: input.body ?? null,
      metadata: input.metadata ?? null,
      template_key: input.template_key ?? null,
      template_vars: input.template_vars ?? null,
      is_sent: false,
    });

    // Create recipient records
    const recipientRows: Array<{
      notification_id: string;
      user_id: string;
      channel: string;
      contact_address: string | null;
      locale: string;
    }> = [];

    for (const user of recipients) {
      for (const channel of channels) {
        const isOptedIn = await this.preferenceService.isChannelEnabled(
          user.id, channel, ctx.schoolId, input.type,
        );
        if (!isOptedIn) {
          recipientRows.push({
            notification_id: notification.id,
            user_id: user.id,
            channel,
            contact_address: null,
            locale: user.locale ?? 'en',
          });
          continue;
        }

        const contactAddress = await this.resolveContactAddress(user, channel, ctx.schoolId);
        if (!contactAddress && channel !== 'in_app') continue;

        recipientRows.push({
          notification_id: notification.id,
          user_id: user.id,
          channel,
          contact_address: contactAddress,
          locale: user.locale ?? 'en',
        });
      }
    }

    if (recipientRows.length === 0) {
      await this.repo.markNotificationSent(notification.id);
      return;
    }

    await this.repo.createRecipients(recipientRows);
    await this.deliverNotification(notification.id, ctx.schoolId);
  }

  private mapNotificationResponse(
    notification: any,
    recipients: any[],
  ): NotificationResponse {
    return {
      id: notification.id,
      type: notification.notification_type,
      priority: notification.priority,
      title: notification.title,
      body: notification.body,
      sender_id: notification.sender_id,
      metadata: notification.metadata,
      template_key: notification.template_key,
      is_sent: notification.is_sent,
      created_at: notification.created_at,
      recipients: recipients.map(r => ({
        id: r.id,
        user_id: r.user_id,
        channel: r.channel,
        status: r.status ?? 'pending',
        contact_address: r.contact_address,
        read_at: r.read_at ?? null,
        sent_at: r.sent_at ?? null,
        delivered_at: r.delivered_at ?? null,
      })),
      recipient_count: recipients.length,
    };
  }
}
```

### 5.2 Preference Service

```typescript
// src/core/notifications/notification-preference.service.ts

export class NotificationPreferenceService {
  constructor(private readonly repo: NotificationRepository) {}

  // ════════════════════════════════════════════════════════════
  // CHECK CHANNEL ENABLED
  // ════════════════════════════════════════════════════════════

  async isChannelEnabled(
    userId: string,
    channel: string,
    schoolId: string,
    notificationType?: string,
  ): Promise<boolean> {
    // Check if user has an explicit override for this channel+type
    const preferences = await this.repo.getUserPreferences(userId, schoolId);

    // Type-specific preference takes precedence
    if (notificationType) {
      const typePref = preferences.find(
        p => p.channel === channel && p.notification_type === notificationType,
      );
      if (typePref) return typePref.is_enabled;
    }

    // Channel-wide default
    const channelPref = preferences.find(
      p => p.channel === channel && p.notification_type === null,
    );
    if (channelPref) return channelPref.is_enabled;

    // No explicit preference — enabled by default for all channels
    return true;
  }

  // ════════════════════════════════════════════════════════════
  // SET PREFERENCES
  // ════════════════════════════════════════════════════════════

  async setPreferences(
    ctx: RequestContext,
    input: PreferenceInput[],
  ): Promise<void> {
    for (const pref of input) {
      await this.repo.upsertPreference({
        user_id: ctx.userId,
        school_id: ctx.schoolId,
        channel: pref.channel,
        is_enabled: pref.is_enabled,
        notification_type: pref.notification_type ?? null,
        quiet_hours_start: pref.quiet_hours_start ?? null,
        quiet_hours_end: pref.quiet_hours_end ?? null,
        digest_frequency: pref.digest_frequency ?? 'never',
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  // CHECK QUIET HOURS
  // ════════════════════════════════════════════════════════════

  async isInQuietHours(
    userId: string,
    channel: string,
  ): Promise<boolean> {
    const now = new Date();
    const currentTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;

    const preferences = await this.repo.getUserPreferencesByChannel(userId, channel);
    for (const pref of preferences) {
      if (pref.quiet_hours_start && pref.quiet_hours_end) {
        if (currentTime >= pref.quiet_hours_start && currentTime < pref.quiet_hours_end) {
          return true;
        }
      }
    }

    return false;
  }

  // ════════════════════════════════════════════════════════════
  // GET PREFERENCES
  // ════════════════════════════════════════════════════════════

  async getPreferences(
    ctx: RequestContext,
  ): Promise<any[]> {
    return this.repo.getUserPreferences(ctx.userId, ctx.schoolId);
  }
}
```

### 5.3 Channel Adapters

```typescript
// src/core/notifications/channels/in-app.channel.ts

export class InAppChannel {
  constructor(private readonly repo: NotificationRepository) {}

  async deliver(
    notification: any,
    recipients: any[],
  ): Promise<void> {
    // In-app notifications are delivered via two mechanisms:
    // 1. Database polling: Frontend polls GET /notifications/feed every 30s
    // 2. WebSocket: Server emits event to connected clients (optional, for real-time)
    //
    // This channel simply marks recipients as 'delivered' since in-app
    // notifications are always available (they live in the DB).
    // 'read' status is set when the user opens the notification.

    const now = new Date().toISOString();
    for (const recipient of recipients) {
      await this.repo.updateRecipientStatus(recipient.id, 'delivered', {
        sent_at: now,
        delivered_at: now,
      });
    }
  }
}
```

```typescript
// src/core/notifications/channels/email.channel.ts

export class EmailChannel {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly emailProvider: EmailProvider,  // Injected via DI (SendGrid, Resend, etc.)
  ) {}

  async deliver(
    notification: any,
    recipients: any[],
  ): Promise<void> {
    for (const recipient of recipients) {
      if (!recipient.contact_address) {
        await this.repo.updateRecipientStatus(recipient.id, 'failed', {
          failure_reason: 'No email address',
          failed_at: new Date().toISOString(),
        });
        continue;
      }

      try {
        await this.emailProvider.send({
          to: recipient.contact_address,
          subject: notification.title,
          html: this.renderHtml(notification),
          text: notification.body ?? notification.title,
          metadata: {
            notificationId: notification.id,
            recipientId: recipient.id,
          },
        });

        await this.repo.updateRecipientStatus(recipient.id, 'sent', {
          sent_at: new Date().toISOString(),
        });

        // Delivery confirmation is handled via webhook callback
        // (Provider sends webhook on open/click/bounce)
      } catch (error: any) {
        const failureReason = error.message ?? 'Unknown email error';
        if (recipient.retry_count < 3) {
          // Will be retried by cron job
          await this.repo.incrementRetryCount(recipient.id);
        } else {
          await this.repo.updateRecipientStatus(recipient.id, 'failed', {
            failure_reason: failureReason,
            failed_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  private renderHtml(notification: any): string {
    // Render a simple HTML email template
    return `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #2563eb; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">${notification.title}</h1>
          </div>
          <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb;">
            <p>${notification.body ?? ''}</p>
          </div>
          <div style="padding: 16px; text-align: center; color: #6b7280; font-size: 12px;">
            <p>Athon School Management Platform</p>
            <p style="margin-top: 12px;">
              <a href="{{unsubscribe_url}}" style="color: #6b7280; text-decoration: underline;">
                Unsubscribe from these notifications
              </a>
            </p>
            <p style="margin-top: 4px; color: #9ca3af;">
              You can manage all notification preferences in your account settings.
            </p>
          </div>
        </body>
      </html>
    `;
  }
}
```

```typescript
// src/core/notifications/channels/whatsapp.channel.ts

export class WhatsAppChannel {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly whatsAppProvider: WhatsAppProvider,  // Twilio / WhatsApp Business API
  ) {}

  async deliver(
    notification: any,
    recipients: any[],
  ): Promise<void> {
    for (const recipient of recipients) {
      if (!recipient.contact_address) {
        await this.repo.updateRecipientStatus(recipient.id, 'failed', {
          failure_reason: 'No phone number',
          failed_at: new Date().toISOString(),
        });
        continue;
      }

      // Check quiet hours
      if (notification.priority !== 'urgent') {
        // Quiet hours check happens in the delivery workflow
      }

      // Check quiet hours
      if (notification.priority !== 'urgent') {
        const inQuietHours = await this.preferenceService.isInQuietHours(
          recipient.user_id, 'whatsapp',
        );
        if (inQuietHours) {
          // Skip delivery — cron job will pick it up after quiet hours end
          // The recipient status stays 'pending' and will be retried later
          continue;
        }
      }

      try {
        const message = notification.body
          ? `${notification.title}\n\n${notification.body}`
          : notification.title;

        await this.whatsAppProvider.send({
          to: recipient.contact_address,
          body: message,
          metadata: {
            notificationId: notification.id,
            recipientId: recipient.id,
          },
        });

        await this.repo.updateRecipientStatus(recipient.id, 'sent', {
          sent_at: new Date().toISOString(),
        });

        // WhatsApp provides delivery receipts via webhook
      } catch (error: any) {
        if (recipient.retry_count < 3) {
          await this.repo.incrementRetryCount(recipient.id);
        } else {
          await this.repo.updateRecipientStatus(recipient.id, 'failed', {
            failure_reason: error.message ?? 'WhatsApp delivery failed',
            failed_at: new Date().toISOString(),
          });
        }
      }
    }
  }
}
```

```typescript
// src/core/notifications/channels/push.channel.ts

export class PushChannel {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly fcmProvider: FCMProvider,  // Firebase Cloud Messaging
  ) {}

  async deliver(
    notification: any,
    recipients: any[],
  ): Promise<void> {
    for (const recipient of recipients) {
      if (!recipient.contact_address) {
        await this.repo.updateRecipientStatus(recipient.id, 'failed', {
          failure_reason: 'No device token',
          failed_at: new Date().toISOString(),
        });
        continue;
      }

      try {
        await this.fcmProvider.send({
          token: recipient.contact_address,
          notification: {
            title: notification.title,
            body: notification.body ?? '',
          },
          data: notification.metadata ?? {},
        });

        await this.repo.updateRecipientStatus(recipient.id, 'sent', {
          sent_at: new Date().toISOString(),
        });
      } catch (error: any) {
        // Token may be expired
        if (error.code === 'messaging/registration-token-not-registered') {
          await this.repo.deactivateDeviceToken(recipient.contact_address);
          await this.repo.updateRecipientStatus(recipient.id, 'failed', {
            failure_reason: 'Device token expired',
            failed_at: new Date().toISOString(),
          });
        } else if (recipient.retry_count < 3) {
          await this.repo.incrementRetryCount(recipient.id);
        } else {
          await this.repo.updateRecipientStatus(recipient.id, 'failed', {
            failure_reason: error.message ?? 'Push delivery failed',
            failed_at: new Date().toISOString(),
          });
        }
      }
    }
  }
}
```

### 5.4 Event Handlers

```typescript
// src/core/notifications/events/attendance-events.ts

export function registerAttendanceEventHandlers(eventBus: EventBus, notifSvc: NotificationService): void {
  // Student marked absent
  eventBus.on('attendance:alert', async (event: {
    studentId: string; date: string; status: string; schoolId: string;
  }) => {
    // Get parents of this student
    const parents = await notifSvc.resolveStudentParents(event.studentId);
    if (parents.length === 0) return;

    const student = await notifSvc.getStudentBasic(event.studentId);

    await notifSvc.sendSystem({ schoolId: event.schoolId }, {
      user_ids: parents.map(p => p.user_id),
      type: 'attendance',
      priority: event.status === 'absent' ? 'normal' : 'low',
      title: `Attendance Alert: ${student.first_name} ${student.last_name}`,
      body: `${student.first_name} ${student.last_name} was marked ${event.status} on ${event.date}.`,
      channels: event.status === 'absent' ? ['in_app', 'whatsapp'] : ['in_app'],
      metadata: { studentId: event.studentId, date: event.date, status: event.status },
    });

    // Check consecutive absences
    if (event.status === 'absent') {
      const consecutive = await notifSvc.getConsecutiveAbsenceCount(event.studentId, event.date);
      if (consecutive >= 3) {
        await notifSvc.sendSystem({ schoolId: event.schoolId }, {
          user_ids: parents.map(p => p.user_id),
          type: 'attendance',
          priority: 'high',
          title: '⚠️ Repeated Absence Alert',
          body: `${student.first_name} ${student.last_name} has been absent for ${consecutive} consecutive days. Please contact the school urgently.`,
          channels: ['in_app', 'whatsapp', 'email'],
          metadata: { studentId: event.studentId, consecutive, date: event.date, alertType: 'consecutive_absence' },
        });
      }
    }
  });

  // Attendance record overridden
  eventBus.on('attendance:overridden', async (event: {
    studentId: string; date: string; oldStatus: string; newStatus: string;
    schoolId: string; teacherId: string;
  }) => {
    const parents = await notifSvc.resolveStudentParents(event.studentId);
    const student = await notifSvc.getStudentBasic(event.studentId);

    // Notify parents
    if (parents.length > 0) {
      await notifSvc.sendSystem({ schoolId: event.schoolId }, {
        user_ids: parents.map(p => p.user_id),
        type: 'attendance',
        priority: 'normal',
        title: 'Attendance Updated',
        body: `${student.first_name} ${student.last_name}'s attendance for ${event.date} was updated from ${event.oldStatus} to ${event.newStatus}.`,
        channels: ['in_app'],
        metadata: { studentId: event.studentId, date: event.date, oldStatus: event.oldStatus, newStatus: event.newStatus },
      });
    }

    // Notify original teacher
    const teacher = await notifSvc.getTeacherUser(event.teacherId);
    if (teacher) {
      await notifSvc.sendSystem({ schoolId: event.schoolId }, {
        user_ids: [teacher.user_id],
        type: 'attendance',
        priority: 'normal',
        title: 'Your Attendance Mark Was Overridden',
        body: `Your mark for ${student.first_name} ${student.last_name} on ${event.date} was overridden from ${event.oldStatus} to ${event.newStatus}.`,
        channels: ['in_app'],
        metadata: { studentId: event.studentId, date: event.date, oldStatus: event.oldStatus, newStatus: event.newStatus },
      });
    }
  });
}
```

```typescript
// src/core/notifications/events/homework-events.ts

export function registerHomeworkEventHandlers(eventBus: EventBus, notifSvc: NotificationService): void {
  // Assignment published
  eventBus.on('assignment:published', async (event: {
    assignmentId: string; classId: string; schoolId: string;
  }) => {
    const assignment = await notifSvc.getAssignmentBasic(event.assignmentId);

    // Notify students
    const students = await notifSvc.getStudentUserIdsByClass(event.classId);
    if (students.length > 0) {
      await notifSvc.sendSystem({ schoolId: event.schoolId }, {
        user_ids: students.map(s => s.id),
        type: 'academic',
        priority: 'low',
        title: `New ${assignment.assignment_type}: ${assignment.title}`,
        body: `A new ${assignment.assignment_type} has been published. Due: ${assignment.due_date ?? 'No deadline'}.`,
        channels: ['in_app', 'email'],
        metadata: { assignmentId: event.assignmentId, classId: event.classId, type: 'assignment_published' },
      });
    }
  });

  // Assignment submitted
  eventBus.on('assignment:submitted', async (event: {
    submissionId: string; assignmentId: string; teacherId: string; schoolId: string;
  }) => {
    // Notify teacher of submission
    const teacher = await notifSvc.getTeacherUser(event.teacherId);
    if (teacher) {
      await notifSvc.sendSystem({ schoolId: event.schoolId }, {
        user_ids: [teacher.user_id],
        type: 'academic',
        priority: 'low',
        title: 'Submission Received',
        body: `A student has submitted their assignment.`,
        channels: ['in_app'],
        metadata: { submissionId: event.submissionId, assignmentId: event.assignmentId, type: 'submission_received' },
      });
    }
  });

  // Assignment graded
  eventBus.on('assignment:graded', async (event: {
    submissionId: string; studentId: string; assignmentId: string; schoolId: string;
  }) => {
    // Notify student
    const student = await notifSvc.getStudentUser(event.studentId);
    const assignment = await notifSvc.getAssignmentBasic(event.assignmentId);
    const submission = await notifSvc.getSubmissionBasic(event.submissionId);

    if (student) {
      await notifSvc.sendSystem({ schoolId: event.schoolId }, {
        user_ids: [student.user_id],
        type: 'academic',
        priority: 'normal',
        title: `Graded: ${assignment.title}`,
        body: `Your ${assignment.assignment_type} has been graded. Score: ${submission.total_score ?? 'Pending review'}/${assignment.max_score}.`,
        channels: ['in_app', 'email'],
        metadata: { submissionId: event.submissionId, assignmentId: event.assignmentId, score: submission.total_score, type: 'assignment_graded' },
      });

      // Notify parents
      const parents = await notifSvc.getParentUserIdsByStudentId(event.studentId);
      if (parents.length > 0) {
        await notifSvc.sendSystem({ schoolId: event.schoolId }, {
          user_ids: parents,
          type: 'academic',
          priority: 'normal',
          title: `Graded: ${assignment.title}`,
          body: `Your child's ${assignment.assignment_type} has been graded. Score: ${submission.total_score ?? 'Pending review'}/${assignment.max_score}.`,
          channels: ['in_app', 'email'],
          metadata: { studentId: event.studentId, submissionId: event.submissionId, assignmentId: event.assignmentId, type: 'assignment_graded_parent' },
        });
      }
    }
  });

  // Results published
  eventBus.on('assignment:results_published', async (event: {
    assignmentId: string; schoolId: string;
  }) => {
    const assignment = await notifSvc.getAssignmentBasic(event.assignmentId);
    const studentIds = await notifSvc.getStudentUserIdsByClass(assignment.class_id);

    // Notify students
    if (studentIds.length > 0) {
      await notifSvc.sendSystem({ schoolId: event.schoolId }, {
        user_ids: studentIds.map(s => s.id),
        type: 'academic',
        priority: 'high',
        title: `Results Published: ${assignment.title}`,
        body: `Your results for "${assignment.title}" are now available.`,
        channels: ['in_app', 'email', 'whatsapp'],
        metadata: { assignmentId: event.assignmentId, type: 'results_published' },
      });

      // Notify parents
      const parentIds = await notifSvc.getParentUserIdsByClass(assignment.class_id);
      if (parentIds.length > 0) {
        await notifSvc.sendSystem({ schoolId: event.schoolId }, {
          user_ids: parentIds,
          type: 'academic',
          priority: 'high',
          title: `Results Published: ${assignment.title}`,
          body: `Your child's results for "${assignment.title}" are now available.`,
          channels: ['in_app', 'email', 'whatsapp'],
          metadata: { assignmentId: event.assignmentId, type: 'results_published_parent' },
        });
      }
    }
  });
}
```

```typescript
// src/core/notifications/events/test-events.ts

export function registerTestEventHandlers(eventBus: EventBus, notifSvc: NotificationService): void {
  // Assessment scheduled/published
  eventBus.on('assessment:published', async (event: {
    assignmentId: string; classId: string; schoolId: string;
  }) => {
    const assessment = await notifSvc.getAssignmentBasic(event.assignmentId);
    const config = await notifSvc.getAssessmentConfig(event.assignmentId);

    const students = await notifSvc.getStudentUserIdsByClass(event.classId);
    if (students.length > 0) {
      await notifSvc.sendSystem({ schoolId: event.schoolId }, {
        user_ids: students.map(s => s.id),
        type: 'academic',
        priority: 'low',
        title: `Test Scheduled: ${assessment.title}`,
        body: `A test has been scheduled for ${config.scheduled_at ?? 'TBD'}. Duration: ${config.duration_minutes} minutes.`,
        channels: ['in_app'],
        metadata: { assignmentId: event.assignmentId, scheduledAt: config.scheduled_at, type: 'test_scheduled' },
      });
    }
  });

  // Assessment auto-submitted
  eventBus.on('assessment:attempt_auto_submitted', async (event: {
    attemptId: string; schoolId: string;
  }) => {
    const attempt = await notifSvc.getAttemptBasic(event.attemptId);
    const student = await notifSvc.getStudentUser(attempt.student_id);

    if (student) {
      await notifSvc.sendSystem({ schoolId: event.schoolId }, {
        user_ids: [student.user_id],
        type: 'academic',
        priority: 'normal',
        title: 'Assessment Auto-Submitted',
        body: 'Your assessment was automatically submitted as the timer expired.',
        channels: ['in_app'],
        metadata: { attemptId: event.attemptId, type: 'auto_submitted' },
      });
    }
  });

  // Assessment graded
  eventBus.on('assessment:attempt_graded', async (event: {
    attemptId: string; assignmentId: string; schoolId: string;
  }) => {
    const attempt = await notifSvc.getAttemptBasic(event.attemptId);
    const student = await notifSvc.getStudentUser(attempt.student_id);

    if (student) {
      await notifSvc.sendSystem({ schoolId: event.schoolId }, {
        user_ids: [student.user_id],
        type: 'academic',
        priority: 'normal',
        title: 'Assessment Graded',
        body: `Your assessment has been graded. Score: ${attempt.net_score ?? 'Pending'}.`,
        channels: ['in_app', 'email'],
        metadata: { attemptId: event.attemptId, assignmentId: event.assignmentId, score: attempt.net_score, type: 'assessment_graded' },
      });
    }
  });

  // Proctoring flagged
  eventBus.on('assessment:proctoring_flag', async (event: {
    attemptId: string; assignmentId: string; schoolId: string; violationType: string;
  }) => {
    const teacher = await notifSvc.getAssignmentTeacher(event.assignmentId);
    if (teacher) {
      await notifSvc.sendSystem({ schoolId: event.schoolId }, {
        user_ids: [teacher.user_id],
        type: 'academic',
        priority: 'high',
        title: '⚠️ Proctoring Flagged',
        body: `A student assessment was flagged for: ${event.violationType}. Review required.`,
        channels: ['in_app', 'email'],
        metadata: { attemptId: event.attemptId, assignmentId: event.assignmentId, violationType: event.violationType, type: 'proctoring_flag' },
      });
    }
  });
}
```

```typescript
// src/core/notifications/events/result-events.ts

export function registerResultEventHandlers(eventBus: EventBus, notifSvc: NotificationService): void {
  // Results published (from Assessments module)
  eventBus.on('assessment:results_published', async (event: {
    assignmentId: string; schoolId: string;
  }) => {
    const assessment = await notifSvc.getAssignmentBasic(event.assignmentId);
    const studentIds = await notifSvc.getStudentUserIdsByClass(assessment.class_id);

    if (studentIds.length > 0) {
      // Notify students
      await notifSvc.sendSystem({ schoolId: event.schoolId }, {
        user_ids: studentIds.map(s => s.id),
        type: 'academic',
        priority: 'high',
        title: `Results Published: ${assessment.title}`,
        body: 'Your assessment results are now available. Log in to view your score, answers, and feedback.',
        channels: ['in_app', 'email', 'whatsapp'],
        metadata: { assignmentId: event.assignmentId, type: 'assessment_results_published' },
      });

      // Notify parents
      const parentIds = await notifSvc.getParentUserIdsByClass(assessment.class_id);
      if (parentIds.length > 0) {
        await notifSvc.sendSystem({ schoolId: event.schoolId }, {
          user_ids: parentIds,
          type: 'academic',
          priority: 'high',
          title: `Results Published: ${assessment.title}`,
          body: `Your child's assessment results for "${assessment.title}" are now available.`,
          channels: ['in_app', 'email', 'whatsapp'],
          metadata: { assignmentId: event.assignmentId, type: 'assessment_results_published_parent' },
        });
      }
    }
  });

  // Grade override (admin/principal changed a grade)
  eventBus.on('submission:grade_overridden', async (event: {
    submissionId: string; studentId: string; schoolId: string; reason: string;
  }) => {
    const student = await notifSvc.getStudentUser(event.studentId);
    if (student) {
      await notifSvc.sendSystem({ schoolId: event.schoolId }, {
        user_ids: [student.user_id],
        type: 'academic',
        priority: 'normal',
        title: 'Grade Updated',
        body: 'Your grade has been updated. Please check your results for details.',
        channels: ['in_app'],
        metadata: { submissionId: event.submissionId, reason: event.reason, type: 'grade_override' },
      });
    }
  });
}
```

```typescript
// src/core/notifications/events/parent-alert-events.ts

export function registerParentAlertHandlers(eventBus: EventBus, notifSvc: NotificationService): void {
  // Student at-risk (AI detected)
  eventBus.on('student:risk_flagged', async (event: {
    studentId: string; schoolId: string; flagType: string; severity: string; description: string;
  }) => {
    const student = await notifSvc.getStudentBasic(event.studentId);
    const parents = await notifSvc.resolveStudentParents(event.studentId);

    if (parents.length === 0) return;

    const priority = event.severity === 'critical' ? 'high' : 'normal';

    await notifSvc.sendSystem({ schoolId: event.schoolId }, {
      user_ids: parents.map(p => p.user_id),
      type: 'behavioral',
      priority,
      title: `📊 ${student.first_name} ${student.last_name} — Action Needed`,
      body: event.description,
      channels: priority === 'high' ? ['in_app', 'email', 'whatsapp'] : ['in_app', 'email'],
      metadata: { studentId: event.studentId, flagType: event.flagType, severity: event.severity, type: 'risk_flag' },
    });

    // Also notify teacher
    const teacher = await notifSvc.getClassTeacher(event.studentId);
    if (teacher) {
      await notifSvc.sendSystem({ schoolId: event.schoolId }, {
        user_ids: [teacher.user_id],
        type: 'behavioral',
        priority,
        title: `Risk Alert: ${student.first_name} ${student.last_name}`,
        body: event.description,
        channels: ['in_app', 'email'],
        metadata: { studentId: event.studentId, flagType: event.flagType, severity: event.severity, type: 'risk_flag_teacher' },
      });
    }
  });

  // Monthly performance summary
  eventBus.on('student:monthly_summary', async (event: {
    studentId: string; schoolId: string; attendancePct: number; avgScore: number; flags: string[];
  }) => {
    const student = await notifSvc.getStudentBasic(event.studentId);
    const parents = await notifSvc.resolveStudentParents(event.studentId);
    if (parents.length === 0) return;

    const needsAttention = event.attendancePct < 80 || event.avgScore < 40;
    await notifSvc.sendSystem({ schoolId: event.schoolId }, {
      user_ids: parents.map(p => p.user_id),
      type: 'academic',
      priority: needsAttention ? 'high' : 'low',
      title: `Monthly Update: ${student.first_name} ${student.last_name}`,
      body: `Attendance: ${event.attendancePct}% | Average Score: ${event.avgScore}% | Flags: ${event.flags.length > 0 ? event.flags.join(', ') : 'None'}`,
      channels: needsAttention ? ['in_app', 'email'] : ['email'],
      metadata: { studentId: event.studentId, attendancePct: event.attendancePct, avgScore: event.avgScore, type: 'monthly_summary' },
    });
  });
}
```

```typescript
// src/core/notifications/events/principal-alert-events.ts

export function registerPrincipalAlertHandlers(eventBus: EventBus, notifSvc: NotificationService): void {
  // Low attendance school-wide
  eventBus.on('attendance:school_low_attendance', async (event: {
    schoolId: string; date: string; presentPct: number; affectedClasses: string[];
  }) => {
    // Notify principal
    const principals = await notifSvc.getPrincipals(event.schoolId);
    if (principals.length === 0) return;

    await notifSvc.sendSystem({ schoolId: event.schoolId }, {
      user_ids: principals.map(p => p.user_id),
      type: 'attendance',
      priority: 'urgent',
      title: '⚠️ Low School Attendance Alert',
      body: `School attendance dropped to ${event.presentPct}% on ${event.date}. Affected classes: ${affectedClasses.join(', ')}.`,
      channels: ['in_app', 'email', 'whatsapp', 'push'],
      metadata: { date: event.date, presentPct: event.presentPct, affectedClasses: event.affectedClasses, type: 'low_attendance' },
    });
  });

  // Bulk grade override detected
  eventBus.on('submission:bulk_grade_override', async (event: {
    schoolId: string; actorId: string; count: number; timeWindow: string;
  }) => {
    const principals = await notifSvc.getPrincipals(event.schoolId);
    if (principals.length === 0) return;

    await notifSvc.sendSystem({ schoolId: event.schoolId }, {
      user_ids: principals.map(p => p.user_id),
      type: 'system',
      priority: 'high',
      title: '⚡ Bulk Grade Override Detected',
      body: `${event.count} grades were overridden in the last ${event.timeWindow} by user ${event.actorId}. Review required.`,
      channels: ['in_app', 'email'],
      metadata: { actorId: event.actorId, count: event.count, timeWindow: event.timeWindow, type: 'bulk_override_alert' },
    });
  });

  // Notification failure rate above threshold
  eventBus.on('notification:high_failure_rate', async (event: {
    schoolId: string; failureRate: number; channel: string;
  }) => {
    const admins = await notifSvc.getSchoolAdmins(event.schoolId);
    if (admins.length === 0) return;

    await notifSvc.sendSystem({ schoolId: event.schoolId }, {
      user_ids: admins.map(a => a.user_id),
      type: 'system',
      priority: 'high',
      title: `⚠️ High Notification Failure Rate (${event.channel})`,
      body: `Notification delivery failure rate on ${event.channel} has reached ${event.failureRate}%. Check channel configuration.`,
      channels: ['in_app', 'email'],
      metadata: { channel: event.channel, failureRate: event.failureRate, type: 'channel_failure' },
    });
  });
}
```

---

## 6. API Routes

### 6.1 POST /notifications/send — Send notification

```http
POST /notifications/send
Role: school_admin, principal, teacher (own class)

Request: SendNotificationSchema
Response: 201 { data: NotificationResponse }
Errors: 400 (validation), 403 (scope), 422

Sends a notification to specified users or scope.
Resolves recipients, creates records, delivers via appropriate channels.
```

### 6.2 GET /notifications/feed — User notification feed

```http
GET /notifications/feed?type=...&page=1&limit=20
Role: all authenticated users

Response: 200 {
  data: [{
    id, notification_id, type, priority, title, body,
    channel, status, read_at, created_at, metadata
  }],
  total: number,
  unread_count: number,
  page: number,
  limit: number
}

Powers the in-app notification bell dropdown.
Returns only 'in_app' channel records.
Ordered by created_at DESC.
```

### 6.3 POST /notifications/feed/read — Mark notifications as read

```http
POST /notifications/feed/read
Role: all authenticated users

Request: { ids: UUID[] }
Response: 200 { success: true }

Marks specific notification_recipients as read.
Only marks if user_id matches authenticated user.
```

### 6.4 POST /notifications/feed/read-all — Mark all as read

```http
POST /notifications/feed/read-all
Role: all authenticated users

Request: { type?: notification_type, before?: ISO8601 }
Response: 200 { success: true, marked_count: number }

Marks all unread in-app notifications as read.
Optionally filter by type or before timestamp.
```

### 6.5 GET /notifications/unread-count — Get unread count

```http
GET /notifications/unread-count
Role: all authenticated users

Response: 200 { count: number }

Lightweight endpoint for notification bell badge.
Can be called frequently (cached 30s on client).
```

### 6.6 GET /notifications/{id} — Get notification detail

```http
GET /notifications/{id}
Role: sender, recipient, school_admin, principal

Response: 200 { data: NotificationResponse }
Shows notification with all recipient-channel records.
Recipients see only their own records; admin sees all.
```

### 6.7 GET /notifications — List sent notifications (admin)

```http
GET /notifications?type=...&priority=...&is_sent=...&from_date=...&to_date=...&page=1&limit=20
Role: school_admin, principal, teacher (own)

Response: 200 { data: NotificationResponse[], total: number }
Admin/principal: all school notifications.
Teacher: own sent notifications only.
```

### 6.8 GET /notifications/stats — Delivery statistics

```http
GET /notifications/stats
Role: school_admin, principal

Response: 200 {
  total_sent, today_sent, delivered_pct, read_pct, failed_count,
  by_channel: { in_app, email, whatsapp, push },
  by_type: { academic: 45, attendance: 12, ... }
}
```

### 6.9 GET /notifications/preferences — Get user preferences

```http
GET /notifications/preferences
Role: all authenticated users

Response: 200 { data: NotificationPreference[] }

Returns all preferences for the authenticated user.
Includes per-channel defaults and per-type overrides.
```

### 6.10 PUT /notifications/preferences — Update preferences

```http
PUT /notifications/preferences
Role: all authenticated users

Request: { preferences: NotificationPreference[] }
Response: 200 { data: NotificationPreference[] }

Upserts notification preferences.
Channel defaults: set notification_type=null.
Per-type overrides: set notification_type=type.
```

### 6.11 POST /notifications/devices — Register device for push

```http
POST /notifications/devices
Role: all authenticated users

Request: { platform: 'ios'|'android'|'web', device_token: string, device_name?: string }
Response: 201 { data: { id: UUID } }

Registers a device token for push notifications.
Deactivates old tokens for same user+platform.
```

### 6.12 DELETE /notifications/devices/{id} — Unregister device

```http
DELETE /notifications/devices/{id}
Role: device owner

Response: 200 { success: true }

Marks device as inactive.
Called on logout or when push permission revoked.
```

### 6.13 POST /notifications/webhook/email — Email delivery webhook

```http
POST /notifications/webhook/email
Role: system (validated by signature)

Receives email delivery status from email provider (SendGrid, Resend, etc.).
Updates notification_recipients status based on event:
- delivered: mark as 'delivered'
- opened: mark as 'read'
- bounced: mark as 'failed' with reason
- complained: mark as 'failed' (spam), auto-opt-out
```

### 6.14 POST /notifications/webhook/whatsapp — WhatsApp delivery webhook

```http
POST /notifications/webhook/whatsapp
Role: system (validated by signature)

Receives WhatsApp delivery status from WhatsApp Business API.
Same status mapping as email webhook.
```

---

## 7. Permissions

### 7.1 Permission Map

| Action | School Admin | Principal | Teacher | Student | Parent |
|--------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Send notification | ✅ | ✅ | 🔷 (own class) | ❌ | ❌ |
| View sent notifications | ✅ | ✅ | 🔷 (own) | ❌ | ❌ |
| View notification feed | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mark as read | ✅ | ✅ | ✅ | ✅ | ✅ |
| View preferences | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update preferences | ✅ | ✅ | ✅ | ✅ | ✅ |
| View delivery stats | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage templates | ✅ | ❌ | ❌ | ❌ | ❌ |
| Register device | ✅ | ✅ | ✅ | ✅ | ✅ |
| View webhook data | ✅ | ❌ | ❌ | ❌ | ❌ |

### 7.2 Scope Rules

| Rule | Enforcement |
|------|-------------|
| Teacher sends to own classes only | `teacher_class_subjects` check before resolving recipients |
| Teacher CANNOT send school-wide | Scope restricted to own class_id |
| Principal can send school-wide | scope.class_id optional for principal |
| Admin can send to any scope | Full access |
| Student cannot send notifications | No `notifications:send` permission |
| Parent cannot send notifications | No `notifications:send` permission |
| User sees own feed only | `notification_recipients.user_id == ctx.userId` |
| User updates own preferences only | `notification_preferences.user_id == ctx.userId` |
| Webhooks validated by HMAC signature | Channel-specific secret key verification |

### 7.3 Permission Assertion Patterns

```typescript
await this.authz.assert(ctx, 'notifications:send', { classId });  // Teacher scope check
await this.authz.assert(ctx, 'notifications:view');               // All authenticated
await this.authz.assert(ctx, 'notifications:manage_preferences');  // All authenticated
await this.authz.assert(ctx, 'notifications:view_stats');          // Admin/principal only
await this.authz.assert(ctx, 'notifications:manage_templates');    // Admin only
```

---

## 8. Delivery Workflow

### 8.1 Standard Delivery Flow

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────┐
│ Event Source  │────►│ NotificationService│     │              │
│ (Service)    │     │                   │     │              │
└──────────────┘     │ 1. Create notif   │     │              │
                     │ 2. Create recipients │     │              │
                     │ 3. Check preferences │     │              │
                     │ 4. Resolve channels  │     │              │
                     └─────────┬──────────┘     │              │
                               │                 │              │
                     ┌─────────▼──────────┐     │              │
                     │ Deliver via        │     │              │
                     │ channel adapters   │     │              │
                     │ (async, parallel)  │     │              │
                     └─────────┬──────────┘     │              │
                               │                 │              │
              ┌────────────────┼────────────────┐│              │
              ▼                ▼                ▼│              │
      ┌────────────┐  ┌────────────┐  ┌────────────┐         │
      │ In-App      │  │ Email      │  │ WhatsApp   │         │
      │ Channel    │  │ Channel   │  │ Channel   │         │
      └──────┬─────┘  └──────┬─────┘  └──────┬─────┘         │
             │               │               │                 │
             ▼               ▼               ▼                 │
      ┌────────────┐  ┌────────────┐  ┌────────────┐          │
      │ Mark all    │  │ Send via   │  │ Send via   │          │
      │ delivered   │  │ SMTP/API  │  │ WhatsApp   │          │
      │ (DB only)   │  │           │  │ API        │          │
      └────────────┘  └──────┬─────┘  └──────┬─────┘          │
                             │               │                 │
                             ▼               ▼                 │
                      ┌────────────┐  ┌────────────┐           │
                      │ Webhook    │  │ Webhook    │           │
                      │ callback   │  │ callback   │           │
                      │ updates    │  │ updates    │           │
                      │ status     │  │ status     │           │
                      └────────────┘  └────────────┘           │
                                                               │
                     ┌─────────────────────────────────────────┘
                     ▼
              ┌──────────────┐
              │ Cron: Retry  │
              │ failed (3×)  │
              └──────────────┘
```

### 8.2 Delivery Lifecycle

```
Status transitions for a single notification_recipient record:

pending ──► sent ──► delivered ──► read
   │                 │
   └──► failed       └──► failed (after webhook)
        │
        └──► retry (cron picks up pending records)
             │
             └──► sent ──► delivered ──► read
             └──► failed (final, no more retries)

Special statuses:
- 'unsubscribed': User opted out; no delivery attempt.
```

### 8.3 Retry Strategy

| Attempt | Delay | Condition |
|---------|-------|-----------|
| 1st retry | 5 min after first attempt | status = 'failed' |
| 2nd retry | 15 min after 1st retry | status = 'failed' |
| 3rd retry | 60 min after 2nd retry | status = 'failed' |
| **Final** | Mark as 'failed' permanently | 3 retries exhausted |

### 8.4 Quiet Hours Enforcement

```
Default quiet hours: 9:00 PM – 7:00 AM (school timezone)

Rules:
- Channel adapters check user preferences before sending
- If current time falls within user's quiet hours:
  → low/normal priority: skip delivery, queue for next wake window
  → high priority: send but log as 'delivered_during_quiet_hours'
  → urgent priority: always send regardless
- Wake window = 7:00 AM (or user's quiet_hours_end)

Implementation:
- Email and WhatsApp channel adapters check `preferenceService.isInQuietHours()`
- If in quiet hours and priority is not urgent:
  → Status stays 'pending'
  → Will be picked up by cron job after quiet hours end
```

---

## 9. Channel Implementations

### 9.1 In-App Channel (Default, Free)

| Feature | Implementation |
|---------|---------------|
| Delivery | Database-stored; frontend polls GET /notifications/feed every 30s |
| Real-time | Optional WebSocket via Supabase Realtime or Socket.IO |
| Read tracking | POST /notifications/feed/read with recipient IDs |
| Bell badge | GET /notifications/unread-count (cached 30s on client) |
| Retention | Keep for 90 days, then archive |
| Offline | All notifications available on next poll |

### 9.2 Email Channel

| Feature | Implementation |
|---------|---------------|
| Provider | Abstracted via `EmailProvider` interface |
| SendGrid | SMTP API (recommended for volume pricing) |
| Resend | Transactional API (alternative, Dev API key free) |
| Template | HTML template in email.channel.ts (Section 5.3) |
| Delivery tracking | Webhook callback (SendGrid Event Webhook / Resend Webhook) |
| Bounce handling | Mark address as invalid after 3 bounces |
| Unsubscribe | One-click unsubscribe link in email footer |
| Rate limiting | Max 10 emails/sec per school (SendGrid limit) |

Email provider configuration:
```env
# backend/.env
EMAIL_PROVIDER=sendgrid  # sendgrid | resend
SENDGRID_API_KEY=sg_xxx
SENDGRID_FROM_EMAIL=noreply@athonschool.com
SENDGRID_FROM_NAME=Athon School
SENDGRID_WEBHOOK_SECRET=whsec_xxx

# OR
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@athonschool.com
```

### 9.3 WhatsApp Channel

| Feature | Implementation |
|---------|---------------|
| Provider | Abstracted via `WhatsAppProvider` interface |
| Twilio | Twilio API for WhatsApp (recommended for CBSE schools) |
| WhatsApp Business API | Direct API (alternative, requires Meta Business account) |
| Template | Pre-approved WhatsApp message templates (Meta approval required) |
| Delivery tracking | Webhook callback (Twilio status callback) |
| Opt-out | User must reply STOP; handled by provider |
| Rate limiting | Max 1 message/sec per phone number (Twilio) |
| Cost | ~$0.05/message (Twilio WhatsApp pricing) |

WhatsApp provider configuration:
```env
# backend/.env
WHATSAPP_PROVIDER=twilio  # twilio | whatsapp_business_api
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_WHATSAPP_NUMBER=+14155238886
TWILIO_STATUS_CALLBACK_URL=https://api.athonschool.com/api/v1/notifications/webhook/whatsapp
```

### 9.4 Push Channel

| Feature | Implementation |
|---------|---------------|
| Provider | Firebase Cloud Messaging (FCM) for Android/web, APNs for iOS |
| FCM Setup | Firebase project → Cloud Messaging → Server key |
| Web Push | FCM via service worker + VAPID keys |
| Android | FCM direct integration |
| iOS | APNs via FCM (FCM proxies to APNs) |
| Token storage | `notification_devices` table |
| Token expiry | 401 from FCM → deactivate token |
| Payload | Title + body text + metadata JSON |

Push notification configuration:
```env
# backend/.env
FCM_SERVER_KEY=AAAAxxx
FCM_VAPID_PUBLIC_KEY=BFxxx
FCM_VAPID_PRIVATE_KEY=xxx
```

---

## 10. Notification Templates

### 10.1 Template Definitions

```typescript
// src/core/notifications/templates/notification-templates.ts

export interface NotificationTemplate {
  key: string;
  title: string;                     // Template with {{variables}}
  body: string;                      // Template with {{variables}}
  default_channels: string[];
  default_priority: string;
}

export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  // ─── Attendance ────────────────────────────────────────────

  'attendance:absent': {
    key: 'attendance:absent',
    title: 'Attendance Alert: {{student_name}}',
    body: '{{student_name}} was marked absent on {{date}}.',
    default_channels: ['in_app', 'whatsapp'],
    default_priority: 'normal',
  },

  'attendance:late': {
    key: 'attendance:late',
    title: 'Late Arrival: {{student_name}}',
    body: '{{student_name}} arrived late on {{date}}.',
    default_channels: ['in_app'],
    default_priority: 'low',
  },

  'attendance:consecutive_absence': {
    key: 'attendance:consecutive_absence',
    title: '⚠️ Repeated Absence: {{student_name}}',
    body: '{{student_name}} has been absent for {{count}} consecutive days ({{from_date}} – {{to_date}}). Please contact the school.',
    default_channels: ['in_app', 'whatsapp', 'email'],
    default_priority: 'high',
  },

  'attendance:monthly_low': {
    key: 'attendance:monthly_low',
    title: 'Attendance Alert: {{student_name}}',
    body: "{{student_name}}'s attendance has dropped to {{pct}}% this month.",
    default_channels: ['in_app', 'email'],
    default_priority: 'high',
  },

  // ─── Homework / Assignments ────────────────────────────────

  'assignment:published': {
    key: 'assignment:published',
    title: 'New {{type}}: {{title}}',
    body: 'A new {{type}} has been published. Due: {{due_date}}.',
    default_channels: ['in_app', 'email'],
    default_priority: 'low',
  },

  'assignment:submitted': {
    key: 'assignment:submitted',
    title: 'Submission Received',
    body: 'Student {{admission_no}} has submitted {{title}}.',
    default_channels: ['in_app'],
    default_priority: 'low',
  },

  'assignment:graded': {
    key: 'assignment:graded',
    title: 'Graded: {{title}}',
    body: 'Your {{type}} has been graded. Score: {{score}}/{{max_score}}.',
    default_channels: ['in_app', 'email'],
    default_priority: 'normal',
  },

  'assignment:graded_parent': {
    key: 'assignment:graded_parent',
    title: 'Graded: {{title}}',
    body: "Your child's {{type}} has been graded. Score: {{score}}/{{max_score}}.",
    default_channels: ['in_app', 'email'],
    default_priority: 'normal',
  },

  'assignment:results_published': {
    key: 'assignment:results_published',
    title: 'Results Published: {{title}}',
    body: 'Your results for "{{title}}" are now available.',
    default_channels: ['in_app', 'email', 'whatsapp'],
    default_priority: 'high',
  },

  'assignment:returned_for_revision': {
    key: 'assignment:returned_for_revision',
    title: 'Revision Needed: {{title}}',
    body: 'Your submission for "{{title}}" needs revision. Reason: {{reason}}.',
    default_channels: ['in_app', 'email'],
    default_priority: 'normal',
  },

  // ─── Tests / Assessments ───────────────────────────────────

  'assessment:scheduled': {
    key: 'assessment:scheduled',
    title: 'Test Scheduled: {{title}}',
    body: '{{title}} is scheduled for {{scheduled_at}}. Duration: {{duration}} minutes.',
    default_channels: ['in_app'],
    default_priority: 'low',
  },

  'assessment:auto_submitted': {
    key: 'assessment:auto_submitted',
    title: 'Assessment Auto-Submitted',
    body: 'Your assessment was auto-submitted as the timer expired.',
    default_channels: ['in_app'],
    default_priority: 'normal',
  },

  'assessment:graded': {
    key: 'assessment:graded',
    title: 'Assessment Graded',
    body: 'Your assessment has been graded. Score: {{score}}.',
    default_channels: ['in_app', 'email'],
    default_priority: 'normal',
  },

  'assessment:results_published': {
    key: 'assessment:results_published',
    title: 'Results Published: {{title}}',
    body: 'Your assessment results for "{{title}}" are now available.',
    default_channels: ['in_app', 'email', 'whatsapp'],
    default_priority: 'high',
  },

  'assessment:proctoring_flag': {
    key: 'assessment:proctoring_flag',
    title: '⚠️ Proctoring Flagged',
    body: 'A student assessment was flagged for: {{violation}}. Review required.',
    default_channels: ['in_app', 'email'],
    default_priority: 'high',
  },

  // ─── Parent Alerts ─────────────────────────────────────────

  'parent:risk_flag': {
    key: 'parent:risk_flag',
    title: '📊 Attention Needed: {{student_name}}',
    body: '{{student_name}} needs attention: {{description}}.',
    default_channels: ['in_app', 'email', 'whatsapp'],
    default_priority: 'high',
  },

  'parent:monthly_summary': {
    key: 'parent:monthly_summary',
    title: 'Monthly Update: {{student_name}}',
    body: 'Attendance: {{attendance_pct}}% | Average Score: {{avg_score}}%.',
    default_channels: ['email'],
    default_priority: 'low',
  },

  'parent:weekly_digest': {
    key: 'parent:weekly_digest',
    title: 'Weekly Digest: {{student_name}}',
    body: '{{assignments_count}} assignments, {{assessments_count}} assessments, {{attendance_pct}}% attendance.',
    default_channels: ['email'],
    default_priority: 'low',
  },

  // ─── Principal Alerts ──────────────────────────────────────

  'principal:low_attendance': {
    key: 'principal:low_attendance',
    title: '⚠️ Low Attendance Alert',
    body: 'School attendance dropped to {{pct}}% on {{date}}. {{classes_affected}} classes affected.',
    default_channels: ['in_app', 'email', 'whatsapp', 'push'],
    default_priority: 'urgent',
  },

  'principal:bulk_override': {
    key: 'principal:bulk_override',
    title: '⚡ Bulk Grade Override',
    body: '{{count}} grades overridden in {{time_window}} by {{actor_name}}. Review required.',
    default_channels: ['in_app', 'email'],
    default_priority: 'high',
  },

  'principal:notification_failure': {
    key: 'principal:notification_failure',
    title: '⚠️ Notification Channel Failure',
    body: 'Delivery failure rate on {{channel}} reached {{rate}}%. Check configuration.',
    default_channels: ['in_app', 'email'],
    default_priority: 'high',
  },

  // ─── System ────────────────────────────────────────────────

  'system:account_created': {
    key: 'system:account_created',
    title: 'Welcome to Athon, {{name}}!',
    body: 'Your account has been created. Your role: {{role}}. School: {{school_name}}.',
    default_channels: ['in_app', 'email'],
    default_priority: 'low',
  },

  'system:announcement': {
    key: 'system:announcement',
    title: '📢 {{title}}',
    body: '{{body}}',
    default_channels: ['in_app'],
    default_priority: 'normal',
  },
};
```

### 10.2 Template Renderer

```typescript
// src/core/notifications/templates/template-renderer.ts

export class TemplateRenderer {
  render(
    template: NotificationTemplate,
    vars: Record<string, string | number | boolean | null>,
  ): { title: string; body: string } {
    const title = this.interpolate(template.title, vars);
    const body = this.interpolate(template.body, vars);
    return { title, body };
  }

  private interpolate(
    text: string,
    vars: Record<string, any>,
  ): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (vars[key] === undefined || vars[key] === null) return match;
      return String(vars[key]);
    });
  }
}
```

### 10.3 Template Usage

```typescript
// Usage in event handlers:
const { title, body } = templateRenderer.render(
  NOTIFICATION_TEMPLATES['attendance:absent'],
  {
    student_name: `${student.first_name} ${student.last_name}`,
    date: event.date,
  },
);

await notifSvc.send(ctx, {
  user_ids: parents.map(p => p.user_id),
  type: 'attendance',
  priority: 'normal',
  template_key: 'attendance:absent',
  template_vars: {
    student_name: `${student.first_name} ${student.last_name}`,
    date: event.date,
  },
  channels: ['in_app', 'whatsapp'],
});
```

---

## 11. Event Triggers

### 11.1 Event Registry

| Module | Event | Handler | Priority | Channels | Targets |
|--------|-------|---------|----------|----------|---------|
| **Attendance** | attendance:alert | attendance-events.ts | normal | in_app, whatsapp | Parents |
| | attendance:overridden | attendance-events.ts | normal | in_app | Parents, Teacher |
| | attendance:school_low_attendance | principal-alert-events.ts | urgent | all | Principal |
| **Homework** | assignment:published | homework-events.ts | low | in_app, email | Students |
| | assignment:submitted | homework-events.ts | low | in_app | Teacher |
| | assignment:graded | homework-events.ts | normal | in_app, email | Student, Parents |
| | assignment:results_published | homework-events.ts | high | in_app, email, whatsapp | Students, Parents |
| | assignment:returned | homework-events.ts | normal | in_app, email | Student |
| **Test** | assessment:published | test-events.ts | low | in_app | Students |
| | assessment:attempt_auto_submitted | test-events.ts | normal | in_app | Student |
| | assessment:attempt_graded | test-events.ts | normal | in_app, email | Student |
| | assessment:proctoring_flag | test-events.ts | high | in_app, email | Teacher |
| **Results** | assessment:results_published | result-events.ts | high | in_app, email, whatsapp | Students, Parents |
| | submission:grade_overridden | result-events.ts | normal | in_app | Student |
| **Parent Alerts** | student:risk_flagged | parent-alert-events.ts | high | in_app, email, whatsapp | Parents, Teacher |
| | student:monthly_summary | parent-alert-events.ts | low | email | Parents |
| **Principal** | submission:bulk_grade_override | principal-alert-events.ts | high | in_app, email | Principal |
| | notification:high_failure_rate | principal-alert-events.ts | high | in_app, email | Admin |

### 11.2 Integration Points

```typescript
// Each module registers its event handlers at startup:

// src/core/notifications/events/register.ts
export function registerNotificationEventHandlers(eventBus: EventBus, notifSvc: NotificationService): void {
  registerAttendanceEventHandlers(eventBus, notifSvc);
  registerHomeworkEventHandlers(eventBus, notifSvc);
  registerTestEventHandlers(eventBus, notifSvc);
  registerResultEventHandlers(eventBus, notifSvc);
  registerParentAlertHandlers(eventBus, notifSvc);
  registerPrincipalAlertHandlers(eventBus, notifSvc);
}

// In module services, events are published via eventBus:
// this.eventBus.publish('attendance:alert', { studentId, date, status, schoolId });
// this.eventBus.publish('assignment:published', { assignmentId, classId, schoolId });
// etc.
```

---

## 12. User Preferences & Opt-Out

### 12.1 Preference Defaults

| Role | in_app | email | whatsapp | push |
|------|--------|-------|----------|------|
| Teacher | ✅ On | ✅ On | ❌ Off | ❌ Off |
| Student | ✅ On | ❌ Off | ❌ Off | ❌ Off |
| Parent | ✅ On | ✅ On | ✅ On | ❌ Off |
| Principal | ✅ On | ✅ On | ✅ On | ✅ On |
| Admin | ✅ On | ✅ On | ✅ On | ✅ On |

### 12.2 Opt-Out Flows

```
In-App:
  → Settings → Notifications → Toggle channels
  → Per-type: academic, attendance, behavioral, system

Email:
  → Unsubscribe link in email footer (one-click)
  → Settings → Notifications → Email toggle

WhatsApp:
  → Reply "STOP" to WhatsApp message (handled by Twilio)
  → Settings → Notifications → WhatsApp toggle

Push:
  → Browser/OS-level permission
  → Settings → Notifications → Push toggle
  → Logout → device token deactivated
```

### 12.3 Preference Priority

```
1. Per-type override (highest priority)
   e.g., user disabled attendance emails but enabled general emails
   → attendance emails blocked, other emails pass

2. Per-channel default
   e.g., user disabled email entirely
   → all emails blocked regardless of type

3. System default (lowest priority)
   e.g., no preference set
   → enabled by default
```

---

## 13. Background Jobs & Scheduling

### 13.1 Cron Jobs

```typescript
// 1. notification-sender — Process pending notifications
// Schedule: Every 1 minute
// Query: SELECT nr.* FROM notification_recipients nr
//        JOIN notifications n ON n.id = nr.notification_id
//        WHERE nr.status = 'pending'
//          AND (n.scheduled_at IS NULL OR n.scheduled_at <= NOW())
//        ORDER BY n.priority DESC, n.created_at ASC
//        LIMIT 500
// Handler: NotificationService.deliverNotification(notificationId)

// 2. notification-retry — Retry failed deliveries
// Schedule: Every 5 minutes
// Query: SELECT nr.* FROM notification_recipients nr
//        WHERE nr.status = 'failed'
//          AND nr.retry_count < 3
//          AND nr.failed_at < NOW() - INTERVAL '5 minutes'
//        ORDER BY nr.failed_at ASC
//        LIMIT 200
// Handler: Retry via channel adapter

// 3. notification-digest — Compile daily/weekly digests
// Schedule: Daily at 7:00 AM (school timezone)
// Queries by digest_frequency preference:
//   - daily: last 24h unread notifications
//   - weekly: last 7 days (sent on Monday)
// Handler: Compile digest email, mark as sent

// 4. notification-cleanup — Archive old notifications
// Schedule: Daily at 2:00 AM
// Action: Archive notification_recipients > 90 days old
//         Archive notifications where all recipients > 90 days old
//         Delete notification_devices where last_seen_at > 1 year
```

### 13.2 Scheduled Notifications

```typescript
// Support for delayed/scheduled delivery:
// If SendNotificationInput.scheduled_at is set:
//   1. Create notification with is_sent = FALSE
//   2. Create all recipient records with status = 'pending'
//   3. Cron job 'notification-sender' picks it up when scheduled_at <= NOW()
//
// Use cases:
// - Reminder: "Homework due tomorrow" at 6:00 PM day before
// - Scheduled announcements: Exam schedule published at specific time
// - Quiet hours deferral: Queue WhatsApp messages for morning delivery
```

### 13.3 Webhook Processing

```typescript
// Email delivery webhooks (SendGrid Event Webhook format):
// POST /notifications/webhook/email
// Body: [{
//   "event": "delivered" | "open" | "click" | "bounce" | "dropped" | "spamreport",
//   "sg_message_id": "...",
//   "email": "parent@example.com",
//   "timestamp": 1234567890,
//   "smtp-id": "...",
//   "category": ["notification_recipient_id:xxx"],
//   "reason": "550 5.1.1 The email account does not exist"
// }]

// WhatsApp delivery webhooks (Twilio Status Callback format):
// POST /notifications/webhook/whatsapp
// Body: {
//   "MessageSid": "SMxxx",
//   "MessageStatus": "delivered" | "read" | "failed" | "undelivered",
//   "To": "+919876543210",
//   "ErrorCode": 30007,
//   "ErrorMessage": "Message blocked"
// }
```

---

## 14. Edge Cases

### 14.1 Delivery Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **Recipient user deleted** | Skip delivery, log as 'failed' with reason "User deleted" |
| 2 | **Recipient user deactivated** | Skip delivery, log as 'failed' with reason "User inactive" |
| 3 | **Email bounces (hard)** | Mark address as invalid. Auto-opt-out email channel for this user. Notify admin after 3 bounces. |
| 4 | **Email bounces (soft)** | Retry 3 times with increasing intervals. Mark as failed after exhaustion. |
| 5 | **WhatsApp number invalid** | Mark as 'failed'. Fall back to in-app + email if available. |
| 6 | **Push token expired** | Deactivate token in `notification_devices`. Fall back to in-app. |
| 7 | **All channels fail for a user** | At minimum, in-app notification is always available (DB-stored). User sees it on next login. |
| 8 | **No contact address for any channel** | At minimum, in-app is available. Other channels silently skipped. |
| 9 | **All recipients opted out** | Mark notification as sent (no delivery needed). |

### 14.2 Scheduling Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **Scheduled time is in the past** | Send immediately (treat as now) |
| 2 | **Scheduled time is > 30 days away** | Allow (future event reminders) |
| 3 | **Two scheduled notifications collide** | Process in priority order, then FIFO |
| 4 | **Scheduled notification ready during quiet hours** | Delay until quiet hours end for non-urgent priority |
| 5 | **Scheduled notification superseded by newer one** | Update notification content, keep scheduled time |

### 14.3 Preference Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **User opts out of in-app** | Ignore — in-app is mandatory for platform functionality (cannot opt out of system messages) |
| 2 | **User opts out of email but has no other channel** | In-app always available. User may miss urgent notifications if they don't log in. |
| 3 | **Parent opts out of one child's notifications** | Per-student preferences supported via `notification_type` in preference overrides |
| 4 | **User sets quiet hours 10PM–6AM, urgent notification at 11PM** | Urgent always bypasses quiet hours |
| 5 | **User changes preferences mid-delivery** | Check at send time (preferences are read per-recipient, not cached) |

### 14.4 Template Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **Template variable missing** | Leave `{{var_name}}` as-is in output (visible placeholder) |
| 2 | **Template variable is null** | Replace with empty string |
| 3 | **Template body exceeds channel limit (e.g., WhatsApp 1024 chars)** | Truncate with "..." and add "View details in app" |
| 4 | **Template not found** | Fall back to raw title/body from notification record |

### 14.5 Concurrency & Race Conditions

| # | Case | Handling |
|---|------|----------|
| 1 | **Double send (same event published twice)** | Check `is_sent` flag before processing. Idempotent if already sent. |
| 2 | **Cron picks up same notification twice** | Use `SELECT ... FOR UPDATE SKIP LOCKED` on pending recipients |
| 3 | **Webhook arrives before sent_at is set** | Skip webhook if recipient status is still 'pending' (retry later) |
| 4 | **Webhook for already-failed recipient** | Update status only if current status is 'sent' (not 'failed') |
| 5 | **Bulk send to 500 users** | Process in batches of 100. Use async queue for channel delivery. |

---

## 15. Risk Analysis

### 15.1 Security Risks

| # | Risk | Severity | Impact | Mitigation |
|---|------|----------|--------|------------|
| 1 | **Notification spoofing: sender_id not validated** | High | Anyone can send as any user | `sender_id` derived from JWT, not request body |
| 2 | **Teacher sends to wrong class** | Medium | Students see wrong notifications | Scope validated against `teacher_class_subjects` |
| 3 | **Parent sees other parent's notification** | High | Privacy violation | Feed filters by `user_id`, RLS on `notification_recipients` |
| 4 | **Email webhook forgery** | High | False delivery status | HMAC signature verification on webhook payload |
| 5 | **WhatsApp webhook forgery** | High | False delivery status | HMAC signature verification (Twilio Auth Token) |
| 6 | **Push notification payload contains PII** | Medium | PII leak in push payload | Only include metadata IDs, never student names |
| 7 | **Bulk notification abuse (spam)** | Medium | User dissatisfaction | Rate limit: max 5 sends/minute/teacher, 20/minute/admin |

### 15.2 Data Integrity Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **Notification lost on send failure** | User misses important message | Retry with exponential backoff. In-app always available. |
| 2 | **Duplicate notification sent** | User receives same message twice | Event dedup: check if notification already exists for (entityType, entityId, action) within 5 min window |
| 3 | **Delivery status inconsistent between DB and provider** | Wrong delivery stats | Webhook callback updates status. Periodic reconciliation job. |
| 4 | **Preference change lost** | User receives unwanted notifications | Atomic upsert on `notification_preferences`. Read at send time. |
| 5 | **Template variable leak shows raw JSON** | Ugly notification text | Always pass through TemplateRenderer. Use fallback for missing vars. |

### 15.3 Performance Risks

| # | Risk | Scenario | Mitigation |
|---|------|----------|------------|
| 1 | **Bulk publish: 40 students × 3 channels = 120 recipient records** | Creating assignment triggers 120 inserts | Batch inserts. Async delivery. |
| 2 | **Feed query for 10K notifications** | Slow user feed | Pagination (20 items). Index on `(user_id, created_at DESC)`. Archive >90 days. |
| 3 | **Unread count for 500 concurrent users** | DB hammered every 30s | Cache unread count per user (30s TTL). Use lightweight COUNT query. |
| 4 | **Email throughput: 100 emails in 1 sec** | Provider rate limit | Queue with rate limiter. Max 10/sec per school. |
| 5 | **Webhook flood: 1000 events in 1 min** | Server overwhelmed | Process webhooks async. Verify HMAC before processing. |

### 15.4 Cost Risks

| # | Risk | Monthly Cost (100 schools) | Mitigation |
|---|------|---------------------------|------------|
| 1 | **WhatsApp: 500K messages/month at $0.05/msg** | $25,000 (unrealistic) | Restrict to high-priority only. Default opt-out for parents. |
| 2 | **Email: SendGrid 50K emails/month included** | $0 (within free tier) | Use SendGrid free tier (100 emails/day). Upgrade at scale. |
| 3 | **WhatsApp: 5K messages/month at $0.05/msg** | $250 (realistic) | ~50 parents × 2 messages/week × 4 weeks = 400/parent. Default opt-out. |
| 4 | **FCM: 1M pushes/month** | $0 (free) | No cost concern. |
| 5 | **In-app: 0 cost** | $0 | Database storage only. |

---

## 16. Testing Checklist

### 16.1 Unit Tests — Service

| Test | Expected | Priority |
|------|----------|----------|
| `send: direct user_ids` | Notification + recipients created | P0 |
| `send: scope class_id` | Recipients resolved from class | P0 |
| `send: scope student_ids` | Parent user IDs resolved | P0 |
| `send: with template` | Title/body rendered from template | P0 |
| `send: all recipients opted out` | Notification marked sent, no delivery | P0 |
| `send: priority maps to channels` | Urgent → all channels | P0 |
| `send: low priority maps to in_app only` | Only in_app channel | P0 |
| `send: scheduled notification` | Created with is_sent=false, scheduled_at set | P0 |
| `send: teacher sends to non-own class` | 403 | P0 |
| `deliver: email channel` | Email sent, status updated | P0 |
| `deliver: email bounce` | Retry count incremented | P0 |
| `deliver: email exhausts retries` | Status = failed | P0 |
| `deliver: whatsapp quiet hours blocked` | Status stays pending (non-urgent) | P0 |
| `deliver: whatsapp quiet hours bypassed (urgent)` | Sent during quiet hours | P0 |
| `deliver: push token expired` | Token deactivated | P0 |
| `feed: returns user's in-app notifications` | Filtered by user_id | P0 |
| `feed: returns unread count` | Unread count computed | P0 |
| `mark_read: single` | read_at set | P0 |
| `mark_all_read: all unread` | All set to read | P0 |
| `mark_all_read: with type filter` | Only matching type marked | P0 |

### 16.2 Unit Tests — Preferences

| Test | Expected | Priority |
|------|----------|----------|
| `isChannelEnabled: no preference` | Returns true (default) | P0 |
| `isChannelEnabled: channel disabled` | Returns false | P0 |
| `isChannelEnabled: type override disabled` | Returns false for type, true for others | P0 |
| `isChannelEnabled: type override enabled, channel disabled` | Returns false (channel wins) | P0 |
| `setPreferences: upsert` | Creates new, updates existing | P0 |
| `setPreferences: with quiet hours` | Quiet hours saved | P0 |
| `isInQuietHours: within range` | Returns true | P0 |
| `isInQuietHours: outside range` | Returns false | P0 |

### 16.3 Unit Tests — Templates

| Test | Expected | Priority |
|------|----------|----------|
| `render: all vars provided` | Placeholders replaced correctly | P0 |
| `render: missing var` | Placeholder left as-is | P0 |
| `render: null var` | Replaced with empty string | P0 |
| `render: body exceeds limit` | Truncated with "..." | P1 |

### 16.4 Integration Tests

| Test | Expected | Priority |
|------|----------|----------|
| Create attendance → verify parent notified | In-app + WhatsApp for parent | P0 |
| Publish homework → verify students notified | In-app + email for each student | P0 |
| Grade homework → verify student + parent notified | In-app + email for both | P0 |
| Publish results → verify high-priority sent to all | In-app + email + WhatsApp | P0 |
| User disables email → verify email not sent | Only in-app delivered | P0 |
| Webhook marks delivery → verify status updated | Status changes to delivered | P0 |
| Full notification lifecycle (send→deliver→read) | End-to-end verified | P0 |

### 16.5 Security Tests

| Test | Expected | Priority |
|------|----------|----------|
| Student sends notification | 403 | P0 |
| Teacher sends to non-own class | 403 | P0 |
| User sees another user's feed | 403 or empty | P0 |
| User marks another user's notification as read | 403 | P0 |
| Cross-school notification access | 403 or empty | P0 |
| Unauthenticated webhook call | 401 | P0 |
| Webhook with invalid signature | 401 | P0 |

### 16.6 Performance Tests

| Test | Target | Method |
|------|--------|--------|
| Send notification to 100 users | <500ms | Batch recipient creation |
| Load feed API (10K notifications) | <100ms | Indexed query, paginated |
| Unread count (100 concurrent) | <50ms each | Lightweight COUNT, cached |
| Deliver 50 emails | <30s total | Async queue |
| Process 100 webhook events | <5s total | Async processing |

---

## Appendix A: Error Codes

```typescript
export const NOTIFICATION_ERROR_CODES = {
  NOTIF_400_01: { status: 400, message: 'Either user_ids or scope must be provided' },
  NOTIF_400_02: { status: 400, message: 'Either title or template_key must be provided' },
  NOTIF_400_03: { status: 400, message: 'No recipients resolved from the given scope' },
  NOTIF_400_04: { status: 400, message: 'User list exceeds maximum of 500 recipients' },
  NOTIF_400_05: { status: 400, message: 'Template not found' },
  NOTIF_400_06: { status: 400, message: 'Invalid quiet hours format. Use HH:MM.' },

  NOTIF_403_01: { status: 403, message: 'You do not have permission to send notifications' },
  NOTIF_403_02: { status: 403, message: 'You can only send to your own classes' },
  NOTIF_403_03: { status: 403, message: 'You cannot view another user\'s notifications' },
  NOTIF_403_04: { status: 403, message: 'You cannot mark another user\'s notifications as read' },

  NOTIF_404_01: { status: 404, message: 'Notification not found' },
  NOTIF_404_02: { status: 404, message: 'Preference not found' },
  NOTIF_404_03: { status: 404, message: 'Device not found' },

  NOTIF_429_01: { status: 429, message: 'Too many notifications. Please wait.' },

  NOTIF_422_01: { status: 422, message: 'Invalid webhook signature' },
  NOTIF_422_02: { status: 422, message: 'Invalid webhook payload' },
} as const;
```

## Appendix B: Provider Configuration

```typescript
// Email provider interface
export interface EmailProvider {
  send(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    metadata?: Record<string, string>;
  }): Promise<void>;
}

// WhatsApp provider interface
export interface WhatsAppProvider {
  send(options: {
    to: string;
    body: string;
    metadata?: Record<string, string>;
  }): Promise<void>;
}

// Push provider interface
export interface FCMProvider {
  send(options: {
    token: string;
    notification: { title: string; body: string };
    data?: Record<string, string>;
  }): Promise<void>;
}
```

## Appendix C: Database Migration SQL

```sql
-- V2 notification module migration

-- 1. Create new tables
CREATE TABLE notification_preferences (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    school_id           UUID NOT NULL REFERENCES schools(id),
    channel             notification_channel NOT NULL,
    is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    notification_type   notification_type,
    quiet_hours_start   TIME,
    quiet_hours_end     TIME,
    digest_frequency    VARCHAR(20) DEFAULT 'never',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, school_id, channel, notification_type),
    UNIQUE(user_id, school_id, channel)
);

CREATE TABLE notification_devices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    school_id           UUID NOT NULL REFERENCES schools(id),
    platform            VARCHAR(20) NOT NULL,
    device_token        VARCHAR(500) NOT NULL,
    device_name         VARCHAR(100),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, device_token)
);

-- 2. Extend ENUMs
ALTER TYPE notification_status ADD VALUE IF NOT EXISTS 'read';
ALTER TYPE notification_status ADD VALUE IF NOT EXISTS 'unsubscribed';

-- 3. Extend notifications table with new columns
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS template_key VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS template_vars JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS batch_id UUID;

-- 4. Add quiet hours column to notification_recipients
ALTER TABLE notification_recipients ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en';
ALTER TABLE notification_recipients ADD COLUMN IF NOT EXISTS delivered_during_quiet_hours BOOLEAN NOT NULL DEFAULT FALSE;

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_nr_pending_delivery ON notification_recipients(status, created_at ASC)
    WHERE status = 'pending' OR status = 'failed';
CREATE INDEX IF NOT EXISTS idx_nr_read_filter ON notification_recipients(user_id, read_at)
    WHERE read_at IS NULL AND status = 'sent';
CREATE INDEX IF NOT EXISTS idx_np_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_nd_active ON notification_devices(user_id) WHERE is_active = TRUE;

-- 6. Create materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_notification_delivery_stats AS
SELECT
    n.school_id,
    n.notification_type,
    n.priority,
    n.created_at::DATE AS date,
    COUNT(DISTINCT n.id) AS notifications_sent,
    COUNT(DISTINCT nr.id) AS recipients_total,
    COUNT(DISTINCT nr.id) FILTER (WHERE nr.status = 'sent') AS sent_count,
    COUNT(DISTINCT nr.id) FILTER (WHERE nr.status = 'delivered') AS delivered_count,
    COUNT(DISTINCT nr.id) FILTER (WHERE nr.status = 'read') AS read_count,
    COUNT(DISTINCT nr.id) FILTER (WHERE nr.status = 'failed') AS failed_count,
    COUNT(DISTINCT nr.channel) FILTER (WHERE nr.channel = 'email') AS email_count,
    COUNT(DISTINCT nr.channel) FILTER (WHERE nr.channel = 'whatsapp') AS whatsapp_count,
    COUNT(DISTINCT nr.channel) FILTER (WHERE nr.channel = 'push') AS push_count,
    ROUND(
        COUNT(DISTINCT nr.id) FILTER (WHERE nr.status = 'failed')::NUMERIC
        / NULLIF(COUNT(DISTINCT nr.id), 0) * 100, 1
    ) AS failure_rate,
    MAX(nr.retry_count) AS max_retries
FROM notifications n
LEFT JOIN notification_recipients nr ON nr.notification_id = n.id
GROUP BY n.school_id, n.notification_type, n.priority, n.created_at::DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_nds_date ON mv_notification_delivery_stats(school_id, notification_type, priority, date);
```

---

**Document Version**: 1.0
**Date**: June 10, 2026
**Next Action**: Implement module scaffolding, create SQL migration for notification tables, configure email provider, and begin API endpoint development
