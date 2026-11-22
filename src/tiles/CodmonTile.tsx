import { useEffect } from 'react';
import type { BoardsState } from '../../shared/types';
import { api } from '../api/client';
import { Icon } from '../components/icons';
import { TileHeader, atLeast, openExternal, useTileSize } from '../components/tileKit';
import { useNow } from '../hooks/useNow';
import { holidayName, toYmd } from '../lib/holidays';
import { useApp } from '../state/store';
import type { TileComponentProps } from './types';
import './codmon.css';

/**
 * コドモン連携タイル。
 * コドモンには公開 API が無いため、データの自動取得はせず
 * 「コドモンを開く」ボタンと、毎朝の提出・準備チェック（家族で共有）、登園・お迎え時刻を表示する。
 * チェック状態は日付ごとの共有リスト（codmon-YYYYMMDD）として PC に保存され、翌日には自動でリセットされる。
 */

export const CODMON_URL = 'https://parents.codmon.com/';

const parseTime = (s: unknown): number | null => {
  const m = String(s ?? '').match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

function untilText(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}時間${m ? `${m}分` : ''}` : `${m}分`;
}

export function CodmonTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const now = new Date(useNow(60_000));
  const listId = `codmon-${toYmd(now).replace(/-/g, '')}`;
  const done = useApp((s) => s.boards.lists[listId]) ?? [];
  const setBoards = useApp((s) => s.setBoards);
  const refresh = useApp((s) => s.refreshBoards);
  const toast = useApp((s) => s.toast);

  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === 'visible' && void refresh(), 15_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const child = typeof props.childName === 'string' ? props.childName.trim() : '';
  const url = (typeof props.url === 'string' && props.url.trim()) || CODMON_URL;
  const checks = String(props.checks ?? '')
    .split(/[,、\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
  const offDay = props.skipHolidays !== false && (now.getDay() === 0 || now.getDay() === 6 || holidayName(now) !== null);

  const drop = parseTime(props.dropTime);
  const pickup = parseTime(props.pickupTime);
  const cur = now.getHours() * 60 + now.getMinutes();
  let timeLine = '';
  if (!offDay) {
    if (drop !== null && cur < drop) timeLine = `登園まで あと${untilText(drop - cur)}`;
    else if (pickup !== null && cur < pickup) timeLine = `お迎えまで あと${untilText(pickup - cur)}`;
    else if (pickup !== null) timeLine = 'お迎えの時間を過ぎました';
  }

  const isDone = (c: string) => done.some((i) => i.text === c);
  const remaining = checks.filter((c) => !isDone(c)).length;

  const toggle = async (c: string) => {
    try {
      const item = done.find((i) => i.text === c);
      const b: BoardsState = item ? await api.deleteItem(listId, item.id) : await api.addItem(listId, c);
      setBoards(b);
    } catch (e) {
      toast(`保存できませんでした: ${(e as Error).message}`, 'error');
    }
  };

  const open = () => openExternal(url);

  if (size.size === 'xs') {
    return (
      <button type="button" className="codmon codmon--mini" onClick={open}>
        <span className="codmon-logo">🏫</span>
        <span className="codmon-mini-text">{offDay ? 'おやすみ' : remaining ? `のこり${remaining}` : '準備OK'}</span>
      </button>
    );
  }

  return (
    <div className={`codmon ${size.wide ? 'is-wide' : ''}`}>
      <TileHeader
        icon="🏫"
        title="コドモン"
        sub={child || undefined}
        right={
          <button type="button" className="codmon-open" onClick={open}>
            {atLeast(size.size, 'm') && <span>開く</span>}
            <Icon name="external" size={14} />
          </button>
        }
      />

      {offDay ? (
        <div className="codmon-off">
          <span>🌈</span>
          <span>今日は{holidayName(now) ?? 'おやすみ'}</span>
        </div>
      ) : (
        <>
          {(timeLine || drop !== null || pickup !== null) && size.height > 170 && (
            <div className="codmon-times">
              {drop !== null && (
                <span className={cur >= drop ? 'is-past' : ''}>
                  🚶 登園 <b>{String(props.dropTime)}</b>
                </span>
              )}
              {pickup !== null && (
                <span className={cur >= pickup ? 'is-past' : ''}>
                  🤝 お迎え <b>{String(props.pickupTime)}</b>
                </span>
              )}
              {timeLine && atLeast(size.size, 'm') && <span className="codmon-until">{timeLine}</span>}
            </div>
          )}

          {checks.length > 0 ? (
            <ul className="codmon-checks">
              {checks.map((c) => {
                const on = isDone(c);
                return (
                  <li key={c}>
                    <button type="button" className={`codmon-check ${on ? 'is-done' : ''}`} onClick={() => void toggle(c)}>
                      <span className="codmon-box">{on && <Icon name="check" size={14} />}</span>
                      <span>{c}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <button type="button" className="codmon-big-open" onClick={open}>
              コドモンを開いて連絡帳を書く
            </button>
          )}

          {checks.length > 0 && remaining === 0 && size.height > 200 && <div className="codmon-ok">✨ 今日の準備はばっちり！</div>}
        </>
      )}
    </div>
  );
}
