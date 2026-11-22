import type { ComponentType } from 'react';
import type { TileInstance } from '../../shared/types';
import type { Size } from '../grid/layout';

/** タイル設定ダイアログで表示する入力項目 */
export type OptionField =
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; help?: string }
  | { key: string; label: string; type: 'text'; placeholder?: string; help?: string }
  | { key: string; label: string; type: 'number'; min?: number; max?: number; step?: number; help?: string }
  | { key: string; label: string; type: 'toggle'; help?: string };

export interface TileComponentProps {
  tile: TileInstance;
  /** defaultProps とマージ済みのオプション */
  props: Record<string, unknown>;
}

export type TileCategory = 'basic' | 'info' | 'family' | 'kids' | 'tools';

export interface TileDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: TileCategory;
  defaultSize: Size;
  minSize: Size;
  maxSize?: Size;
  component: ComponentType<TileComponentProps>;
  defaultProps?: Record<string, unknown>;
  options?: OptionField[];
  /** タイル見出しを表示しない（全面写真など） */
  bare?: boolean;
}

export const CATEGORY_LABELS: Record<TileCategory, string> = {
  basic: '基本',
  info: '情報・ニュース',
  family: '家族・くらし',
  kids: 'こども',
  tools: 'ツール',
};
