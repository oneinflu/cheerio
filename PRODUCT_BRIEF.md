## Product Brief

Meta Command Center is a full WhatsApp-first support and sales console built on top of the WhatsApp Cloud API and the Starforze platform. It gives agents a shared inbox, automation workflows, and template management in a single app so they can:

- Receive and reply to WhatsApp conversations in real time.
- Use approved WhatsApp templates (with media headers) from a searchable library.
- Trigger follow-up workflows and campaigns directly from chats and templates.
- Collaborate with internal notes, assignments, and pinned conversations.
- See high-level dashboards of volume and agent performance.

The system has three main pillars:
 
- **Messaging & Inbox** – omnichannel-style WhatsApp inbox with conversation lists, message history, assignment, status, and notes.
- **Templates & Campaigns** – WhatsApp template library, creation helper, rich preview, and test sending.
- **Workflows & Automation** – visual drag-and-drop workflow builder that can send templates, apply conditions, delays, and even trigger other workflows.

Authentication and team membership are delegated to **Starforze** (external API), and media storage uses **Cloudinary** for files uploaded via the template test flow. WhatsApp delivery itself is done through Meta’s Cloud API using a dedicated integration client.

---

## Backend API Endpoints

All endpoints are mounted under `/api/*` from the Express app in `backend/src`. Below is a high‑level list grouped by route file and purpose (not including every internal field, but enough for integration docs).

### Auth (`backend/src/routes/auth.js`)

- `POST /api/auth/login`  
  - Payload: `{ email, password }`  
  - Integration: Proxies to `https://api.starforze.com/api/team-auth/login`.  
  - On success, upserts the user into local `users` table and returns `{ accessToken, user }` to the frontend.

- `POST /api/auth/sync`  
  - Payload: `{ user }` (Starforze user JSON)  
  - Upserts local user record, used to keep local DB in sync with Starforze.

### WhatsApp Outbound (`backend/src/routes/whatsappOutbound.js`)

- `POST /api/whatsapp/text`  
  - Payload: `{ conversationId, text }`  
  - Integration: Uses `services/outboundWhatsApp.sendText` to call the WhatsApp Cloud API and persist outbound message.

- `POST /api/whatsapp/media`  
  - Payload: `{ conversationId, kind, link, caption? }`, where `kind ∈ { image, audio, document }`.  
  - Sends media messages via WhatsApp Cloud API using a public `link` (e.g. Cloudinary URL).

- `POST /api/whatsapp/template`  
  - Payload: `{ conversationId, name, languageCode, components? }`.  
  - Sends a templated WhatsApp message with named/positional parameters and optional header media.

- `POST /api/whatsapp/upload`  
  - Form‑data: `conversationId`, `file`.  
  - Integration: Uploads media bytes to WhatsApp Cloud API, stores a media record, and returns `{ id, ... }` (media ID) to frontend.  
  - Used by Chat template send modal for header media uploads.

- `GET /api/whatsapp/media-library`  
  - Query: `?limit=20` (default).  
  - Reads recent uploaded media from `media_assets` table to show in Chat “recent media” picker.

### Templates (`backend/src/routes/templates.js`)

- `GET /api/templates`  
  - Integration: Calls Meta WhatsApp template list API via `whatsappClient.getTemplates(WABA_ID)`.  
  - Enriches with local `template_settings` (starred templates) and returns `{ data: [...] }`.

- `POST /api/templates/:name/star`  
  - Marks template as starred in `template_settings` for quick access in UI.

- `DELETE /api/templates/:name/star`  
  - Unstars a template.

- `POST /api/templates`  
  - Creates a new WhatsApp template via `whatsappClient.createTemplate(WABA_ID, body)` and returns Meta response.

- `POST /api/templates/upload-example`  
  - Form‑data: `file`.  
  - Integration: Uploads template example media to Meta using `whatsappClient.uploadMessageTemplateMedia`, returns template media handle for use in template creation.

