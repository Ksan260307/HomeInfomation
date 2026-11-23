import type { BoardsState, ExportBundle, LayoutState, PublicSettings } from '../../shared/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      /* noop */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),

  getSettings: () => request<PublicSettings>('GET', '/settings'),
  putSettings: (s: PublicSettings) => request<PublicSettings>('PUT', '/settings', s),

  getLayout: () => request<LayoutState>('GET', '/layout'),
  putLayout: (l: LayoutState) => request<LayoutState>('PUT', '/layout', l),

  getBoards: () => request<BoardsState>('GET', '/boards'),
  addMemo: (text: string, color: string, author?: string) => request<BoardsState>('POST', '/memos', { text, color, author }),
  updateMemo: (id: string, patch: { text?: string; color?: string }) => request<BoardsState>('PATCH', `/memos/${id}`, patch),
  deleteMemo: (id: string) => request<BoardsState>('DELETE', `/memos/${id}`),
  addItem: (list: string, text: string, important = false) => request<BoardsState>('POST', `/lists/${list}/items`, { text, important }),
  updateItem: (list: string, id: string, patch: { done?: boolean; text?: string; important?: boolean }) =>
    request<BoardsState>('PATCH', `/lists/${list}/items/${id}`, patch),
  deleteItem: (list: string, id: string) => request<BoardsState>('DELETE', `/lists/${list}/items/${id}`),
  clearDone: (list: string) => request<BoardsState>('POST', `/lists/${list}/clear-done`),

  setLock: (enabled: boolean) => request<{ enabled: boolean }>('PUT', '/lock', { enabled }),

  exportUrl: (secrets: boolean) => `/api/export${secrets ? '?secrets=1' : ''}`,
  importBundle: (bundle: ExportBundle, sections: string[]) => request<{ ok: boolean; imported: string[] }>('POST', '/import', { bundle, sections }),
};
