import type { LayoutProfile, TileInstance } from '../../shared/types';

const t = (id: string, type: string, x: number, y: number, w: number, h: number, props?: Record<string, unknown>): TileInstance => ({
  id,
  type,
  x,
  y,
  w,
  h,
  ...(props ? { props } : {}),
});

/** 初回起動時のレイアウト（タブレット横向き 8×6） */
export function createDefaultProfile(): LayoutProfile {
  return {
    cols: 8,
    rows: 6,
    pages: [
      {
        id: 'home',
        tiles: [
          t('clock-1', 'clock', 0, 0, 3, 2),
          t('weather-1', 'weather', 3, 0, 3, 2),
          t('holiday-1', 'holiday', 6, 0, 2, 2),
          t('events-1', 'timetree', 0, 2, 3, 4),
          t('tigers-1', 'tigers', 3, 2, 3, 2),
          t('trivia-1', 'trivia', 3, 4, 3, 2),
          t('garbage-1', 'garbage', 6, 2, 2, 2),
          t('warning-1', 'warning', 6, 4, 2, 2),
        ],
      },
      {
        id: 'family',
        tiles: [
          t('tasks-1', 'tasks', 0, 0, 3, 4),
          t('memo-1', 'memo', 3, 0, 3, 2),
          t('calendar-1', 'calendar', 6, 0, 2, 3),
          t('shopping-1', 'shopping', 3, 2, 3, 4),
          t('anniv-1', 'anniversary', 6, 3, 2, 3),
          t('wifi-1', 'wifi', 0, 4, 3, 2),
        ],
      },
      {
        id: 'kids',
        tiles: [
          t('kids-1', 'kidsQuiz', 0, 0, 4, 4),
          t('timer-1', 'timer', 4, 0, 2, 3),
          t('photo-1', 'photo', 6, 0, 2, 3),
          t('radar-1', 'radar', 4, 3, 4, 3),
          t('clock-2', 'clock', 0, 4, 4, 2, { style: 'digital' }),
        ],
      },
      {
        id: 'info',
        tiles: [
          t('flyer-1', 'flyer', 0, 0, 4, 6),
          t('news-1', 'news', 4, 0, 4, 3),
          t('tigers-2', 'tigers', 4, 3, 4, 3),
        ],
      },
    ],
  };
}
