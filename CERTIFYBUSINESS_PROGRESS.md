# CertifyBusiness — Build Progress

> **Last updated:** 2026-06-04 (hotfix session)
> **Stack:** Next.js 14 · Express/Node · MySQL/Knex · BullMQ/Redis · GoDaddy SMTP · IMAP · Meta WhatsApp Cloud API

---

## Module Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete and production-hardened |
| ⚠️ | Functional but has known gaps/limitations |
| 🔲 | Planned / stub only |

---

## Modules

### ✅ Auth
**Status: Complete**

- JWT access token (15 min) + refresh token (7 days)
- `/auth/login`, `/auth/refresh`, `/auth/me`, `/auth/logout`
- RBAC middleware (`requireRole`, `requirePermission`) used on all protected routes
- 4-level hierarchy: `super_admin` → `admin` → `manager` → `employee`
- No auto-logout — session persists until explicit logout
- Zustand auth store with `localStorage` persistence + hydration guard on dashboard layout

**Files:** `auth.controller.ts`, `auth.service.ts`, `auth.routes.ts`, `auth.schema.ts`, `auth.middleware.ts`, `lib/auth-store.ts`, `(auth)/login/page.tsx`

---

### ✅ Organisation Management
**Status: Complete**

- Org CRUD (super_admin only for create/delete)
- Org settings (plan, active flag)
- GET `/orgs`, GET `/orgs/:id`, PATCH `/orgs/:id`

**Files:** `organization.{controller,service,routes,schema}.ts`, `settings/org/page.tsx`

---

### ✅ User Management
**Status: Complete**