- `POST /api/templates/upload-test-media`  
  - Form‑data: `file`.  
  - Integration: Uses Cloudinary (`CLOUDINARY_*` env) to upload generic media for test sending.  
  - Returns `{ id, url, kind, mime_type, original_filename }` where `id/url` is a public HTTPS URL usable as a WhatsApp media `link`.
  - Used by Templates “Send test” modal to attach real media headers.

- `POST /api/templates/send-test`  
  - Payload: `{ to, templateName, languageCode?, components? }`.  
  - Integration: Calls `whatsappClient.sendTemplateMessage` directly using the WhatsApp Cloud API, for sending tests to a phone number outside a conversation.

- `DELETE /api/templates`  
  - Payload: `{ name, hsm_id }`.  
  - Wraps Meta template deletion API (`whatsappClient.deleteTemplate`) with business rules around statuses and PENDING_DELETION.

### Workflows (`backend/src/routes/workflows.js`)

- `POST /api/workflows/ai/generate`  
  - Payload: `{ description }`.  
  - Integration: Uses `services/workflows.generateWorkflowFromDescription` (LLM/AI powered) to propose a workflow graph from natural language.

- `GET /api/workflows`  
  - Lists all stored workflows (nodes + edges) from DB.

- `POST /api/workflows`  
  - Creates a new workflow.

- `GET /api/workflows/:id`  
  - Returns full workflow definition for editing or inspection.

- `PUT /api/workflows/:id`  
  - Updates an existing workflow.

- `DELETE /api/workflows/:id`  
  - Deletes a workflow.

- `POST /api/workflows/:id/run`  
  - Payload: `{ phoneNumber }`.  
  - Manually executes workflow starting at its trigger node for a given contact phone number.  
  - Integration: `services/workflows.runWorkflow` orchestrates WhatsApp messages, delays, conditions, and can **chain** to other workflows via `start_workflow` action nodes.

### Conversations (`backend/src/routes/conversations.js`)

- `GET /api/conversations/:conversationId/contact`  
  - Returns `{ contactId, name, number, course, preferredLanguage, blocked }` for sidebar and header in Chat.

- `PUT /api/conversations/:conversationId/contact`  
  - Payload: `{ name, course }`.  
  - Updates contact display name and `profile.course`.  
  - Integration: Calls `https://api.starforze.com/api/leads/{leadId}/course` to sync course and assignment; emits Socket.IO events for reassignment.

- `POST /api/conversations/claim`  
  - Payload: `{ conversationId, teamId, userId }` (userId read from auth token).  
  - Claims a conversation for the current agent, with row‑level locking handled in `services/conversationClaim`.

- `POST /api/conversations/reassign`  
  - Admin‑only. Payload: `{ conversationId, teamId, newAssigneeUserId }`.  
  - Reassigns conversation to another agent.

- `POST /api/conversations/release`  
  - Payload: `{ conversationId }`.  
  - Releases active assignment (returns to unassigned/open pool).

- `POST /api/conversations/:conversationId/pin`  
  - Toggles pinned state for a conversation per‑user (`pinned_conversations` table).

- `POST /api/conversations/:conversationId/status`  
  - Payload: `{ status }` (`open`, `resolved`, `snoozed` → mapped to DB `open/closed/snoozed`).  
  - Updates conversation status for Inbox filters.

- `POST /api/conversations/:conversationId/block`  
- `POST /api/conversations/:conversationId/unblock`  
  - Marks the underlying contact as blocked/unblocked in `contacts.profile.blocked`.

- `DELETE /api/conversations/:conversationId`  
  - Soft‑like delete of a conversation row; used for admin cleanup.

### Inbox (`backend/src/routes/inbox.js`)

- `GET /api/inbox`  
  - Query: `?teamId=...&filter=open|closed|snoozed|unassigned|mine`.  
  - Returns `{ conversations: [...] }` for the sidebar conversation list.  
  - Integration: `services/inbox.listConversations` encapsulates filtering by team, assignment, and status.

- `GET /api/inbox/counts`  
  - Returns summary counts per status for Inbox counters (“Open”, “Mine”, “Unassigned”, etc.).

