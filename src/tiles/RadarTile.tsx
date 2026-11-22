import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { TileMessage, useTileSize } from '../components/tileKit';
import { useRemote } from '../hooks/useRemote';
import { useApp } from '../state/store';
import type { TileComponentProps } from './types';
import './radar.css';

interface Frame {
  basetime: string;
  validtime: string;
}

/** 気象庁「雨雲の動き」（高解像度降水ナウキャスト）＋ 国土地理院の地図。どちらも無料・キー不要 */
const jmaUrl = (f: Frame) => `https://www.jma.go.jp/bosai/jmatile/data/nowc/${f.basetime}/none/${f.validtime}/surf/hrpns/{z}/{x}/{y}.png`;

function frameLabel(f: Frame) {
  // validtime は UTC（YYYYMMDDhhmmss）
  const d = new Date(Date.UTC(+f.validtime.slice(0, 4), +f.validtime.slice(4, 6) - 1, +f.validtime.slice(6, 8), +f.validtime.slice(8, 10), +f.validtime.slice(10, 12)));
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function RadarTile({ props }: TileComponentProps) {
  const size = useTileSize();
  const loc = useApp((s) => s.settings.location);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<Map<string, L.TileLayer>>(new Map());
  const { data, error } = useRemote<{ past: Frame[]; future: Frame[] }>('/jma/radar', 2 * 60_000);
  const [step, setStep] = useState(0);
  const zoom = Math.min(10, Math.max(5, Number(props.zoom) || 9));
  const animate = props.animate !== false;

  // 地図の初期化（操作は無効化してページのスワイプと干渉しないようにする）
  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, {
      center: [loc.lat, loc.lon],
      zoom,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      fadeAnimation: false,
    });
    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(m);
    L.circleMarker([loc.lat, loc.lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#ff4d6d', fillOpacity: 1 }).addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(box.current);
    const current = layers.current;
    return () => {
      ro.disconnect();
      current.clear();
      m.remove();
      map.current = null;
    };
  }, [loc.lat, loc.lon, zoom]);

  const past = Array.isArray(data?.past) ? data.past : [];
  const future = Array.isArray(data?.future) ? data.future : [];
  const frames = [...past, ...(props.forecast !== false ? future : [])];
  const latestIndex = Math.max(0, past.length - 1);

  // アニメーション（過去1時間 → 予報）
  useEffect(() => {
    if (!animate || frames.length < 2) return;
    const t = window.setInterval(() => setStep((s) => s + 1), 700);
    return () => window.clearInterval(t);
  }, [animate, frames.length]);

  const index = frames.length ? (animate ? (step % (frames.length + 3)) % frames.length : latestIndex) : -1;
  const frame = index >= 0 ? frames[Math.min(index, frames.length - 1)] : null;

  // 表示するフレームのレイヤーだけを表示（事前に読み込んでおき、切り替えをなめらかに）
  useEffect(() => {
    const m = map.current;
    if (!m || !frames.length) return;
    const wanted = new Set(frames.map((f) => f.validtime + f.basetime));
    for (const [key, layer] of layers.current) {
      if (!wanted.has(key)) {
        layer.remove();
        layers.current.delete(key);
      }
    }
    for (const f of frames) {
      const key = f.validtime + f.basetime;
      if (!layers.current.has(key)) {
        const layer = L.tileLayer(jmaUrl(f), { opacity: 0, maxNativeZoom: 10, minNativeZoom: 4, maxZoom: 18 });
        layer.addTo(m);
        layers.current.set(key, layer);
      }
    }
    const activeKey = frame ? frame.validtime + frame.basetime : '';
    for (const [key, layer] of layers.current) layer.setOpacity(key === activeKey ? 0.78 : 0);
  });

  if (error && !data) return <TileMessage icon="🌧️">雨雲レーダーを取得できません</TileMessage>;
  const isForecast = frame ? future.includes(frame) : false;

  return (
    <div className="radar">
      <div ref={box} className="radar-map" />
      <div className="radar-badge">
        🌧️ {size.size !== 'xs' && '雨雲'} {frame ? frameLabel(frame) : '--:--'}
        {isForecast && <span className="radar-fc">予報</span>}
      </div>
      <div className="radar-attr">地理院タイル / 気象庁</div>
    </div>
  );
}
