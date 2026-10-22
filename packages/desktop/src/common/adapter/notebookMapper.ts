/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Maps the backend snake_case response shape for notebooks / notes / tags to
 * the camelCase shape consumed by the renderer.
 *
 * See `notebook-api.md`: NoteResponse carries no `content` — the full Markdown
 * body is only available via `GET /api/notes/{id}/raw`. Notes reference their
 * parent notebook by **id** (`notebook_id`), not by name.
 */

export interface ApiNotebook {
  id: string;
  name: string;
  description?: string;
  created_at: number;
  updated_at: number;
}

export interface ApiNote {
  id: string;
  title: string;
  /** Notebook **id** (nullable). */
  notebook_id?: string | null;
  file_path: string;
  summary?: string;
  tags: string[];
  star: boolean;
  created_at: number;
  updated_at: number;
}

export interface ApiNotebookWithNotes {
  notebook: ApiNotebook;
  notes: ApiNote[];
}

export interface ApiNotebookListResponse {
  notebooks: ApiNotebook[];
}

export interface ApiNotesListResponse {
  notes: ApiNote[];
}

export interface ApiTag {
  name: string;
  count: number;
}

export interface ApiTagsResponse {
  tags: ApiTag[];
}

export interface ApiStarToggleResponse {
  id: string;
  star: boolean;
}

// ---------------------------------------------------------------------------
// Renderer-facing types (camelCase) — moved here from the deleted
// `pages/notes/types.ts` so the mapper is self-contained and the notes
// micro-app can import them via the `@common/adapter/notebookMapper` alias.
// ---------------------------------------------------------------------------

export interface Notebook {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteItem {
  id: string;
  title: string;
  notebookId: string | null;
  filePath: string;
  summary?: string;
  tags: string[];
  star: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TagItem {
  name: string;
  count: number;
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function fromApiNotebook(api: ApiNotebook): Notebook {
  return {
    id: api.id,
    name: api.name,
    description: api.description ?? '',
    createdAt: msToIso(api.created_at),
    updatedAt: msToIso(api.updated_at),
  };
}

export function fromApiNote(api: ApiNote): NoteItem {
  return {
    id: api.id,
    title: api.title,
    notebookId: api.notebook_id ?? null,
    filePath: api.file_path,
    summary: api.summary,
    tags: api.tags ?? [],
    star: Boolean(api.star),
    createdAt: msToIso(api.created_at),
    updatedAt: msToIso(api.updated_at),
  };
}

export function fromApiNoteList(apiNotes: ApiNote[]): NoteItem[] {
  return apiNotes.map(fromApiNote);
}

export function fromApiTag(api: ApiTag): TagItem {
  return {
    name: api.name,
    count: api.count,
  };
}

export function fromApiTagList(apiTags: ApiTag[]): TagItem[] {
  return apiTags.map(fromApiTag);
}
