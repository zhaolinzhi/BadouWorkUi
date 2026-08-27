# AionUi — Project Binding Backend Contract

> Status: Draft for backend implementation.
> Owner: Renderer team (AionUi)
> Date: 2026-08-26
> Related: `docs/superpowers/specs/2026-08-26-task-center-binding-design.md`

This document specifies the backend endpoints required by the **task center → project binding → chat auto-apply** feature in AionUi.

The frontend code is shipped in this repo (`packages/desktop/src/renderer/api/projectBinding.ts`, `packages/desktop/src/common/adapter/ipcBridge.ts`). Until these endpoints are deployed, the frontend falls back to a localStorage-backed mock so the flow stays usable in dev.

---

## 1. Endpoints

Mounted on the existing aioncore HTTP server (same origin and auth as `/api/projects/*` and `/api/fs/*`). Reuse the same session auth — no new headers.

### 1.1. `GET /api/project-binding/{projectId}`

Look up the current user's binding for a project.

| | |
|---|---|
| **Path** | `/api/project-binding/{projectId}` |
| **Method** | `GET` |
| **Auth** | Current aioncore session |
| **Path params** | `projectId: string` (URL-encoded) |
| **Body** | — |

**Success responses**

| Status | Body | When |
|---|---|---|
| `200` | `{ "binding": ProjectBinding }` | Binding exists |
| `200` | `{ "binding": null }` | No binding for `(currentUser, projectId)` |
| `404` | (empty body, or `{ "error": "not found" }`) | Same as `binding: null` — front end treats both as "missing" |

The front end handles `200 binding: null` and `404` identically. Choose whichever matches aioncore's existing conventions for "no row" semantics. If aioncore uses 404 for "no row" everywhere (e.g. `/api/projects/{id}`), prefer `404` for consistency.

**Error responses**

| Status | Body | When |
|---|---|---|
| `403` | `{ "error": "forbidden" }` | Binding exists but belongs to another user (rare — would only happen if `projectId` collides across users) |

### 1.2. `PUT /api/project-binding/{projectId}`

Upsert the current user's binding for a project.

| | |
|---|---|
| **Path** | `/api/project-binding/{projectId}` |
| **Method** | `PUT` |
| **Auth** | Current aioncore session |
| **Path params** | `projectId: string` (URL-encoded) |
| **Body** | `application/json` |

**Request body**

```json
{
  "assistantId": "string",
  "folderPath": "string"
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `assistantId` | yes | string | Must reference an assistant that the current user is allowed to use. Validate server-side. |
| `folderPath` | yes | string | Absolute path, OS-native (`/...` or `C:\...`). Front end validates existence via `ipcBridge.fs.exists`. No server-side path-existence check needed. |

**Success response**

| Status | Body | When |
|---|---|---|
| `200` | `{ "binding": ProjectBinding }` | Created or replaced. Server fills `projectId` (from path) and `updatedAt` (server time, ISO-8601). |

**Error responses**

| Status | Body | When |
|---|---|---|
| `400` | `{ "code": "INVALID_ASSISTANT", "error": "..." }` | `assistantId` does not reference an assistant the user can use. |
| `400` | `{ "code": "INVALID_INPUT", "error": "..." }` | `folderPath` empty or exceeds max length. |
| `403` | `{ "error": "forbidden" }` | Same-user ownership conflict (rare). |

### 1.3. `DELETE /api/project-binding/{projectId}`

Remove the current user's binding for a project. Idempotent.

| | |
|---|---|
| **Path** | `/api/project-binding/{projectId}` |
| **Method** | `DELETE` |
| **Auth** | Current aioncore session |
| **Path params** | `projectId: string` (URL-encoded) |
| **Body** | — |

**Success response**

| Status | Body | When |
|---|---|---|
| `204` | (empty) | Deleted (or no binding to delete — front end does not distinguish). |

**Error responses**

| Status | Body | When |
|---|---|---|
| `403` | `{ "error": "forbidden" }` | Binding belongs to another user. |

---

## 2. Data Model

### `ProjectBinding`

```ts
type ProjectBinding = {
  projectId: string;    // Path parameter; not in request body
  assistantId: string;  // Required on PUT
  folderPath: string;   // Required on PUT
  updatedAt: string;    // ISO-8601; server-generated on every PUT
};
```

### Example response body

```json
{
  "binding": {
    "projectId": "p123",
    "assistantId": "aionrs-default",
    "folderPath": "/Users/me/work/project-x",
    "updatedAt": "2026-08-26T10:30:00.000Z"
  }
}
```

---

## 3. Database

A new table on the aioncore Postgres instance:

```sql
CREATE TABLE project_binding (
  user_id      VARCHAR(64)  NOT NULL,
  project_id   VARCHAR(64)  NOT NULL,
  assistant_id VARCHAR(64)  NOT NULL,
  folder_path  TEXT         NOT NULL CHECK (length(folder_path) > 0 AND length(folder_path) <= 4096),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, project_id)
);