- Full user CRUD (invite, update, deactivate)
- Designations — free-form job title categories
- Teams — manager + member assignment
- Permission templates — reusable permission presets per role
- `GET /users`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id`
- `GET/POST/DELETE /designations`
- `GET/POST/PATCH/DELETE /teams`
- `GET/POST/PATCH/DELETE /permission-templates`

**Files:** `user.{controller,service,routes,schema}.ts`, `users/page.tsx`, `settings/designations`, `settings/teams`, `settings/permission-templates`

---

### ✅ Leads
**Status: Complete**

- Full CRUD with multi-phone + multi-email per lead
- Lead activities timeline (calls, email sent/reply, WA sent/reply, notes, tasks, status changes, assignments)
- Tasks (create, complete, overdue tracking)
- Status: `new → contacted → interested → follow_up → converted → dead → do_not_contact`
- Source types: `cold_call`, `cold_email`, `whatsapp`, `sms`, `website_inbound`, `manual`
- Tags, notes, designation, company fields
- Lead assignment (admin assigns to employee; auto-created from campaign contacts)
- RBAC: employees see only assigned leads; managers see team leads; admins see all
- Lead detail page with full timeline + task panel

**Files:** `lead.{controller,service,routes,schema}.ts`, `leads/page.tsx`, `leads/[id]/page.tsx`, `ActivityTimeline.tsx`

---

### ✅ Cold Calling
**Status: Complete**

- Call log — outcome, duration, follow-up date, notes
- Call queue — filtered view of upload list contacts not yet called / with follow-ups due
- Follow-up tracker — overdue + due today
- My stats (calls today/week, outcome breakdown)
- Convert call → lead inline
- Call outcomes: `connected`, `no_answer`, `busy`, `wrong_number`, `callback_requested`, `interested`, `not_interested`, `do_not_call`

**Files:** `calling.{controller,service,routes,schema}.ts`, `calling/page.tsx`

---

### ✅ Imports / Contact Lists
**Status: Complete**

- CSV upload → validation → BullMQ processing
- Approval workflow: admin approves/rejects upload before contacts become available
- Auto-approval for admins; employees require approval
- Suppression list integration (bounced, unsubscribed, DNC contacts are flagged)
- Duplicate detection within a list and across lists
- Preview uploaded contacts with validation errors
- Channels: `calling`, `email`, `whatsapp`, `sms`

**Files:** `import.{controller,service,routes,schema}.ts`, `csv-import.worker.ts`, `imports/page.tsx`

---

### ✅ Channels — Sender Identities + Templates
**Status: Complete**

- Sender identity CRUD for email (SMTP config + from address), WhatsApp (WABA credentials), SMS (sender ID)
- Encrypted credential storage (`ENCRYPTION_KEY` AES-256)
- Test sender endpoint
- Message templates (email subject + body, WhatsApp templates, SMS with DLT ID)
- Template variable substitution engine
- Webhook URLs page showing inbound endpoints for each channel
- Integrations page with copy buttons

**Files:** `channel.{controller,service,routes,schema}.ts`, `settings/senders/page.tsx`, `settings/templates/page.tsx`, `settings/integrations/page.tsx`, `senders/email.sender.ts`, `template.ts`

---

### ✅ Campaigns — Email / WhatsApp / SMS
**Status: Complete**

- Unified campaign model: channel (`email` | `whatsapp` | `sms`), sender identity, contact list, multi-step schedule
- Campaign statuses: `draft → scheduled → running → paused → completed → failed`
- BullMQ send workers: `email-send.worker.ts`, `whatsapp-send.worker.ts`, `sms-send.worker.ts`
- Campaign send orchestration: `campaign-send.worker.ts` fans out individual send jobs
- Email tracking: open pixel, click redirect, unsubscribe link (migration 010)
- `email_events` table: `sent → opened → clicked → replied → bounced`
- Reply correlation: `reply+{campaignContactId}@domain` alias (strategy 1), In-Reply-To/References (strategy 2), email recency 30d (strategy 3)
- Campaign detail page: steps, stats, contact list preview
- Shared `ChannelCampaignsPage` component used by Email/WhatsApp/SMS nav pages

**Files:** `campaign.{controller,service,routes,schema}.ts`, `campaign-send.worker.ts`, `email-send.worker.ts`, `whatsapp-send.worker.ts`, `sms-send.worker.ts`, `campaigns/page.tsx`, `campaigns/[id]/page.tsx`, `ChannelCampaignsPage.tsx`, `tracking/tracking.routes.ts`

**Known gaps:**
- SMS delivery receipt webhook not implemented (Exotel-specific; stub in `sms-send.worker.ts`)
- WhatsApp template approval flow is manual (no auto-sync from Meta dashboard)

---

### ✅ Inbox — Real-time Conversation Inbox
**Status: Complete and Production-Hardened**

**IMAP ingestion:**
- IMAP IDLE mode (`REPLY_INBOX_MODE=idle`): persistent connection, push events in seconds
- Poll mode fallback (`REPLY_INBOX_MODE=poll`): BullMQ repeat job every `REPLY_INBOX_POLL_INTERVAL_MS`
- **Fixed race condition:** `fetch.once("end")` now waits for all `simpleParser` async calls via `Promise.all(pending)` — was always returning `processed: 0`
- Auto-fallback to polling after 5 consecutive IDLE connect failures
- Exponential reconnect backoff (5s → 5min cap)
- Metrics counters: `connectAttempts`, `connectSuccess`, `disconnects`, `newMailEvents`, `errors`, `pollingFallbacks`

**Correlation strategies (in order):**
1. `reply+{campaignContactId}@domain` alias in To header
2. In-Reply-To / References headers matched against `email_events.message_id`
3. Sender email matched against `email_events.recipient_email` (sent within last 30 days)
4. **Fallback:** creates unassigned conversation (`source="inbound_email"`, `status="open"`, `owner_user_id=NULL`) — nothing is silently dropped

**Org resolution for unmatched emails:**
- `IMAP_ORG_ID` env var (explicit)
- Auto-resolve from `sender_identities` where `from_address = IMAP_USER` (if `IMAP_ORG_ID` not set)

**Conversation model:**
- Channels: `email`, `whatsapp`
- Statuses: `open`, `awaiting_employee`, `awaiting_customer`, `closed`
- Sources: `cold_email_reply`, `whatsapp_reply`, `sms_reply`, `manual`, `inbound_email`
- Unread count per conversation; badge in sidebar
- Assignment history table

**SSE (real-time frontend updates):**
- Redis pub/sub: `sse:user:{userId}` + `sse:org:{orgId}` channels
- Multi-process safe (each Node process subscribes locally to Redis)
- In-process fallback if Redis unavailable
- **Auth:** one-time 30-second stream token (`POST /inbox/stream-token`) — full JWT never in SSE URL
- Heartbeat every 25s to keep proxy connections alive
- Events: `connected`, `inbox:new`, `inbox:update`, `heartbeat`

**Idempotency:**
- DB unique constraint: `(organisation_id, provider_message_id)` on `conversation_messages`
- Pre-check before conversation counter mutation (TOCTOU fix: prevents unread_count inflation on IMAP reconnect replay)
- `.onConflict().ignore()` as final concurrent-race guard

**RBAC:**
- Employees see only their assigned conversations
- Admins see all conversations including unassigned
- Admin can reassign to any user; employees can only self-assign

**Frontend:**
- `inbox/page.tsx`: list with status tabs, channel filter, search, pagination
- `inbox/[id]/page.tsx`: thread view, reply composer, assign sidebar, contact/lead/campaign cards, assignment history
- `useInboxSSE()`: one-time token → EventSource → manual reconnect with exponential backoff
- Optimistic unread badge drop on `inbox:update { event: "read" }` (no polling wait)

**Files:** `inbox.{controller,service,routes,schema}.ts`, `imap-idle.service.ts`, `imap-poll.worker.ts`, `imap-message.processor.ts`, `sse.ts`, `auth.middleware.ts` (stream token), `inbox/page.tsx`, `inbox/[id]/page.tsx`, `hooks/useInbox.ts`, `lib/api/inbox.ts`

**Migrations:** 013 (conversations), 014 (idempotency constraints), 015 (email_events unique), 016 (inbound_email source ✅ applied), 017 (bounce tracking columns ✅ applied)

**Bounce handling (added 2026-06-04):**
- Bounce/system emails filtered BEFORE conversation creation (mailer-daemon, postmaster, delivery failure subjects, auto-reply, OOO)
- Detected bounces: extract original recipient from DSN body → update `email_events` to `bounced`, `campaign_contacts` to `bounced` + set `bounced_at` + `bounce_reason`, increment `campaigns.bounced_count`
- Multiple RFC 3464 DSN header patterns + GoDaddy prose patterns supported
- `_onMail` debounced 300ms so rapid-fire IDLE events don't trigger concurrent unseen fetches

**Known limitations:**
- `IMAP_ORG_ID` must be set or `sender_identities.from_address` must match `IMAP_USER` email
- SSE one-time token requires Redis; SSE unavailable if Redis is down (acceptable since Redis is required for pub/sub anyway)
- IMAP polling fallback after consecutive failures is session-scoped — process restart retries IDLE
- Stats `unreadTotal` refetched (HTTP) rather than optimistically decremented on read (minor extra round-trip)
- No HTML body stored for inbound emails (only plain text from `simpleParser`)

---

### ✅ Automation
**Status: Complete**

- Create/edit/delete/toggle automation rules
- Triggers: `lead_created`, `email_reply`, `whatsapp_reply`, `sms_reply`, `call_logged`, `no_activity`, `status_changed`, `tag_added`
- Conditions: field/operator/value with AND logic
- Actions: `create_task`, `add_tag`, `change_status`, `assign_to_user`, `send_notification`
- Automation logs with execution status
- `automation.worker.ts` evaluates rules on trigger events

**Files:** `automation.{controller,service,routes,schema}.ts`, `automation.worker.ts`, `automation/page.tsx`

---

### ✅ Notifications
**Status: Complete**

- In-app notification service: create, list, mark read, mark all read
- Unread count in Header bell icon
- Types: `new_lead`, `lead_assigned`, `reply_received`, `follow_up_due`, `campaign_complete`, `task_due`, `system`
- `notifications.worker.ts` for async notification delivery
- Triggered from inbox service, automation, assignment flow

**Files:** `notification.{controller,service,routes}.ts`, `notifications.worker.ts`, `Header.tsx`

---

### ✅ Dashboard
**Status: Complete**

- Stat cards: total leads, calls today, conversion rate, overdue follow-ups
- Charts: leads by status, call outcomes (week), my personal activity
- Tasks row: overdue + due today
- API: `GET /reporting/dashboard`

**Files:** `reporting.{controller,service,routes}.ts`, `dashboard/page.tsx`

---

### ✅ Reports
**Status: Complete**

- Campaign summary: total sent/delivered/replied/bounced across campaigns
- Leads by channel (source breakdown)
- Leads by employee (assignment breakdown)
- Conversion funnel (status breakdown)
- Call activity by employee with outcome breakdown
- Date range filters

**Files:** `reporting.{controller,service,routes}.ts`, `reports/page.tsx`

---

### ⚠️ WhatsApp Inbound
**Status: Functional — correlation may need tuning**

- Meta webhook handler (`/webhooks/whatsapp`) validates HMAC signature
- Inbound message → `webhook-process.worker.ts` → `handleInboundWhatsAppMessage()`
- Correlation: open conversation by phone number
- Deduplication: `(organisation_id, provider_message_id)` unique on `conversation_messages`
- SSE broadcast to owner + org on new WA message

**Known gaps:**
- `context_id` correlation (reply to specific WA message) tested but may fail for some clients
- No read-receipt webhook processing

---

### 🔲 SMS Inbound
**Status: Not implemented**

- Outbound SMS send worker exists (`sms-send.worker.ts`)
- No inbound SMS webhook handler
- Exotel webhook setup required to receive delivery receipts and inbound messages

---

## Database Migrations

| # | Migration | Status |
|---|-----------|--------|
| 001 | Create organisations | ✅ |
| 002 | Create users + auth | ✅ |
| 003 | Create leads | ✅ |
| 004 | Create suppression + lists | ✅ |
| 005 | Create channels (sender_identities, templates) | ✅ |
| 006 | Create campaigns | ✅ |
| 007 | Create messaging events | ✅ |
| 008 | Create automation | ✅ |
| 009 | Create notifications + audit | ✅ |
| 010 | Add tracking columns | ✅ |
| 011 | Add upload approval | ✅ |
| 012 | Add replied_at columns | ✅ |
| 013 | Create conversations | ✅ |
| 014 | Add message idempotency constraints | ✅ |
| 015 | email_events unique message_id | ✅ |
| 016 | Add `inbound_email` source to conversations ENUM | ✅ Applied |
| 017 | Add `bounced_at` + `bounce_reason` to campaign_contacts | ✅ Applied |

---

## Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| MySQL | ✅ | Knex + connection pool |
| Redis | ✅ | BullMQ queues + SSE pub/sub + stream tokens |
| BullMQ workers | ✅ | CSV import, campaign send, email/WA/SMS send, webhook process, automation, notifications, IMAP poll |
| IMAP IDLE | ✅ | GoDaddy imap.secureserver.net:993 |
| SMTP | ✅ | GoDaddy smtpout.secureserver.net:465 |
| WhatsApp webhook | ✅ | `/webhooks/whatsapp` with HMAC verification |
| Email tracking | ✅ | Open pixel + click redirect + unsubscribe at `/track/*` |
| SSE (multi-process) | ✅ | Redis pub/sub bridges processes |

---

## Environment Variables Checklist

```
# Required for production
JWT_ACCESS_SECRET=           # min 32 chars
JWT_REFRESH_SECRET=          # min 32 chars
ENCRYPTION_KEY=              # exactly 32 chars

# Database
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

# Redis
REDIS_URL=redis://...

# SMTP
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS

# IMAP
IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASSWORD
REPLY_INBOX_MODE=idle         # or poll
IMAP_ORG_ID=<uuid>           # REQUIRED for unmatched inbound email conversations
                              # Find: SELECT id FROM organisations LIMIT 1;
                              # Alt: add sender_identity with from_address = IMAP_USER

# WhatsApp
META_APP_SECRET=
META_VERIFY_TOKEN=
```

---

## Known Remaining Limitations

1. **`IMAP_ORG_ID` must be filled** — without it, emails with no campaign correlation are logged as a warning and dropped. Either set `IMAP_ORG_ID` in `.env` or ensure `sender_identities` has a row with `from_address = IMAP_USER`.

2. **SSE requires Redis** — the one-time stream token and Redis pub/sub both require Redis. If Redis is down, SSE connections fail (JWT-in-URL fallback was intentionally removed for security).

3. **IMAP polling fallback is session-scoped** — after 5 consecutive IDLE failures the service switches to polling for the lifetime of the process. Process restart will retry IDLE.

4. **No HTML body stored for inbound emails** — `conversation_messages.body_html` is null for inbound; only `body_text` is populated. Outbound replies do store HTML.

5. **SMS inbound not implemented** — Exotel webhook setup needed; no inbound SMS creates a conversation.

6. **`ConversationSource` type in `frontend/src/types/api.ts`** is missing `"inbound_email"` — add it when needed (runtime works; TypeScript strict checks may warn).

7. **WhatsApp template approval** is manual — must be checked/synced from Meta Business dashboard.

---

## Next Priority Items

1. ~~Run `npx knex migrate:latest` to apply migration 016~~ ✅ Done
2. Set `IMAP_ORG_ID` in `.env`
3. ~~Update `ConversationSource` type in `frontend/src/types/api.ts` to include `"inbound_email"`~~ ✅ Done
4. Dashboard widget showing inbox unread count + conversations awaiting reply
5. Lead detail page: show linked conversations for that lead
6. Bulk lead actions (assign multiple, change status in bulk)
7. SMS inbound webhook via Exotel
8. WhatsApp: read-receipt webhook handler
9. Export: leads CSV/Excel download (`export_data` permission)
10. Audit log page for admin (audit_logs table exists in migration 009)
