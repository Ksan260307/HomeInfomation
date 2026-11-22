import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { BoardsState, ListItem, MemoNote } from '../../shared/types';
import { api } from '../api/client';
import { Icon } from '../components/icons';
import { TileHeader, TileMessage, atLeast, useTileSize } from '../components/tileKit';
import { Button, Sheet } from '../components/ui';
import { relativeTime } from '../lib/utils';
import { useApp } from '../state/store';
import type { TileComponentProps } from './types';
import './boards.css';

/** 共有ボードを定期的に取り直す（他の端末での変更を反映） */
function useBoardsSync() {
  const refresh = useApp((s) => s.refreshBoards);
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === 'visible' && void refresh(), 15_000);
    return () => window.clearInterval(t);
  }, [refresh]);
}

function useBoardAction() {
  const setBoards = useApp((s) => s.setBoards);
  const toast = useApp((s) => s.toast);
  return async (fn: () => Promise<BoardsState>) => {
    try {
      setBoards(await fn());
    } catch (e) {
      toast(`保存できませんでした: ${(e as Error).message}`, 'error');
    }
  };
}

// ---------------------------------------------------------------------------
// タスクボード / 買い物リスト
// ---------------------------------------------------------------------------

const QUICK_SHOPPING = ['牛乳', '卵', 'パン', 'お米', '納豆', '豆腐', 'バナナ', 'トイレットペーパー', 'ティッシュ', '洗剤'];

function sortItems(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.done && !!a.important !== !!b.important) return a.important ? -1 : 1;
    return a.done ? (a.doneAt ?? 0) - (b.doneAt ?? 0) : a.createdAt - b.createdAt;
  });
}

