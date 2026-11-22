import { CATEGORY_LABELS, type TileCategory } from '../tiles/types';
import { TILE_DEFINITIONS } from '../tiles/registry';
import { Sheet } from './ui';

export function TilePicker({ onPick, onClose }: { onPick(type: string): void; onClose(): void }) {
  const categories = Object.keys(CATEGORY_LABELS) as TileCategory[];
  return (
    <Sheet title="タイルを追加" onClose={onClose} size="lg">
      {categories.map((cat) => {
        const defs = TILE_DEFINITIONS.filter((d) => d.category === cat);
        if (!defs.length) return null;
        return (
          <section key={cat} className="picker-section">
            <h3>{CATEGORY_LABELS[cat]}</h3>
            <div className="picker-grid">
              {defs.map((d) => (
                <button key={d.type} type="button" className="picker-card" onClick={() => onPick(d.type)}>
                  <span className="picker-icon">{d.icon}</span>
                  <span className="picker-name">{d.name}</span>
                  <span className="picker-desc">{d.description}</span>
                  <span className="picker-size">
                    {d.defaultSize.w}×{d.defaultSize.h}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </Sheet>
  );
}
