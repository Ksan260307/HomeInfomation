import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../../shared/defaults';
import type { BoardsState, LayoutProfile, LayoutState, ProfileId, PublicSettings } from '../../shared/types';
import { api } from '../api/client';
import { GRID_PRESETS, reflowProfile, repairProfile } from '../grid/layout';
import { invalidateRemote } from '../hooks/useRemote';
import { limitsOf } from '../tiles/registry';
import { createDefaultProfile } from './defaultLayout';

const LS_LAYOUT = 'hi:layout';
const LS_SETTINGS = 'hi:settings';
const LS_PROFILE = 'hi:profile-override';

function readLocal<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* プライベートブラウズ等では保存できない */
  }
}

export type ProfileChoice = ProfileId | 'auto';

export function detectProfile(width: number, height: number): ProfileId {
  // 縦持ちのスマホ、または横持ちのスマホ（高さが極端に低い）
  if (width < 600 || Math.min(width, height) < 460) return 'phone';
  return width >= height ? 'tablet-landscape' : 'tablet-portrait';
}

const initialSettings: PublicSettings = {
  ...structuredClone(DEFAULT_SETTINGS),
  calendar: { ...DEFAULT_SETTINGS.calendar, timetreePasswordSet: false },
};

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

interface AppState {
  ready: boolean;
  serverOnline: boolean;
  settings: PublicSettings;
  layout: LayoutState;
  boards: BoardsState;
  autoProfile: ProfileId;
  profileChoice: ProfileChoice;
  editMode: boolean;
  pageIndex: number;
  /** 編集中で未保存の変更がある */
  dirty: boolean;
  toasts: Toast[];
  /** リモコンから「暗くする」が指示されている */
  remoteDim: boolean;
  /** この時刻までは夜間減光をしない（タップ・リモコンで一時解除） */
  wakeUntil: number;

  init(): Promise<void>;
  syncFromServer(): Promise<void>;
  setAutoProfile(id: ProfileId): void;
  setProfileChoice(c: ProfileChoice): void;
  setEditMode(on: boolean): void;
  setPageIndex(i: number): void;
  updateProfile(fn: (p: LayoutProfile) => LayoutProfile): void;
  saveSettings(next: PublicSettings): Promise<void>;
  setBoards(b: BoardsState): void;
  refreshBoards(): Promise<void>;
  toast(text: string, kind?: Toast['kind']): void;
  setRemoteDim(dim: boolean, wakeForMs?: number): void;
}

let saveTimer: number | undefined;
let toastSeq = 0;

export const activeProfileId = (s: Pick<AppState, 'profileChoice' | 'autoProfile'>): ProfileId =>
  s.profileChoice === 'auto' ? s.autoProfile : s.profileChoice;

/** 指定プロファイルのレイアウトを返す。無ければ他のプロファイルから自動生成する */
export function ensureProfile(layout: LayoutState, id: ProfileId): LayoutProfile {
  const existing = layout.profiles[id];
  if (existing) return repairProfile(existing, limitsOf);
  const { cols, rows } = GRID_PRESETS[id];
  const source = layout.profiles['tablet-landscape'] ?? layout.profiles['tablet-portrait'] ?? layout.profiles.phone;
  if (source) return reflowProfile(source, cols, rows, limitsOf);
  const base = createDefaultProfile();
  return id === 'tablet-landscape' ? base : reflowProfile(base, cols, rows, limitsOf);
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  serverOnline: true,
  settings: readLocal<PublicSettings>(LS_SETTINGS) ?? initialSettings,
  layout: readLocal<LayoutState>(LS_LAYOUT) ?? { profiles: {}, updatedAt: 0 },
  boards: { memos: [], lists: {}, updatedAt: 0 },
  autoProfile: detectProfile(window.innerWidth, window.innerHeight),
  profileChoice: (readLocal<ProfileChoice>(LS_PROFILE) ?? 'auto') as ProfileChoice,
  editMode: false,
  pageIndex: 0,
  dirty: false,
  toasts: [],
  remoteDim: false,
  wakeUntil: 0,

  async init() {
    await get().syncFromServer();
    set({ ready: true });
    void get().refreshBoards();
  },

  async syncFromServer() {
    try {
      const [settings, layout] = await Promise.all([api.getSettings(), api.getLayout()]);
      writeLocal(LS_SETTINGS, settings);
      const local = get().layout;
      // 編集中・未保存の変更があるときはサーバー側で上書きしない
      const useServer = !get().dirty && !get().editMode && layout.updatedAt >= local.updatedAt;
      set({ settings, serverOnline: true, ...(useServer ? { layout } : {}) });
      if (useServer) writeLocal(LS_LAYOUT, layout);
      // サーバーにまだレイアウトが無ければ、現在の（既定）レイアウトを保存しておく
      if (layout.updatedAt === 0 && !layout.profiles['tablet-landscape']) {
        get().updateProfile((p) => p);
      }
    } catch {
      set({ serverOnline: false });
    }
  },

  setAutoProfile(id) {
    if (get().autoProfile !== id) set({ autoProfile: id, pageIndex: 0 });
  },

  setProfileChoice(c) {
    writeLocal(LS_PROFILE, c);
    set({ profileChoice: c, pageIndex: 0 });
  },

  setEditMode(on) {
    set({ editMode: on });
  },

  setPageIndex(i) {
    if (get().pageIndex !== i) set({ pageIndex: i });
  },

  updateProfile(fn) {
    const state = get();
    const id = activeProfileId(state);
    const current = ensureProfile(state.layout, id);
    const next = fn(structuredClone(current));
    const layout: LayoutState = { profiles: { ...state.layout.profiles, [id]: next }, updatedAt: Date.now() };
    set({ layout, dirty: true, pageIndex: Math.min(state.pageIndex, next.pages.length - 1) });
    writeLocal(LS_LAYOUT, layout);
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      try {
        const saved = await api.putLayout(get().layout);
        set({ dirty: false, serverOnline: true, layout: { ...get().layout, updatedAt: saved.updatedAt } });
        writeLocal(LS_LAYOUT, get().layout);
      } catch {
        set({ serverOnline: false });
        get().toast('レイアウトを PC に保存できませんでした（自動で再試行します）', 'error');
      }
    }, 500);
  },

  async saveSettings(next) {
    const saved = await api.putSettings(next);
    writeLocal(LS_SETTINGS, saved);
    set({ settings: saved });
    invalidateRemote();
  },

  setBoards(b) {
    set({ boards: b });
  },

  async refreshBoards() {
    try {
      set({ boards: await api.getBoards() });
    } catch {
      /* オフライン時は前回の内容を表示 */
    }
  },

  setRemoteDim(dim, wakeForMs = 0) {
    set({ remoteDim: dim, ...(wakeForMs ? { wakeUntil: Date.now() + wakeForMs } : {}) });
  },

  toast(text, kind = 'info') {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, text, kind }] });
    window.setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3500);
  },
}));

/** 現在の端末で使うレイアウト */
export function useActiveProfile(): { id: ProfileId; profile: LayoutProfile } {
  const layout = useApp((s) => s.layout);
  const id = useApp(activeProfileId);
  const profile = layout.profiles[id];
  return { id, profile: profile ?? ensureProfile(layout, id) };
}