function ListTileBase({ props, kind }: TileComponentProps & { kind: 'tasks' | 'shopping' }) {
  useBoardsSync();
  const size = useTileSize();
  const listId = String(props.listId || kind).replace(/[^\w-]/g, '').slice(0, 40) || kind;
  const items = useApp((s) => s.boards.lists[listId]) ?? [];
  const act = useBoardAction();
  const [text, setText] = useState('');
  const sorted = sortItems(items);
  const remaining = items.filter((i) => !i.done).length;
  const doneCount = items.length - remaining;
  const title = (typeof props.title === 'string' && props.title) || (kind === 'tasks' ? 'タスクボード' : '買い物リスト');
  const icon = kind === 'tasks' ? '✅' : '🛒';
  const canAdd = atLeast(size.size, 's') && size.height > 150;

  const add = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setText('');
    void act(() => api.addItem(listId, v));
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    add(text);
  };

  if (size.size === 'xs') {
    return (
      <div className="list list--mini">
        <span className="list-mini-icon">{icon}</span>
        <span className="list-mini-count">{remaining}</span>
        <span className="list-mini-label">{kind === 'tasks' ? 'やること' : 'かうもの'}</span>
      </div>
    );
  }

  return (
    <div className="list">
      <TileHeader
        icon={icon}
        title={title}
        sub={remaining ? `あと${remaining}件` : undefined}
        right={
          doneCount > 0 && atLeast(size.size, 's') ? (
            <button type="button" className="link-btn" onClick={() => void act(() => api.clearDone(listId))}>
              完了を消す
            </button>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <TileMessage icon={kind === 'tasks' ? '🎉' : '🧺'}>{kind === 'tasks' ? 'やることはありません' : 'リストは空です'}</TileMessage>
      ) : (
        <ul className="list-items">
          {sorted.map((it) => (
            <li key={it.id} className={`list-item ${it.done ? 'is-done' : ''} ${it.important ? 'is-important' : ''}`}>
              <button
                type="button"
                className="list-check"
                aria-label={it.done ? '未完了に戻す' : '完了にする'}
                onClick={() => void act(() => api.updateItem(listId, it.id, { done: !it.done }))}
              >
                {it.done && <Icon name="check" size={14} />}
              </button>
              <span className="list-text">{it.text}</span>
              {kind === 'tasks' && !it.done && atLeast(size.size, 'm') && (
                <button
                  type="button"
                  className={`list-star ${it.important ? 'is-on' : ''}`}
                  aria-label="重要"
                  onClick={() => void act(() => api.updateItem(listId, it.id, { important: !it.important }))}
                >
                  ★
                </button>
              )}
              <button type="button" className="list-delete" aria-label="削除" onClick={() => void act(() => api.deleteItem(listId, it.id))}>
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {kind === 'shopping' && atLeast(size.size, 'l') && (
        <div className="list-quick">
          {QUICK_SHOPPING.filter((q) => !items.some((i) => !i.done && i.text === q))
            .slice(0, 8)
            .map((q) => (
              <button key={q} type="button" className="chip-btn" onClick={() => add(q)}>
                ＋{q}
              </button>
            ))}
        </div>
      )}
      {canAdd && (
        <form className="list-add" onSubmit={onSubmit}>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={kind === 'tasks' ? 'やることを追加…' : '買うものを追加…'}
            enterKeyHint="done"
            maxLength={500}
          />
          <button type="submit" className="icon-btn is-accent" aria-label="追加" disabled={!text.trim()}>
            <Icon name="plus" size={18} />
          </button>
        </form>
      )}
    </div>
  );
}

export const TaskBoardTile = (p: TileComponentProps) => <ListTileBase {...p} kind="tasks" />;
export const ShoppingTile = (p: TileComponentProps) => <ListTileBase {...p} kind="shopping" />;

// ---------------------------------------------------------------------------
// 伝言板
// ---------------------------------------------------------------------------

const MEMO_COLORS = ['#ffd166', '#ff9fb2', '#9be7c4', '#9ecbff', '#d0b3ff', '#ffb38a'];

function MemoEditor({ note, onClose }: { note?: MemoNote; onClose(): void }) {
  const act = useBoardAction();
  const [text, setText] = useState(note?.text ?? '');
  const [color, setColor] = useState(note?.color ?? MEMO_COLORS[0]);
  const [author, setAuthor] = useState(note?.author ?? localStorage.getItem('hi:memo-author') ?? '');

  const save = async () => {
    if (!text.trim()) return;
    try {
      localStorage.setItem('hi:memo-author', author);
    } catch {
      /* noop */
    }
    await act(() => (note ? api.updateMemo(note.id, { text, color }) : api.addMemo(text, color, author || undefined)));
    onClose();
  };

  return (
    <Sheet
      title={note ? '伝言を編集' : '伝言を書く'}
      onClose={onClose}
      size="sm"
      footer={
        <>
          {note && (
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                await act(() => api.deleteMemo(note.id));
                onClose();
              }}
            >
              削除
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <Button variant="primary" icon="check" onClick={save} disabled={!text.trim()}>
            {note ? '保存' : '貼る'}
          </Button>
        </>
      }
    >
      <textarea
        className="input memo-textarea"
        style={{ background: color }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="例）今日は19時に帰ります"
        maxLength={1000}
        autoFocus
      />
      <div className="form-row">
        <div className="swatches">
          {MEMO_COLORS.map((c) => (
            <button key={c} type="button" className={`swatch ${c === color ? 'is-active' : ''}`} style={{ background: c }} aria-label={c} onClick={() => setColor(c)} />
          ))}
        </div>
        {!note && <input className="input memo-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="なまえ（任意）" maxLength={20} />}
      </div>
    </Sheet>
  );
}

export function MemoTile() {
  useBoardsSync();
  const size = useTileSize();
  const memos = useApp((s) => s.boards.memos);
  const [editing, setEditing] = useState<MemoNote | 'new' | null>(null);
  const now = Date.now();

  return (
    <div className="memo">
      {size.size !== 'xs' && (
        <TileHeader
          icon="📝"
          title="伝言板"
          right={
            <button type="button" className="icon-btn is-accent" aria-label="伝言を書く" onClick={() => setEditing('new')}>
              <Icon name="plus" size={18} />
            </button>
          }
        />
      )}
      {memos.length === 0 ? (
        <button type="button" className="memo-empty" onClick={() => setEditing('new')}>
          <span>📌</span>
          <span>タップして伝言を書く</span>
        </button>
      ) : (
        <div className={`memo-notes ${size.size === 'xs' || size.size === 's' ? 'is-single' : ''}`}>
          {memos.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className="memo-note"
              style={{ background: m.color, '--tilt': `${((i * 37) % 5) - 2}deg` } as CSSProperties}
              onClick={() => setEditing(m)}
            >
              <span className="memo-text">{m.text}</span>
              <span className="memo-meta">
                {m.author && <b>{m.author}</b>}
                {relativeTime(m.createdAt, now)}
              </span>
            </button>
          ))}
        </div>
      )}
      {editing && <MemoEditor note={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