### Messages & Notes

**Messages (`backend/src/routes/messages.js`):**

- `GET /api/conversations/:conversationId/messages`  
  - Returns `{ messages: [...] }` for the Chat message timeline.

- `POST /api/conversations/:conversationId/read`  
  - Marks all messages in the conversation as read.

- `GET /api/conversations/:conversationId/notes`  
  - Reads staff notes (delegated to `services/staffNotes`).

**Staff Notes (`backend/src/routes/staffNotes.js`):**

- `GET /api/staff-notes/conversations/:conversationId/notes`  
- `POST /api/staff-notes/conversations/:conversationId/notes`  
  - Create and list staff notes with role‑based visibility.

- `PUT /api/staff-notes/notes/:noteId`  
- `DELETE /api/staff-notes/notes/:noteId`  
  - Admin‑only update/delete of notes.

### Media Proxy (`backend/src/routes/media.js`)

- `GET /api/media/:mediaId`  
  - Integration: Proxies WhatsApp Cloud media download.  
  - Flow: Fetches media URL via Graph API, then streams the file to the browser with correct `Content-Type`.

### Team Users (`backend/src/routes/team.js`)

- `GET /api/team-users/:id`  
  - Tries local `users` table first.  
  - If missing, calls external `https://api.starforze.com/api/team-users/:id` (optionally with `STARFORZE_API_KEY`).  
  - Used by Inbox UI to display assignee names.

- `GET /api/team-users`  
  - Lists all local users for internal use (e.g. team management screens).

### Dashboard (`backend/src/routes/dashboard.js`)

- `GET /api/dashboard`  
  - Query: `?teamId=...` (optional).  
  - Returns `{ stats, volume, agents, kpi }` used by Dashboard page to draw charts and leaderboards.

---

## Frontend Pages & Integrations

This section describes how each major React page ties into the backend APIs and external systems.

### Login Page (`frontend/src/components/LoginPage.jsx`)

- Integrations:
  - Calls `POST /api/auth/login` to authenticate via Starforze and obtain `accessToken` and user profile.
  - Stores token in `localStorage` and sets auth context for subsequent API calls.

### Inbox (`frontend/src/components/Inbox.jsx`)

- Shows left‑side conversation list and filters.
- Integrations:
  - `GET /api/inbox` for list of conversations filtered by status (open, mine, unassigned, snoozed, closed).  
  - `GET /api/inbox/counts` for top‑level counters.  
  - `GET /api/team-users/:id` for per‑conversation assignee name.  
  - Uses Socket.IO client to receive real‑time events for new messages and assignment changes.

### Chat (`frontend/src/components/Chat.jsx`)

- Main agent chat experience for a single conversation.
- Integrations:
  - `GET /api/conversations/:conversationId/contact` – fetches contact name, number, and course for the header.  
  - `GET /api/conversations/:conversationId/messages` – loads message history.  
  - `POST /api/conversations/:conversationId/read` – mark messages as read when agent opens conversation.  
  - `POST /api/whatsapp/text` – send text message.  
  - `POST /api/whatsapp/media` – send media message (image/document) when agent pastes or selects from recent media.  
  - `POST /api/whatsapp/template` – send approved template from the template picker modal, including optional header media.  
  - `POST /api/whatsapp/upload` – upload header media for template sending (form‑data `conversationId` + `file`), with “Uploading…” progress in UI.  
  - `GET /api/whatsapp/media-library` – fetch recent media library to quickly re‑use uploads.  
  - `GET /api/conversations/:conversationId/notes` & staff note routes – show internal notes via `NotesPanel`.  
  - Socket.IO: listens for `message:new`, `assignment:claimed`, etc., to refresh messages and sidebar without reload.

### Templates Page (`frontend/src/components/TemplatesPage.jsx`)