-- Lookups by user (used by other future endpoints, e.g. listing)
CREATE INDEX idx_project_binding_user ON project_binding(user_id);

-- Validate assistant ownership at the FK level if possible, otherwise in app code.
-- If your schema has a per-user assistant table, FK on (user_id, assistant_id).
```

The frontend does **not** pass `userId` — it is implied by the auth context.

If `assistant_id` references a global assistants table, the FK is on `(assistant_id)` alone. Cross-user assistant validation runs in app code:

```sql
-- Pseudo-validation: user can only bind an assistant they have access to.
-- Implementation depends on your assistant ACL model.
SELECT 1
FROM assistant_grant
WHERE user_id = $currentUser
  AND assistant_id = $assistantId
LIMIT 1;
```

---

## 4. Auxiliary endpoint — `POST /api/fs/exists`

This endpoint is **not strictly part of the binding feature**, but the binding UI calls it on every Start Task to validate that the bound folder still exists on disk before pre-applying the preset. The frontend will silently fall back to "treat as unbound" if this endpoint is unavailable — so it can be deployed later than the binding endpoints without blocking the feature.

| | |
|---|---|
| **Path** | `/api/fs/exists` |
| **Method** | `POST` |
| **Auth** | Current aioncore session |
| **Body** | `application/json` |

**Request body**

```json
{ "path": "string (absolute path)" }
```

**Success response**

| Status | Body | When |
|---|---|---|
| `200` | `true` or `false` | `true` if the path resolves (file or directory). |
| `200` | `{ "exists": true \| false }` | Acceptable alternative if your other `/api/fs/*` endpoints return JSON envelopes. |

The frontend uses a direct boolean return path (`httpPost<boolean, { path: string }>`) — see `ipcBridge.fs.exists` in `common/adapter/ipcBridge.ts`. If aioncore's envelope shape differs from a plain boolean, the frontend will need a one-line adapter, but the simpler path is to return `200` with a raw boolean body to match.

**Error responses**

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "invalid path" }` | `path` is empty, not a string, or too long. |
| `500` | `{ "error": "..." }` | Filesystem error other than ENOENT. |

**Implementation hint**

Node:

```ts
import { stat } from 'node:fs/promises';

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (e: any) {
    if (e?.code === 'ENOENT' || e?.code === 'ENOTDIR') return false;
    throw e;
  }
}
```

---

## 5. Sequencing & Rollout

Recommended rollout order:

1. **Database** — create `project_binding` table (migration + down).
2. **`POST /api/fs/exists`** — low-risk, single endpoint.
3. **`GET /api/project-binding/{projectId}`** — read-only, low-risk.
4. **`PUT /api/project-binding/{projectId}`** — write path; test carefully.
5. **`DELETE /api/project-binding/{projectId}`** — simple.

The frontend will keep working through every step (it falls back to mock until each endpoint succeeds). Once all four binding endpoints respond, the frontend will stop using the mock automatically — the only thing to do is remove the localStorage key (`__mockProjectBinding`) from any test users' machines if you want a clean slate.

---

## 6. Open Questions

If any of the following differs from your existing aioncore conventions, flag it before implementation so the frontend adapter can be adjusted:

1. **GET no-row semantics** — prefer `200 { binding: null }` or `404`?
2. **`/api/fs/exists` response shape** — plain boolean or `{ exists: boolean }` envelope?
3. **Assistant ACL** — is there a per-user grant table to FK against, or a single global assistants table that all users can bind to?
4. **`projectId` validation** — does it need to reference an existing row in any `project` table, or can it be any string the client passes?
5. **Path length / character set** — any restrictions beyond "non-empty, ≤ 4096"?

---

## 7. Reference

Frontend code that consumes this contract:

- `packages/desktop/src/renderer/api/projectBinding.ts` — HTTP wrapper with mock fallback.
- `packages/desktop/src/common/adapter/ipcBridge.ts` (`projectBinding.get/put/remove`, `fs.exists`) — bridge declarations.
- `packages/desktop/src/renderer/pages/guid/hooks/useProjectBinding.ts` — fetch/save/clear hook.
- `packages/desktop/src/renderer/pages/guid/hooks/useGuidBindingPresets.ts` — orchestration, modal triggers, preset application.
- `packages/desktop/src/renderer/pages/guid/GuidPage.tsx` — UI integration.
- `packages/desktop/src/renderer/pages/task-center/index.tsx` (`handleStartTask`) — navigation state with `projectId`, `requireBinding`.