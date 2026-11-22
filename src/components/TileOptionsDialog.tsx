import { useState } from 'react';
import type { TileInstance } from '../../shared/types';
import { useApp } from '../state/store';
import { ACCENTS } from '../themes/themes';
import { getTileDef } from '../tiles/registry';
import type { OptionField } from '../tiles/types';
import { Button, Field, Segmented, Sheet, Toggle } from './ui';

/** すべてのタイルに共通する見た目のオプション（今後のスタイル拡張用） */
const COMMON_FIELDS: OptionField[] = [
  {
    key: 'surface',
    label: 'タイルの背景',
    type: 'select',
    options: [
      { value: 'glass', label: 'すりガラス' },
      { value: 'solid', label: '不透明' },
      { value: 'clear', label: '透明' },
    ],
  },
  {
    key: 'textScale',
    label: '文字の大きさ',
    type: 'select',
    options: [
      { value: 'small', label: '小' },
      { value: 'normal', label: '標準' },
      { value: 'large', label: '大' },
      { value: 'xlarge', label: '特大' },
    ],
  },
];

export function OptionInput({ field, value, onChange }: { field: OptionField; value: unknown; onChange(v: unknown): void }) {
  switch (field.type) {
    case 'select':
      return field.options.length <= 4 ? (
        <Segmented value={String(value ?? field.options[0]?.value)} options={field.options} onChange={onChange} />
      ) : (
        <select className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'text':
      return <input className="input" value={String(value ?? '')} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return (
        <input
          className="input"
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );
    case 'toggle':
      return <Toggle checked={value === true} onChange={onChange} />;
  }
}

export function TileOptionsDialog({
  tile,
  pageIndex,
  pageCount,
  onMove,
  onClose,
}: {
  tile: TileInstance;
  pageIndex: number;
  pageCount: number;
  onMove(dir: -1 | 1): void;
  onClose(): void;
}) {
  const def = getTileDef(tile.type);
  const updateProfile = useApp((s) => s.updateProfile);
  const [props, setProps] = useState<Record<string, unknown>>({ ...(def?.defaultProps ?? {}), ...(tile.props ?? {}) });
  const set = (key: string, v: unknown) => setProps((p) => ({ ...p, [key]: v }));

  const save = () => {
    updateProfile((p) => {
      for (const page of p.pages) {
        const t = page.tiles.find((x) => x.id === tile.id);
        if (t) t.props = props;
      }
      return p;
    });
    onClose();
  };

  const fields = def?.options ?? [];

  return (
    <Sheet
      title={
        <>
          {def?.icon} {def?.name ?? tile.type} の設定
        </>
      }
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            キャンセル
          </Button>
          <Button variant="primary" icon="check" onClick={save}>
            保存
          </Button>
        </>
      }
    >
      {fields.length > 0 && (
        <div className="form-group">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} help={f.help}>
              <OptionInput field={f} value={props[f.key]} onChange={(v) => set(f.key, v)} />
            </Field>
          ))}
        </div>
      )}

      <h3 className="form-title">見た目</h3>
      <div className="form-group">
        <Field label="アクセントカラー">
          <div className="swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`swatch ${String(props.accent ?? 'theme') === a.id ? 'is-active' : ''}`}
                style={{ background: a.value || 'var(--accent)' }}
                title={a.name}
                aria-label={a.name}
                onClick={() => set('accent', a.id)}
              />
            ))}
          </div>
        </Field>
        {COMMON_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <OptionInput field={f} value={props[f.key] ?? (f.key === 'surface' ? 'glass' : 'normal')} onChange={(v) => set(f.key, v)} />
          </Field>
        ))}
      </div>

      <h3 className="form-title">配置</h3>
      <div className="form-row">
        <Button icon="chevronLeft" disabled={pageIndex <= 0} onClick={() => onMove(-1)}>
          前のページへ
        </Button>
        <Button icon="chevronRight" onClick={() => onMove(1)}>
          {pageIndex >= pageCount - 1 ? '新しいページへ' : '次のページへ'}
        </Button>
      </div>
      <p className="field-help">ヒント: 編集モードでタイルを画面の端までドラッグして少し待つと、隣のページへ移動できます。</p>
    </Sheet>
  );
}