- Library of WhatsApp templates with search, filters, star, creation wizard, and phone‑style preview.
- Integrations:
  - `GET /api/templates` – fetch templates from Meta and merge star state.  
  - `POST /api/templates/:name/star` & `DELETE /api/templates/:name/star` – star/unstar templates.  
  - `POST /api/templates` – create new templates via guided wizard categories (Marketing/Utility/Authentication).  
  - `POST /api/templates/upload-example` – upload header media example to Meta (returns template media handle used in template body).  
  - `DELETE /api/templates` – delete/discontinue templates when allowed by Meta rules.  
  - `POST /api/templates/send-test` – send a test template message to a raw phone number.  
  - `POST /api/templates/upload-test-media` – upload test header media to Cloudinary from the Send Test modal, with “Uploading…” progress and real image/video/document preview using the resolved URL.
- Preview:
  - Uses `header_handle` from Meta template examples to render real media (image/video/document) in the phone mock whenever possible, falling back to placeholders only when no URL is available.

### Workflow Builder & Workflows Page

- Components:  
  - `frontend/src/components/WorkflowBuilder.jsx` – visual React Flow builder.  
  - `frontend/src/components/WorkflowsPage.jsx` – list and manage multiple workflows.

- Integrations:
  - `GET /api/workflows` – list workflows for the Workflows page and populate “Start workflow” dropdown in Action nodes.  
  - `POST /api/workflows` / `PUT /api/workflows/:id` / `DELETE /api/workflows/:id` – create, update, delete workflows.  
  - `GET /api/workflows/:id` – load a workflow into the builder for editing.  
  - `POST /api/workflows/ai/generate` – generate a workflow graph from a natural‑language description.  
  - `POST /api/workflows/:id/run` – manually trigger workflow for a phone number from the UI.

- Special behavior:
  - **start_workflow action** inside `ActionNode` lets you chain workflows; the backend `runWorkflow` service executes nested workflows when it encounters this action type.
  - Real‑time workflow execution visualization via Socket.IO:
    - Nodes show statuses (Waiting, Running, Completed, Error).
    - Delay nodes show live countdown timers until execution.

### Dashboard Page (`frontend/src/components/DashboardPage.jsx`)

- Shows WhatsApp volume, agent performance, and basic KPIs.
- Integrations:
  - `GET /api/dashboard` – pulls `{ stats, volume, agents, kpi }` and renders charts (conversation volume over time, per‑agent metrics, simple SLA placeholders).

### Team & Settings Pages

- Team / Members (`frontend/src/components/TeamMembersPage.jsx`, `TeamPage.jsx`):
  - Integrations:
    - `GET /api/team-users` – list known local users and roles (mapped from Starforze).  
    - Potential use of `GET /api/team-users/:id` for drill‑down (depending on UI).

- Settings (`frontend/src/components/SettingsPage.jsx`):
  - Primarily local configuration/UI glue; may call backend endpoints for feature toggles as needed (minimal integrations at present).

### Guest Chat (`frontend/src/components/GuestChat.jsx`)

- Lightweight chat widget view (e.g. embedded on a website or as a minimal console).
- Integrations:
  - Reuses core Chat APIs (messages, outbound WhatsApp endpoints) but with a restricted UI footprint.

---

## External Integrations Summary

- **WhatsApp Cloud API (Meta):**
  - Used for all outbound messages (`/api/whatsapp/*`), template CRUD (`/api/templates/*`), and media download proxy (`/api/media/:mediaId`).

- **Starforze Platform:**
  - Authentication (`/api/auth/login` → `team-auth/login`).  
  - Lead/course sync when updating conversation contact (`PUT /api/conversations/:conversationId/contact`).  
  - Team user details fallback (`GET /api/team-users/:id`).

- **Cloudinary:**
  - Used by `/api/templates/upload-test-media` to upload arbitrary header media for test sending; returns HTTPS URLs suitable as `link` fields in WhatsApp template headers.

- **Socket.IO:**
  - Drives real‑time updates for:
    - New messages and read states in Chat.  
    - Conversation assignments (claim/reassign/release).  
    - Workflow execution progress in Workflow Builder.

This document is intended as the single reference for what the product does, which APIs exist, and how each frontend page hooks into the backend and external services.

